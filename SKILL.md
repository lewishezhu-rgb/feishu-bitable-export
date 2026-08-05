---
name: feishu-bitable-export
description: "This skill should be used to export all rows from a Feishu Bitable view to an XLSX workbook through a user-authorized Playwright browser session, without bypassing access controls or retaining user data."
description_zh: "飞书多维表格授权导出"
description_en: "Feishu Bitable authorized export"
disable: false
agent_created: true
---

# feishu-bitable-export

## When to use

Use this workflow when exporting a Feishu Bitable link to Excel for a user who has legitimate view access, especially when no suitable Bitable connector is available.

## Privacy boundary

- Collect only the data necessary to produce the requested export.
- Keep account sessions inside an isolated, in-memory browser session.
- Exclude user names, email addresses, cookies, browser profiles, API headers, table identifiers, source URLs, output data, and local absolute paths from this skill package and its logs.
- Delete or securely retain temporary export data only according to the user's instructions.
- Use the isolated Playwright MCP template in @templates/playwright-mcp.json. Review @references/playwright-mcp.md before configuring the MCP server.

## Steps

1. Install and enable the MCP server with @templates/playwright-mcp.json. Keep the `--isolated` argument; it starts each run without saved cookies or a reusable browser profile.
2. Open the user-provided Bitable URL in the headed browser created by Playwright MCP. Do not copy cookies or reuse the user's ordinary browser profile.
3. Ask the user to complete sign-in in the opened Chrome window. Confirm that the expected Bitable URL loads without a login redirect.
4. Request the Bitable `clientvars` endpoint for the target table and view from the authorized browser context. Decode `data.table`; the payload may be a base64 gzip JSON string.
5. Read table metadata, view field order, field definitions, the first record batch, and the table revision from the decoded table object.
6. Request the `records` endpoint with the current table revision. Combine the first batch with the remaining record range after decoding `data.records`.
7. Verify that the merged record count equals the metadata record count. Stop and report a mismatch instead of exporting partial data.
8. Convert values using field metadata: map single- and multi-select option IDs to displayed labels, join rich-text fragments, and preserve one-link cells as Excel hyperlinks.
9. Generate an XLSX workbook with the Bitable view's visible field order, a styled header, a first-row freeze pane, autofilter, wrapped text, and reasonable column widths.
10. Exclude raw browser traffic, cookies, authorization headers, decoded source payloads, and temporary data files from deliverables and version control.

## Pitfalls

- Do not bypass login, access controls, anti-bot measures, or export restrictions.
- Preserve the MCP template's `--isolated` argument. Do not switch to `--extension`, `--storage-state`, or `--user-data-dir` unless the user explicitly chooses a different session policy.
- The initial `clientvars` record map is commonly limited to 200 rows; retrieve the remaining records and merge both sources.
- A view may have a different visible field order from the table's field map; use `view.property.fields` and omit fields marked hidden in `view.property.colInfos`.
- Payloads can be gzip-compressed even when their encoding indicator appears non-obvious; detect the `H4sI` base64-gzip prefix before JSON parsing.
- Never write personal identifiers, session credentials, source URLs, table IDs, record IDs, field IDs, or exported content into skill documentation, scripts, examples, screenshots, package metadata, or Git history.
- Do not bundle executable scripts unless they are generic, reviewed, and contain no embedded endpoints, account data, or local user paths.

## Verification

- Confirm the generated workbook row count is the exported record count plus one header row.
- Confirm the number of worksheet columns equals the target view's visible fields.
- Reopen the workbook with an XLSX reader and verify its sheet name, autofilter range, frozen header, and at least one preserved hyperlink when links exist.
- Scan the skill package before publishing. Confirm that no absolute paths, email addresses, access credentials, cookies, user names, table IDs, source URLs, or sample export records are present.
