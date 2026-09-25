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
    "用法：npm run export -- <飞书多维表格或内嵌多维表格 Wiki URL> [--output <文件.xlsx>] [--force] [--no-prompt] [--headless] [--include-media yes|no]",
    "支持 /base/<BASE>?table=<TABLE>&view=<VIEW>，以及带 table/view 参数且当前页面实际显示该多维表格的 /wiki/<NODE> 链接。",
    "默认导出媒体：可读取图片嵌入 Excel；附件、视频和音频保存到同名 .media 文件夹并在单元格中保留链接。",
    "默认打开隔离浏览器；如目标页面需要权限，请在窗口中手动登录后按回车继续。"
  ].join("\n");
}

function parseArguments(args) {
  const options = { sourceUrl: null, outputPath: DEFAULT_OUTPUT, force: false, noPrompt: false, headless: false, includeMedia: true };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") { console.log(usage()); process.exit(0); }
    if (argument === "--output" || argument === "-o") {
      const value = args[++index];
      if (!value || value.startsWith("-")) throw new Error("--output 缺少文件路径。");
      options.outputPath = value;
      continue;
    }
    if (argument === "--include-media") {
      const value = args[++index];
      if (!['yes', 'no'].includes(value)) throw new Error("--include-media 仅支持 yes 或 no。");
      options.includeMedia = value === "yes";
      continue;
    }
    if (argument === "--force") { options.force = true; continue; }
    if (argument === "--no-prompt") { options.noPrompt = true; continue; }
    if (argument === "--headless") { options.headless = true; continue; }
    if (argument.startsWith("-")) throw new Error(`不支持的参数：${argument}`);
    if (options.sourceUrl) throw new Error("一次只能提供一个飞书链接。\n" + usage());
    options.sourceUrl = argument;
  }
  if (!options.sourceUrl) throw new Error(usage());
  if (options.headless) options.noPrompt = true;
  return options;
}

function parseTarget(sourceUrl) {
  let url;
  try { url = new URL(sourceUrl); } catch { throw new Error("请输入完整的飞书多维表格或 Wiki 链接。"); }
  if (url.protocol !== "https:" || !/(^|\.)feishu\.cn$/i.test(url.hostname)) throw new Error("仅支持 HTTPS 的飞书中国站链接（*.feishu.cn）。");
  const route = url.pathname.match(/^\/(base|wiki)\/([^/?#]+)/)?.[1];
  const token = url.pathname.match(/^\/(?:base|wiki)\/([^/?#]+)/)?.[1];
  const tableId = url.searchParams.get("table");
  const viewId = url.searchParams.get("view");
  if (!route || !token || !tableId || !viewId) throw new Error("链接必须包含 /base 或 /wiki、table 与 view；请复制当前显示多维表格的完整地址。");
  return { url, route, baseToken: route === "base" ? token : null, wikiToken: route === "wiki" ? token : null, tableId, viewId };
}

async function waitForUser() {
  const terminal = createInterface({ input, output });
  try { await terminal.question("请在新打开的隔离浏览器中确认当前链接显示目标多维表格；如需权限请手动登录。完成后按回车继续："); } finally { terminal.close(); }
}

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

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
          try { body = JSON.parse(text); } catch { /* response bodies are never logged */ }
          return { status: response.status, retryAfter: response.headers.get("retry-after"), body };
        } finally { clearTimeout(timer); }
      }, { url: requestUrl, timeoutMs: REQUEST_TIMEOUT_MS });
      if (![429, 502, 503, 504].includes(result.status) || attempt === MAX_REQUEST_ATTEMPTS) return result;
      const retryAfter = Number(result.retryAfter);
      await delay(Number.isFinite(retryAfter) ? retryAfter * 1_000 : attempt * 750);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_REQUEST_ATTEMPTS) await delay(attempt * 750);
    }
  }
  throw new Error(`${label} 请求未完成：${lastError?.message ?? "网络连接异常"}`);
}

function decodePayload(value, label) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error(`${label} 未返回可解析数据。`);
  try {
    const text = value.startsWith("H4sI") ? gunzipSync(Buffer.from(value, "base64")).toString("utf8") : value;
    return JSON.parse(text);
  } catch { throw new Error(`${label} 的页面数据格式无法解析。`); }
}

