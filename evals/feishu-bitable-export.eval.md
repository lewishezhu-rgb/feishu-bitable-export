# Feishu Bitable Export evaluation

## Binary checks

1. `npm ci` installs the locked dependencies.
2. `npm run export -- --help` exits successfully and documents both `/base/` and current-view `/wiki/` inputs.
3. A direct Bitable view with verifiable records creates an XLSX whose workbook checker passes.
4. A Wiki link with table/view parameters creates an XLSX only when a candidate Base returns successful same-origin metadata for that current view.
5. A Wiki page without a displayed Bitable, a permission error, malformed data, ambiguous Base candidates, stalled pagination, or unverified completeness exits non-zero and publishes no XLSX.
6. Readable image/media values are embedded or placed in the same-name media directory; failed media retains a visible note/link.
7. Existing output is never overwritten unless `--force` is explicit.

## Golden cases

- `direct-bitable-public`: user-provided direct view URL at verification time.
- `wiki-displayed-bitable`: user-provided current-view Wiki URL at verification time.
- `wiki-without-bitable`: must stop clearly and publish no workbook.
- `filtered-view-no-completion`: must fail closed.
- `invalid-url`: must fail before browser/output publication.

Live tests use user-authorized URLs at verification time. No source URL, table ID, record, cookie, browser state, media, or response fixture is stored in this package.
