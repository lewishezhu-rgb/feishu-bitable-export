# Feishu Bitable Export Skill

Export one Feishu Bitable view you are allowed to access into a complete, local `.xlsx` workbook.

## Install in a clean environment

```bash
cd feishu-bitable-export
npm ci
npm run setup-browser
```

Requirements: Node.js 20+, npm access, Playwright browser download access, and network access to the supplied `*.feishu.cn` Bitable view. Linux systems may need the browser system libraries documented by Playwright.

## Export

```bash
npm run export -- "https://<tenant>.feishu.cn/base/<BASE>?table=<TABLE>&view=<VIEW>" --output "./export.xlsx"
```

If the view is anonymously accessible, this works without a visible browser:

```bash
npm run export -- "<complete view URL>" --headless --no-prompt --output "./export.xlsx"
```

If Feishu redirects to sign-in or the data request is not authorized, run without `--headless`. A new temporary browser window opens; sign in there, confirm the target view, and press Enter in the terminal. The session is in-memory and disappears when the export ends.

## Validate the workbook

```bash
npm run check-workbook -- "./export.xlsx"
```

The exporter only publishes a workbook after validation of the data response. For unfiltered views it requires the unique exported record count to match the source metadata count. It rejects unprovable filtered views, malformed responses, stalled pagination, or mismatched counts.

## Safety and privacy

- The tool never reuses your normal browser profile, cookies, storage state, extensions, or open tabs.
- It does not bypass access controls and only reads data made available to the current page session.
- It does not save raw responses, cookies, browser traces, screenshots, or source data alongside the output.
- Existing workbooks are never overwritten unless you explicitly add `--force`.

## Install as an agent skill

Place this folder in your agent's native skills directory, or use the generated `install.sh`. The invocation name is `/feishu-bitable-export`.

For Claude Code, add the local folder as a plugin marketplace and install it through the plugin UI. For CodeBuddy, place or symlink this directory under `~/.codebuddy/skills/feishu-bitable-export`.

## Tested representative run

This package has been verified after `npm ci` in a fresh in-memory Playwright Chromium session against a user-provided anonymously readable view, without a login or persistent browser profile. The resulting workbook passed the bundled checker for a one-sheet workbook with frozen header, autofilter, preserved hyperlinks, and zero Excel error values. Source URLs, identifiers, record counts, and source records are intentionally not retained in this package.

## Known boundaries

This package exports one selected view at a time. It does not modify Feishu, export attachments/comments/history, use official Open Platform credentials, or support data extraction when Feishu does not expose a verifiable completed record set to the authorized browser page.

## Verification

[VERIFICATION.md](VERIFICATION.md) records the latest generation-time gate and eval evidence.
