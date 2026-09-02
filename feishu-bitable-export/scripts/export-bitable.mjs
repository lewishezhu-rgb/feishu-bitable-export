import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { gunzipSync } from "node:zlib";
import ExcelJS from "exceljs";
import { chromium } from "playwright";

const DEFAULT_OUTPUT = "feishu-bitable-export.xlsx";
const INITIAL_RECORD_LIMIT = 200;
const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REQUEST_ATTEMPTS = 3;
const MAX_PAGE_REQUESTS = 10_000;

function usage() {
  return [
    "用法：npm run export -- <飞书多维表格 URL> [--output <文件.xlsx>] [--force] [--no-prompt] [--headless]",
    "默认输出当前目录的 feishu-bitable-export.xlsx；已有同名文件时会拒绝覆盖，除非提供 --force。",
    "默认打开隔离浏览器；如目标表需要权限，请在窗口中手动登录后按回车继续。",
    "--headless 仅适用于无需交互登录的公开表格，并自动启用 --no-prompt。"
  ].join("\n");
}

function parseArguments(args) {
  const options = {
    sourceUrl: null,
    outputPath: DEFAULT_OUTPUT,
    force: false,
    noPrompt: false,
    headless: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (argument === "--output" || argument === "-o") {
      const outputPath = args[++index];
      if (!outputPath || outputPath.startsWith("-")) throw new Error("--output 缺少文件路径。");
      options.outputPath = outputPath;
      continue;
    }
    if (argument === "--force") {
      options.force = true;
      continue;
    }
    if (argument === "--no-prompt") {
      options.noPrompt = true;
      continue;
    }
    if (argument === "--headless") {
      options.headless = true;
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`不支持的参数：${argument}`);
    if (options.sourceUrl) throw new Error("只能提供一个飞书多维表格 URL。\n" + usage());
    options.sourceUrl = argument;
  }

  if (!options.sourceUrl) throw new Error(usage());
  if (options.headless) options.noPrompt = true;
  return options;
}

function parseTarget(sourceUrl) {
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("请输入完整的飞书多维表格 URL。");
  }

  if (url.protocol !== "https:" || !/(^|\.)feishu\.cn$/i.test(url.hostname)) {
    throw new Error("仅支持 HTTPS 的飞书中国站多维表格链接（*.feishu.cn）。");
  }

  const baseToken = url.pathname.match(/\/base\/([^/?#]+)/)?.[1];
  const tableId = url.searchParams.get("table");
  const viewId = url.searchParams.get("view");
  if (!baseToken || !tableId || !viewId) {
    throw new Error("链接必须包含 base、table 与 view 标识；请在目标视图中复制完整地址。");
  }

  return { url, baseToken, tableId, viewId };
}

async function waitForUser() {
  const terminal = createInterface({ input, output });
  try {
    await terminal.question("请在打开的浏览器中确认目标视图可见；如需权限请手动登录。完成后按回车继续：");
  } finally {
    terminal.close();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJsonInPage(page, requestUrl, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const result = await page.evaluate(async ({ url, timeoutMs }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, { credentials: "same-origin", signal: controller.signal });
          const text = await response.text();
          let body = null;
          try {
            body = JSON.parse(text);
          } catch {
            // 由调用端给出不暴露响应正文的安全错误。
          }
          return {
            status: response.status,
            retryAfter: response.headers.get("retry-after"),
            body
          };
        } finally {
          clearTimeout(timer);
        }
      }, { url: requestUrl, timeoutMs: REQUEST_TIMEOUT_MS });

      if (![429, 502, 503, 504].includes(result.status) || attempt === MAX_REQUEST_ATTEMPTS) return result;
      const retryAfterSeconds = Number(result.retryAfter);
      await delay(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1_000 : attempt * 750);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_REQUEST_ATTEMPTS) await delay(attempt * 750);
    }
  }

  throw new Error(`${label} 请求未完成：${lastError?.message ?? "网络连接异常"}`);
}

