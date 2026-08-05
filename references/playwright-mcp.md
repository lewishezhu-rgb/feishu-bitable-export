# Playwright MCP setup

## Purpose

Provide browser automation for the export workflow. The template starts a visible Chrome session and uses an isolated in-memory profile.

## Prerequisites

- Install Node.js 20 or newer.
- Use an MCP client that supports standard `mcpServers` configuration.
- Keep the user present for sign-in and any interactive verification.

## Configuration

1. Copy the `mcpServers.playwright` entry from `@templates/playwright-mcp.json` into the MCP client's configuration file.
2. Enable or trust the MCP server in the client after adding it.
3. Start a fresh task. The MCP server opens a visible browser window by default.
4. Have the user sign in directly in that window before opening the target Bitable.

## Privacy and session rules

- Preserve `--isolated`. It starts a clean in-memory browser session without loading or saving prior cookies.
- Do not add `--extension`; that mode connects to existing browser tabs.
- Do not add `--storage-state`; it loads session state from a file.
- Do not add `--user-data-dir`; it may make a profile reusable across runs.
- Do not enable tools that execute arbitrary server-side JavaScript unless the MCP client is trusted and the user explicitly approves the need.
- Avoid saving browser traces, screenshots, network logs, storage state, or downloaded source data into the skill directory or a public repository.

## Expected behavior

- Sign-in is manual for every isolated run.
- Closing the browser session removes the in-memory session state.
- The MCP template contains no credentials, target links, personal data, or export data.