function extractData(response, key, label) {
  if (!response || response.status < 200 || response.status >= 300) throw new Error(`${label} 请求失败（HTTP ${response?.status ?? "未知"}）。请确认已在隔离浏览器中拥有查看权限。`);
  if (response.body?.code !== undefined && response.body.code !== 0) throw new Error(`${label} 被飞书拒绝（错误码 ${response.body.code}）。请确认链接、权限和登录状态。`);
  const payload = response.body?.data?.[key];
  if (payload === null || payload === undefined) throw new Error(`${label} 未返回预期数据。当前页面可能未实际显示目标多维表格。`);
  return decodePayload(payload, label);
}

function requestUrl(target, endpoint, parameters) {
  const apiUrl = new URL(`/space/api/v1/bitable/${encodeURIComponent(target.baseToken)}/${endpoint}`, target.url.origin);
  for (const [key, value] of Object.entries(parameters)) apiUrl.searchParams.set(key, String(value));
  return apiUrl.toString();
}

function buildClientvarsUrl(target) {
  return requestUrl(target, "clientvars", { tableID: target.tableId, viewID: target.viewId, recordLimit: INITIAL_RECORD_LIMIT, ondemandLimit: INITIAL_RECORD_LIMIT, needBase: true, viewLazyLoad: true, ondemandVer: 2, openType: 0, noMissCS: true, optimizationFlag: 1, removeFmlExtra: true });
}

function buildRecordsUrl(target, tableRevision, offset) {
  return requestUrl(target, "records", { tableId: target.tableId, viewId: target.viewId, tableRev: tableRevision, depRev: "{}", viewLazyLoad: true, offset, limit: PAGE_SIZE, tableID: target.tableId, viewID: target.viewId, removeFmlExtra: true });
}

