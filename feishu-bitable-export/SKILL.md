---
name: feishu-bitable-export
description: >-
  Export a Feishu Bitable view that a user can legitimately access to XLSX. Use when
  users ask to export, download, or back up a Feishu/Lark Bitable view to Excel,
  especially a public share link. Runs an isolated Playwright browser, supports manual
  sign-in when needed, verifies unfiltered record completeness, and writes a styled XLSX.
license: MIT
activation: /feishu-bitable-export
provenance:
  maintainer: workspace-owner
  version: 1.0.0
  created: 2026-09-02
  source_references:
    - User-authorized live public-view verification
metadata:
  author: workspace-owner
  version: 1.0.0
  created: 2026-09-02
  last_reviewed: 2026-09-02
  dependencies:
    - Node.js 20+
    - npm registry access
    - Playwright Chromium download access
compatibility: >-
  Requires a host with terminal access, Node.js 20+, and a graphical session only when
  manual Feishu sign-in is needed. Public anonymous views may run headlessly.
---

# /feishu-bitable-export

Export one user-provided Feishu Bitable view to an `.xlsx` workbook without reusing a browser profile, cookie, or stored session.

## Trigger

Use for requests such as:

- “把这个飞书多维表格导出成 Excel”
- “下载这个公开 Bitable 的当前视图”
- “将飞书表格备份为 xlsx”

Do not use it for modifying Feishu data, exporting attachments/comments/history, batch-exporting multiple tables, or bypassing permissions.

## Run

From this skill directory:

```bash
npm ci
npm run setup-browser
npm run export -- "<完整飞书视图 URL>" --output "./export.xlsx"
```

The URL must use `https://*.feishu.cn/base/...` and include both `table` and `view` query parameters.

For a view that is anonymously readable, use:

```bash
npm run export -- "<完整飞书视图 URL>" --headless --no-prompt --output "./export.xlsx"
```

For a view that redirects to sign-in, omit `--headless`. The runner opens a new in-memory browser. Ask the user to sign in and confirm the requested view there, then continue at the terminal prompt. Never connect to the user’s normal browser, profile, cookies, storage state, or open tabs.

Use `--force` only after the user explicitly approves replacement of an existing `.xlsx` file.

## Data and completeness rules

1. Read table metadata and records only from the loaded page’s same-origin browser context.
2. Export only visible fields, in the target view’s field order.
3. Decode object and gzip-base64 payload forms; map select IDs to labels; preserve one HTTP(S) link per cell; escape formula-like text.
4. For a view without an active filter, require final unique record count to equal source metadata count.
5. For a filtered view, require an explicit server pagination-complete signal. If absent, fail closed and do not create a workbook.
6. Fail on HTTP/business errors, unexpected payloads, repeated pagination offsets, no progress, unreadable field records, or count mismatches.
7. Write the workbook to a temporary sibling file, then atomically publish the final `.xlsx` only after all checks pass.

## Verify

After a successful export:

```bash
npm run check-workbook -- "./export.xlsx"
```

Confirm the command reports one sheet, frozen header, autofilter, zero Excel error values, and the expected row/column counts when the exporter reported them.

## Gotchas

- A Feishu share URL may render a landing page without allowing anonymous API reads. Treat a sign-in redirect or API permission error as a requirement for user-mediated sign-in, not as a reason to reuse an existing profile.
- The initial response may contain only a partial record map; the exporter must retrieve and merge the remaining response before writing a workbook.
- Table-level record count is not a valid completeness proof for an actively filtered view.
- This implementation relies on the data format made available to the authorized web page, not an official Feishu Open Platform export API. If that format changes, fail closed and update the exporter.