function decodePayload(value, label) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error(`${label} 未返回可解析的数据。`);

  try {
    const text = value.startsWith("H4sI")
      ? gunzipSync(Buffer.from(value, "base64")).toString("utf8")
      : value;
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} 的返回格式无法解析，飞书页面数据格式可能已变化。`);
  }
}

function extractData(response, key, label) {
  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(`${label} 请求失败（HTTP ${response?.status ?? "未知"}）。请确认公开链接有效，或已在临时浏览器中完成登录。`);
  }
  if (response.body?.code !== undefined && response.body.code !== 0) {
    throw new Error(`${label} 被飞书拒绝（错误码 ${response.body.code}）。请确认链接、权限和登录状态。`);
  }

  const payload = response.body?.data?.[key];
  if (payload === null || payload === undefined) {
    throw new Error(`${label} 未返回预期数据。飞书页面数据格式可能已变化。`);
  }
  return decodePayload(payload, label);
}

function requestUrl(target, endpoint, parameters) {
  const apiUrl = new URL(`/space/api/v1/bitable/${encodeURIComponent(target.baseToken)}/${endpoint}`, target.url.origin);
  for (const [key, value] of Object.entries(parameters)) apiUrl.searchParams.set(key, String(value));
  return apiUrl.toString();
}

function buildClientvarsUrl(target) {
  return requestUrl(target, "clientvars", {
    tableID: target.tableId,
    viewID: target.viewId,
    recordLimit: INITIAL_RECORD_LIMIT,
    ondemandLimit: INITIAL_RECORD_LIMIT,
    needBase: true,
    viewLazyLoad: true,
    ondemandVer: 2,
    openType: 0,
    noMissCS: true,
    optimizationFlag: 1,
    removeFmlExtra: true
  });
}

function buildRecordsUrl(target, tableRevision, offset) {
  return requestUrl(target, "records", {
    tableId: target.tableId,
    viewId: target.viewId,
    tableRev: tableRevision,
    depRev: "{}",
    viewLazyLoad: true,
    offset,
    limit: PAGE_SIZE,
    tableID: target.tableId,
    viewID: target.viewId,
    removeFmlExtra: true
  });
}

function hasActiveFilter(view) {
  const filterInfo = view?.property?.filterInfo;
  if (filterInfo === null || filterInfo === undefined) return false;
  if (Array.isArray(filterInfo)) return filterInfo.length > 0;
  return typeof filterInfo === "object" ? Object.keys(filterInfo).length > 0 : Boolean(filterInfo);
}

function assertTableStructure(table, target) {
  const view = table?.viewMap?.[target.viewId];
  if (!table?.meta || !view?.property?.fields || !table?.fieldMap) {
    throw new Error("未能在授权页面中读取目标表的字段和视图信息。请确认当前链接仍指向有效视图。");
  }

  const sourceRecordCount = Number(table.meta.recordsNum);
  const expectedRecords = hasActiveFilter(view) ? null : sourceRecordCount;
  if (expectedRecords !== null && (!Number.isSafeInteger(expectedRecords) || expectedRecords < 0)) {
    throw new Error("目标表未提供可校验的记录总数，已停止导出以避免生成不完整文件。");
  }

  const tableRevision = table.meta.rev;
  if (tableRevision === undefined || tableRevision === null) {
    throw new Error("目标表未提供当前修订版本，无法安全读取后续记录。");
  }
  return { view, expectedRecords, tableRevision };
}

function normalizeRecords(payload) {
  const recordMap = payload?.recordMap;
  if (!recordMap || typeof recordMap !== "object" || Array.isArray(recordMap)) {
    throw new Error("后续记录未返回 recordMap，飞书页面数据格式可能已变化。");
  }

  const numericValue = [
    payload.nextOffset,
    payload.offset,
    payload.pageInfo?.nextOffset,
    payload.pageInfo?.offset
  ].find((value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0);
  const hasMore = [payload.hasMore, payload.pageInfo?.hasMore].find((value) => typeof value === "boolean");

  return {
    recordMap,
    rankMap: payload?.rankInfo?.rankMap ?? {},
    pageCount: Object.keys(recordMap).length,
    hasMore,
    nextOffset: numericValue === undefined ? null : Number(numericValue)
  };
}

function mergeRecordMaps(target, source) {
  for (const [recordId, record] of Object.entries(source ?? {})) target.set(recordId, record);
}

function completedResult(records, ranks, expectedRecords, completedBy) {
  if (expectedRecords !== null && records.size !== expectedRecords) {
    throw new Error(`记录数校验失败：预期 ${expectedRecords} 条，实际读取 ${records.size} 条。已停止生成 Excel。`);
  }
  return { records, ranks, completedBy };
}

async function collectRecords(page, target, table, expectedRecords, tableRevision) {
  const initialBatch = normalizeRecords({ recordMap: table.recordMap ?? {}, rankInfo: table.rankInfo ?? {} });
  const records = new Map();
  const ranks = {};
  mergeRecordMaps(records, initialBatch.recordMap);
  Object.assign(ranks, initialBatch.rankMap);

  if (expectedRecords === 0) return completedResult(records, ranks, expectedRecords, "metadata");
  if (expectedRecords !== null && records.size === expectedRecords) return completedResult(records, ranks, expectedRecords, "metadata");

  let offset = Math.max(0, initialBatch.pageCount - 1);
  const seenOffsets = new Set();
  for (let pageNumber = 0; pageNumber < MAX_PAGE_REQUESTS; pageNumber += 1) {
    if (seenOffsets.has(offset)) throw new Error("后续记录分页位置重复，已停止以避免遗漏或重复导出。");
    seenOffsets.add(offset);

    const before = records.size;
    const response = await fetchJsonInPage(page, buildRecordsUrl(target, tableRevision, offset), "后续记录");
    const batch = normalizeRecords(extractData(response, "records", "后续记录"));
    mergeRecordMaps(records, batch.recordMap);
    Object.assign(ranks, batch.rankMap);

    if (expectedRecords !== null && records.size === expectedRecords) {
      return completedResult(records, ranks, expectedRecords, "metadata");
    }
    if (batch.hasMore === false) return completedResult(records, ranks, expectedRecords, "server");

    const nextOffset = batch.nextOffset !== null && batch.nextOffset > offset
      ? batch.nextOffset
      : offset + Math.max(1, batch.pageCount - 1);
    if (records.size === before && nextOffset === offset + 1 && batch.pageCount <= 1) {
      throw new Error(`后续记录未增加（已读取 ${before} 条），且服务端未提供可继续的分页信息。`);
    }

    if (expectedRecords === null && batch.hasMore === undefined) {
      throw new Error("筛选视图未提供可验证的分页结束信息，已停止以避免生成不完整工作簿。");
    }
    offset = nextOffset;
  }

  throw new Error(`后续记录请求超过 ${MAX_PAGE_REQUESTS} 页安全上限，已停止以避免生成不完整工作簿。`);
}

function visibleFieldIds(table, view) {
  return view.property.fields.filter((fieldId) => !view.property.colInfos?.[fieldId]?.hidden);
}

function optionMapsFor(table, fieldIds) {
  return Object.fromEntries(fieldIds.map((fieldId) => {
    const options = table.fieldMap[fieldId]?.property?.options ?? [];
    return [fieldId, Object.fromEntries(options.map((option) => [option.id, option.name]))];
  }));
}

function fieldValue(record, fieldId) {
  const cell = record?.fields?.[fieldId] ?? record?.[fieldId];
  if (cell && typeof cell === "object" && "value" in cell) return cell.value;
  return cell;
}

function containsAnyVisibleField(records, fieldIds) {
  for (const record of records.values()) {
    if (fieldIds.some((fieldId) => record?.fields?.[fieldId] !== undefined || record?.[fieldId] !== undefined)) return true;
  }
  return false;
}

function asSafeText(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function extractCell(value, optionMap) {
  if (value === null || value === undefined) return { value: "", hyperlink: null };
  if (typeof value === "number" || typeof value === "boolean") return { value, hyperlink: null };

  const pieces = Array.isArray(value) ? value : [value];
  const texts = [];
  const links = [];

  for (const piece of pieces) {
    if (piece === null || piece === undefined) continue;
    if (typeof piece === "string") {
      const text = String(optionMap[piece] ?? piece);
      texts.push(text);
      if (/^https?:\/\//i.test(text)) links.push(text);
      continue;
    }
    if (typeof piece === "number" || typeof piece === "boolean") {
      texts.push(String(optionMap[piece] ?? piece));
      continue;
    }
    if (typeof piece === "object") {
      const text = piece.text ?? piece.name ?? piece.label ?? piece.id ?? JSON.stringify(piece);
      texts.push(String(text));
      const link = piece.link ?? piece.url;
      if (typeof link === "string" && /^https?:\/\//i.test(link)) links.push(link);
    }
  }

  return { value: asSafeText(texts.join("；")), hyperlink: links.length === 1 ? links[0] : null };
}

function sortedRecordIds(records, ranks) {
  return [...records.keys()].sort((left, right) => String(ranks[left] ?? left).localeCompare(String(ranks[right] ?? right)));
}

function sheetName(value) {
  const normalized = String(value ?? "Bitable Export")
    .replace(/[\x00-\x1F\\/:*?\[\]]/g, " ")
    .trim();
  return (normalized || "Bitable Export").slice(0, 31);
}

function columnWidth(header, cells, sourceWidth) {
  const samples = cells.slice(0, 300).map((cell) => String(cell.value).replace(/^'/, ""));
  const textWidth = Math.max(String(header).length, ...samples.map((value) => Math.min(value.length, 60))) + 2;
  const viewWidth = Number(sourceWidth) > 0 ? Number(sourceWidth) / 8.5 : 0;
  return Math.max(12, Math.min(55, Math.max(textWidth, viewWidth)));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertOutputPath(outputPath, force) {
  if (path.extname(outputPath).toLowerCase() !== ".xlsx") throw new Error("输出文件必须使用 .xlsx 扩展名。");
  if (await pathExists(outputPath) && !force) {
    throw new Error(`输出文件已存在：${path.basename(outputPath)}。如确认覆盖，请加 --force。`);
  }
}

async function writeWorkbook({ table, view, fieldIds, records, ranks, outputPath, force }) {
  if (records.size > 0 && fieldIds.length > 0 && !containsAnyVisibleField(records, fieldIds)) {
    throw new Error("记录字段结构不兼容，未生成工作簿以避免导出空白数据。");
  }

  const optionMaps = optionMapsFor(table, fieldIds);
  const headers = fieldIds.map((fieldId) => table.fieldMap[fieldId]?.name ?? fieldId);
  const rowData = sortedRecordIds(records, ranks).map((recordId) => {
    const record = records.get(recordId) ?? {};
    return fieldIds.map((fieldId) => extractCell(fieldValue(record, fieldId), optionMaps[fieldId] ?? {}));
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "feishu-bitable-export";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName(view.name ?? table.meta.name));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.addRow(headers);

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    cell.alignment = { horizontal: "center", vertical: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD9E2F3" } } };
  });

  for (const cells of rowData) {
    const row = worksheet.addRow(cells.map((cell) => cell.value));
    cells.forEach((cellData, index) => {
      const cell = row.getCell(index + 1);
      if (cellData.hyperlink) {
        cell.value = { text: String(cellData.value), hyperlink: cellData.hyperlink };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD9E2F3" } } };
    });
  }

  fieldIds.forEach((fieldId, index) => {
    const sourceWidth = view.property.colInfos?.[fieldId]?.width;
    worksheet.getColumn(index + 1).width = columnWidth(headers[index], rowData.map((row) => row[index]), sourceWidth);
  });
  if (headers.length > 0) worksheet.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp.xlsx`
  );
  try {
    await workbook.xlsx.writeFile(temporaryPath);
    if (await pathExists(outputPath)) {
      if (!force) throw new Error(`输出文件已存在：${path.basename(outputPath)}。如确认覆盖，请加 --force。`);
      await fs.unlink(outputPath);
    }
    await fs.rename(temporaryPath, outputPath);
  } finally {
    if (await pathExists(temporaryPath)) await fs.unlink(temporaryPath);
  }

  return { rows: rowData.length, columns: headers.length, sheetName: worksheet.name };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const target = parseTarget(options.sourceUrl);
  const outputPath = path.resolve(options.outputPath);
  await assertOutputPath(outputPath, options.force);

  let browser;
  try {
    browser = await chromium.launch({ headless: options.headless });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.goto(target.url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1_000);
    if (!options.noPrompt) await waitForUser();

    const clientvarsResponse = await fetchJsonInPage(page, buildClientvarsUrl(target), "表格元数据");
    const table = extractData(clientvarsResponse, "table", "表格元数据");
    const { view, expectedRecords, tableRevision } = assertTableStructure(table, target);
    const { records, ranks } = await collectRecords(page, target, table, expectedRecords, tableRevision);
    const fieldIds = visibleFieldIds(table, view);
    const result = await writeWorkbook({ table, view, fieldIds, records, ranks, outputPath, force: options.force });

    console.log(JSON.stringify({ output: outputPath, ...result }, null, 2));
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(`导出失败：${error.message}`);
  process.exitCode = 1;
});