async function resolveWikiBase(page, target, networkBases) {
  if (target.baseToken) return target.baseToken;
  const candidates = await page.evaluate(() => {
    const values = [];
    for (const element of document.querySelectorAll("a[href], iframe[src], [data-url], [data-href]")) {
      for (const value of [element.href, element.src, element.dataset?.url, element.dataset?.href]) if (value) values.push(value);
    }
    for (const entry of performance.getEntriesByType("resource")) values.push(entry.name);
    return values;
  });
  const candidateTokens = candidates
    .map((value) => /\/bitable\/([^/?#]+)|\/base\/([^/?#]+)/.exec(value))
    .filter(Boolean)
    .map((match) => match[1] ?? match[2]);
  const tokens = [...new Set([...networkBases, ...candidateTokens])]
    .filter((token) => token && token !== target.wikiToken);
  const valid = [];
  for (const token of tokens) {
    const probeTarget = { ...target, baseToken: token };
    const response = await fetchJsonInPage(page, buildClientvarsUrl(probeTarget), "Wiki 内嵌多维表格识别");
    if (response.status >= 200 && response.status < 300 && response.body?.code === 0 && response.body?.data?.table) valid.push(token);
  }
  if (valid.length === 1) return valid[0];
  if (valid.length > 1) throw new Error("当前 Wiki 页面显示多个可用多维表格，无法自动判断与 table/view 对应的表。请在目标表中选择“打开多维表格”后复制完整链接。");
  throw new Error("当前 Wiki 页面未暴露可验证的多维表格 Base 标识。请确认该链接打开后实际显示目标多维表格，并在隔离浏览器中完成登录后重试。");
}

function hasActiveFilter(view) {
  const filterInfo = view?.property?.filterInfo;
  if (filterInfo === null || filterInfo === undefined) return false;
  const conditions = Array.isArray(filterInfo) ? filterInfo : Array.isArray(filterInfo.conditions) ? filterInfo.conditions : [];
  if (conditions.length) return conditions.some((condition) => {
    const value = condition?.value;
    return value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0) && value !== "";
  });
  return Boolean(filterInfo && typeof filterInfo !== "object");
}

function assertTableStructure(table, target) {
  const view = table?.viewMap?.[target.viewId];
  if (!table?.meta || !view?.property?.fields || !table?.fieldMap) throw new Error("未能在当前授权页面中读取目标表的字段和视图信息。");
  const expectedRecords = hasActiveFilter(view) ? null : Number(table.meta.recordsNum);
  if (expectedRecords !== null && (!Number.isSafeInteger(expectedRecords) || expectedRecords < 0)) throw new Error("目标表未提供可校验的记录总数，已停止导出。");
  if (table.meta.rev === undefined || table.meta.rev === null) throw new Error("目标表未提供当前修订版本，无法安全读取后续记录。");
  return { view, expectedRecords, tableRevision: table.meta.rev };
}

function normalizeRecords(payload) {
  const recordMap = payload?.recordMap;
  if (!recordMap || typeof recordMap !== "object" || Array.isArray(recordMap)) throw new Error("后续记录未返回 recordMap，飞书页面数据格式可能已变化。");
  const nextOffset = [payload.nextOffset, payload.pageInfo?.nextOffset].find((value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0);
  const hasMore = [payload.hasMore, payload.pageInfo?.hasMore].find((value) => typeof value === "boolean");
  return { recordMap, rankMap: payload?.rankInfo?.rankMap ?? {}, pageCount: Object.keys(recordMap).length, hasMore, nextOffset: nextOffset === undefined ? null : Number(nextOffset) };
}

function mergeRecordMaps(target, source) { for (const [recordId, record] of Object.entries(source ?? {})) target.set(recordId, record); }

async function collectRecords(page, target, table, expectedRecords, tableRevision) {
  const records = new Map(); const ranks = {};
  const initial = normalizeRecords({ recordMap: table.recordMap ?? {}, rankInfo: table.rankInfo ?? {} });
  mergeRecordMaps(records, initial.recordMap); Object.assign(ranks, initial.rankMap);
  if (expectedRecords === 0 || (expectedRecords !== null && records.size === expectedRecords)) return { records, ranks };
  let offset = Math.max(0, initial.pageCount - 1); const seenOffsets = new Set();
  for (let pageNumber = 0; pageNumber < MAX_PAGE_REQUESTS; pageNumber += 1) {
    if (seenOffsets.has(offset)) throw new Error("后续记录分页位置重复，已停止以避免遗漏或重复导出。");
    seenOffsets.add(offset);
    const before = records.size;
    const batch = normalizeRecords(extractData(await fetchJsonInPage(page, buildRecordsUrl(target, tableRevision, offset), "后续记录"), "records", "后续记录"));
    mergeRecordMaps(records, batch.recordMap); Object.assign(ranks, batch.rankMap);
    if (expectedRecords !== null && records.size === expectedRecords) return { records, ranks };
    if (batch.hasMore === false) {
      if (expectedRecords === null) return { records, ranks };
      break;
    }
    if (expectedRecords === null && batch.hasMore === undefined) throw new Error("筛选视图未提供可验证的分页结束信息，已停止以避免生成不完整工作簿。");
    const next = batch.nextOffset !== null && batch.nextOffset > offset ? batch.nextOffset : offset + Math.max(1, batch.pageCount - 1);
    if (records.size === before && next === offset + 1 && batch.pageCount <= 1) throw new Error(`后续记录未增加（已读取 ${before} 条），已停止导出。`);
    offset = next;
  }
  if (expectedRecords !== null && records.size !== expectedRecords) throw new Error(`记录数校验失败：预期 ${expectedRecords} 条，实际读取 ${records.size} 条。已停止生成 Excel。`);
  throw new Error(`后续记录请求超过 ${MAX_PAGE_REQUESTS} 页安全上限，已停止生成 Excel。`);
}

function optionMapsFor(table, fieldIds) { return Object.fromEntries(fieldIds.map((fieldId) => [fieldId, Object.fromEntries((table.fieldMap[fieldId]?.property?.options ?? []).map((option) => [option.id, option.name]))])); }
function fieldValue(record, fieldId) { const cell = record?.fields?.[fieldId] ?? record?.[fieldId]; return cell && typeof cell === "object" && "value" in cell ? cell.value : cell; }
function safeText(value) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function safeUrl(value) { return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null; }

function extractCell(value, optionMap, rowIndex, columnIndex, includeMedia) {
  if (value === null || value === undefined) return { value: "", hyperlink: null, media: [] };
  if (typeof value === "number" || typeof value === "boolean") return { value, hyperlink: null, media: [] };
  const texts = []; const links = []; const media = [];
  for (const piece of (Array.isArray(value) ? value : [value])) {
    if (piece === null || piece === undefined) continue;
    if (typeof piece === "string") { const text = String(optionMap[piece] ?? piece); texts.push(text); if (safeUrl(text)) links.push(text); continue; }
    if (typeof piece === "number" || typeof piece === "boolean") { texts.push(String(optionMap[piece] ?? piece)); continue; }
    const text = piece.text ?? piece.name ?? piece.label ?? piece.id ?? JSON.stringify(piece);
    texts.push(String(text));
    const link = safeUrl(piece.link ?? piece.url ?? piece.download_url ?? piece.file_url);
    if (link) links.push(link);
    if (includeMedia && (piece.file_token || piece.token || piece.mime_type || piece.type === "image" || piece.width || piece.height)) media.push({ name: String(piece.name ?? piece.text ?? `media-${rowIndex}-${columnIndex}`), url: link, row: rowIndex, column: columnIndex, width: Number(piece.width) || null, height: Number(piece.height) || null });
  }
  return { value: safeText(texts.join("；")), hyperlink: links.length === 1 ? links[0] : null, media };
}

function sheetName(value) { const clean = String(value ?? "Bitable Export").replace(/[\x00-\x1F\\/:*?\[\]]/g, " ").trim(); return (clean || "Bitable Export").slice(0, 31); }
function columnWidth(header, cells, sourceWidth) { const samples = cells.slice(0, 300).map((cell) => String(cell.value).replace(/^'/, "")); return Math.max(12, Math.min(55, Math.max(Number(sourceWidth) > 0 ? Number(sourceWidth) / 8.5 : 0, String(header).length + 2, ...samples.map((value) => Math.min(value.length, 60) + 2)))); }
async function pathExists(filePath) { try { await fs.access(filePath); return true; } catch { return false; } }

async function downloadMedia(page, items, mediaDirectory) {
  const results = [];
  for (const [index, item] of items.entries()) {
    if (!item.url) { results.push({ ...item, error: "页面未提供可读取链接" }); continue; }
    const result = await page.evaluate(async (url) => { try { const response = await fetch(url, { credentials: "same-origin" }); if (!response.ok) return { ok: false }; const bytes = await response.arrayBuffer(); return { ok: true, type: response.headers.get("content-type")?.split(";")[0] ?? "", bytes: Array.from(new Uint8Array(bytes)) }; } catch { return { ok: false }; } }, item.url);
    if (!result.ok) { results.push({ ...item, error: "无法读取媒体" }); continue; }
    const ext = ({ "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "video/mp4": ".mp4", "audio/mpeg": ".mp3", "application/pdf": ".pdf" })[result.type] || path.extname(new URL(item.url).pathname) || ".bin";
    const safeName = item.name.replace(/[\x00-\x1F<>:"/\\|?*]/g, " ").trim().slice(0, 100) || `media-${index + 1}`;
    const localPath = path.join(mediaDirectory, `${index + 1}-${safeName}${ext}`);
    await fs.writeFile(localPath, Buffer.from(result.bytes));
    results.push({ ...item, localPath, contentType: result.type });
  }
  return results;
}

async function writeWorkbook({ table, view, fieldIds, records, ranks, outputPath, force, page, includeMedia }) {
  const optionMaps = optionMapsFor(table, fieldIds);
  const headers = fieldIds.map((fieldId) => safeText(table.fieldMap[fieldId]?.name ?? fieldId));
  const media = [];
  const recordIds = [...records.keys()].sort((left, right) => String(ranks[left] ?? left).localeCompare(String(ranks[right] ?? right)));
  const rowData = recordIds.map((recordId, rowOffset) => fieldIds.map((fieldId, columnOffset) => {
    const cell = extractCell(fieldValue(records.get(recordId), fieldId), optionMaps[fieldId] ?? {}, rowOffset + 2, columnOffset + 1, includeMedia);
    media.push(...cell.media);
    return cell;
  }));
  const workbook = new ExcelJS.Workbook(); workbook.creator = "feishu-bitable-export"; workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName(view.name ?? table.meta.name)); worksheet.views = [{ state: "frozen", ySplit: 1 }]; worksheet.addRow(headers);
  const headerRow = worksheet.getRow(1); headerRow.height = 28; headerRow.eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } }; cell.alignment = { horizontal: "center", vertical: "center", wrapText: true }; });
  for (const cells of rowData) { const row = worksheet.addRow(cells.map((cell) => cell.value)); cells.forEach((data, index) => { const cell = row.getCell(index + 1); if (data.hyperlink) { cell.value = { text: String(data.value), hyperlink: data.hyperlink }; cell.font = { color: { argb: "FF0563C1" }, underline: true }; } cell.alignment = { vertical: "top", wrapText: true }; }); }
  fieldIds.forEach((fieldId, index) => { worksheet.getColumn(index + 1).width = columnWidth(headers[index], rowData.map((row) => row[index]), view.property.colInfos?.[fieldId]?.width); });
  worksheet.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };

  const mediaDirectory = `${outputPath.slice(0, -5)}.media`;
  if (includeMedia && media.length) await fs.mkdir(mediaDirectory, { recursive: true });
  const downloaded = includeMedia && media.length ? await downloadMedia(page, media, mediaDirectory) : [];
  for (const item of downloaded.filter((entry) => entry.localPath && entry.contentType.startsWith("image/"))) {
    try { const imageId = workbook.addImage({ filename: item.localPath, extension: item.contentType.split("/")[1] === "jpeg" ? "jpeg" : item.contentType.split("/")[1] }); worksheet.addImage(imageId, { tl: { col: item.column - 1, row: item.row - 1 }, ext: { width: Math.min(item.width ?? 160, 320), height: Math.min(item.height ?? 120, 240) } }); worksheet.getRow(item.row).height = Math.max(worksheet.getRow(item.row).height ?? 15, Math.min(item.height ?? 120, 240)); } catch { item.error = "图片无法嵌入 Excel"; }
  }
  for (const item of downloaded.filter((entry) => entry.error)) { const cell = worksheet.getCell(item.row, item.column); cell.note = item.error + (item.url ? `；原链接：${item.url}` : ""); }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp.xlsx`);
  try { await workbook.xlsx.writeFile(temporaryPath); if (await pathExists(outputPath)) { if (!force) throw new Error(`输出文件已存在：${path.basename(outputPath)}。如确认覆盖，请加 --force。`); await fs.unlink(outputPath); } await fs.rename(temporaryPath, outputPath); } finally { await fs.rm(temporaryPath, { force: true }); }
  return { rows: rowData.length, columns: headers.length, sheetName: worksheet.name, media: { downloaded: downloaded.filter((item) => item.localPath).length, unavailable: downloaded.filter((item) => item.error).length, directory: downloaded.some((item) => item.localPath) ? mediaDirectory : null } };
}

async function main() {
  const options = parseArguments(process.argv.slice(2)); const target = parseTarget(options.sourceUrl); const outputPath = path.resolve(options.outputPath);
  if (path.extname(outputPath).toLowerCase() !== ".xlsx") throw new Error("输出文件必须使用 .xlsx 扩展名。");
  if (await pathExists(outputPath) && !options.force) throw new Error(`输出文件已存在：${path.basename(outputPath)}。如确认覆盖，请加 --force。`);
  const networkBases = new Set(); let browser;
  try {
    browser = await chromium.launch({ headless: options.headless }); const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } }); const page = await context.newPage();
    page.on("response", (response) => { const match = /\/space\/api\/v1\/bitable\/([^/?#]+)/.exec(response.url()); if (match) networkBases.add(match[1]); });
    await page.goto(target.url.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 }); await page.waitForTimeout(1_500);
    if (!options.noPrompt) { await waitForUser(); await page.waitForTimeout(1_000); }
    target.baseToken = await resolveWikiBase(page, target, networkBases);
    const table = extractData(await fetchJsonInPage(page, buildClientvarsUrl(target), "表格元数据"), "table", "表格元数据");
    const { view, expectedRecords, tableRevision } = assertTableStructure(table, target); const { records, ranks } = await collectRecords(page, target, table, expectedRecords, tableRevision); const fieldIds = view.property.fields.filter((fieldId) => !view.property.colInfos?.[fieldId]?.hidden);
    const result = await writeWorkbook({ table, view, fieldIds, records, ranks, outputPath, force: options.force, page, includeMedia: options.includeMedia });
    console.log(JSON.stringify({ output: outputPath, ...result }, null, 2));
  } finally { await browser?.close(); }
}

main().catch((error) => { console.error(`导出失败：${error.message}`); process.exitCode = 1; });
