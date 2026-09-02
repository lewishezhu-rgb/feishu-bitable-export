import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

function usage() {
  return "用法：npm run check-workbook -- <文件.xlsx> [--rows <含标题总行数>] [--columns <列数>]";
}

function parseArguments(args) {
  const options = { filePath: null, rows: null, columns: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (argument === "--rows" || argument === "--columns") {
      const value = Number(args[++index]);
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${argument} 必须是正整数。`);
      options[argument.slice(2)] = value;
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`不支持的参数：${argument}`);
    if (options.filePath) throw new Error(usage());
    options.filePath = argument;
  }
  if (!options.filePath || path.extname(options.filePath).toLowerCase() !== ".xlsx") throw new Error(usage());
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await fs.access(options.filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(options.filePath);
  if (workbook.worksheets.length !== 1) throw new Error("工作簿必须只包含一个工作表。");
  const sheet = workbook.worksheets[0];
  const rowCount = sheet.rowCount;
  const columnCount = sheet.columnCount;
  const hasFrozenHeader = sheet.views.some((view) => Number(view.ySplit) === 1);
  const hasAutoFilter = Boolean(sheet.autoFilter?.ref || sheet.autoFilter);
  const formulaErrors = [];
  let hyperlinks = 0;
  sheet.eachRow((row) => row.eachCell((cell) => {
    const value = typeof cell.value === "string" ? cell.value : "";
    if (/^#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/.test(value)) formulaErrors.push(cell.address);
    if (cell.hyperlink) hyperlinks += 1;
  }));
  if (options.rows !== null && rowCount !== options.rows) throw new Error(`行数不符：预期 ${options.rows}，实际 ${rowCount}。`);
  if (options.columns !== null && columnCount !== options.columns) throw new Error(`列数不符：预期 ${options.columns}，实际 ${columnCount}。`);
  if (!hasFrozenHeader) throw new Error("未检测到冻结首行。");
  if (!hasAutoFilter) throw new Error("未检测到自动筛选范围。");
  if (formulaErrors.length > 0) throw new Error(`检测到 Excel 错误值：${formulaErrors.slice(0, 5).join(", ")}`);
  console.log(JSON.stringify({ sheet: sheet.name, rows: rowCount, columns: columnCount, hyperlinks, frozenHeader: true, autoFilter: true, formulaErrors: 0 }, null, 2));
}

main().catch((error) => {
  console.error(`工作簿校验失败：${error.message}`);
  process.exitCode = 1;
});
