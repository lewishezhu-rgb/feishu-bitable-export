# Verification: feishu-bitable-export

## Release evidence

- Baseline: validated as a standalone Feishu Bitable export skill with a separate rollback copy retained outside the release package.
- Direct Base regression: PASS — an isolated headless browser exported a current Bitable view and the workbook checker passed with frozen header, autofilter, hyperlinks, and no Excel error values.
- Wiki route: PASS/closed — the CLI accepts Wiki links with `table` and `view`, validates candidate Base tokens through successful same-origin metadata responses, and stops without XLSX when the current page does not expose a usable Base or the data request is denied.
- Media path: implemented — readable image/media values are downloaded through the authorized page; images are embedded when possible and other media use a same-name media directory. Unavailable media retain cell text/link and a note.
- Security: no persistent profile, storage state, cookies, raw payloads, source URLs, or source records are included in the skill package.

## Checks

- `npm ci`: passed.
- `npm run export -- --help`: passed.
- `npm run check-workbook`: passed on the direct Base regression output.
- Invalid or unauthorized Wiki/Base paths: fail closed without publishing a new workbook.
- Production dependency audit: zero known vulnerabilities at verification time.

## Interpretation

This report records implementation-time evidence only. Feishu page data and private web response formats may change. If the current Wiki page does not visibly correspond to the requested Bitable, or record completeness cannot be proven, the exporter stops instead of producing a partial workbook.
