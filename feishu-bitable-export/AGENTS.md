# Feishu Bitable Export Skill

## Purpose

Export one user-authorized Feishu Bitable view to a locally saved XLSX workbook with isolation and completeness checks.

## Activate when

The user asks to export, download, archive, or convert a Feishu/Lark Bitable view into Excel/XLSX.

## Use

1. Require a complete `https://*.feishu.cn/base/...?...table=...&view=...` URL and an output path.
2. Run `npm ci`, then `npm run setup-browser` once per fresh environment.
3. Run `npm run export -- "<URL>" --output "<file.xlsx>"`.
4. Use `--headless --no-prompt` only for anonymous public views. For any sign-in page, keep a visible isolated browser and let the user log in there.
5. Run `npm run check-workbook -- "<file.xlsx>"` after export.

## Boundaries

- Do not use persistent browser profiles, cookies, `storage-state`, browser extensions, DOM copying, or clipboard automation.
- Do not bypass access controls or export a view the user cannot legitimately read.
- Do not produce a workbook when record completeness, pagination, or field structure cannot be verified.
- Do not overwrite existing output without explicit `--force` approval.

## Gotchas

- “Public” share links may still require sign-in for data API requests.
- Initial table metadata can hold only a partial record map.
- Active filters cannot be validated from table-level record counts alone.
