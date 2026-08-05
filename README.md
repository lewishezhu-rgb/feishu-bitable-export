# Feishu Bitable Export

[中文](#中文) | [English](#english)

---

<a id="中文"></a>

## 中文

将具有合法查看权限的飞书多维表格导出为 Excel（`.xlsx`）的通用技能包。通过 Playwright MCP 打开**隔离的浏览器会话**，由用户手动登录飞书后读取目标视图的数据，并生成结构化 Excel 文件。

该技能面向支持技能目录和 MCP 配置的智能编码客户端，例如 Codex、Claude Code、Cursor，以及其他兼容客户端。不同客户端的技能安装路径和 MCP 配置入口可能不同，请以对应客户端文档为准。

### 功能

- 读取飞书多维表格指定视图中的全部可访问记录。
- 按视图中的可见字段顺序导出数据，并跳过隐藏字段。
- 将单选和多选字段的选项标识转换为显示文本。
- 保留可识别的单链接单元格为 Excel 超链接。
- 写入带有冻结首行、筛选、自动换行和基础列宽的 `.xlsx` 文件。
- 导出前比对元数据记录总数与已读取记录数，避免把不完整数据误交付为完整导出。

### 前提条件

- 具备目标飞书多维表格的合法查看权限。
- 已安装 Node.js 20 或更高版本。
- 使用支持 MCP 配置的客户端。
- 能够在自动打开的浏览器窗口中亲自完成飞书登录。

### 安装

1. 下载并解压 `feishu-bitable-export.zip`，或克隆包含本目录的 Git 仓库。
2. 将 `feishu-bitable-export` 目录放入所用客户端支持的技能目录，或按该客户端的技能加载方式引用此目录。
3. 确认目录至少包含以下文件：

   ```text
   feishu-bitable-export/
   ├── SKILL.md
   ├── README.md
   ├── references/
   │   └── playwright-mcp.md
   └── templates/
       └── playwright-mcp.json
   ```

### 配置 Playwright MCP

将 `templates/playwright-mcp.json` 中的 `mcpServers.playwright` 条目**合并**到现有 MCP 配置中。不要覆盖已有的 MCP 服务配置。

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser=chrome",
        "--isolated"
      ]
    }
  }
}
```

在客户端中信任并启用该 MCP 服务，然后重新打开或刷新会话。有关不同客户端的 MCP 配置位置，请参考客户端自己的官方文档。

### 为什么必须保留 `--isolated`

`--isolated` 会让每次执行使用新的内存浏览器会话：

- 不自动加载既有 Cookie；
- 不保存本次登录状态；
- 不读取日常浏览器的标签页或个人配置；
- 关闭会话后，当前浏览器状态即被丢弃。

除非已评估隐私影响并获得用户明确同意，否则不要添加以下参数：

- `--extension`：可能连接已有浏览器标签页；
- `--storage-state`：可能从文件加载会话状态；
- `--user-data-dir`：可能让浏览器配置跨执行复用。

### 使用方式

1. 在对话中提供飞书多维表格链接，并说明需要导出为 Excel。
2. 浏览器窗口打开后，亲自登录飞书账号。
3. 确认能够看到目标表格及目标视图。
4. 告知智能体已完成登录。
5. 智能体在授权会话内读取数据、核对记录数，并生成 `.xlsx` 文件。
6. 下载或保存生成的 Excel 文件。

示例：

```text
把这个飞书多维表格的当前视图全部导出为 Excel，文件名为招聘信息.xlsx。
```

### 隐私与安全

- 不尝试绕过登录、权限控制、反爬措施或导出限制。
- 不在技能包中保存账号、密码、Cookie、授权头、浏览器配置、表格链接、表格/视图/字段标识或导出数据。
- 不自动登录飞书；每次隔离会话均需由用户手动登录。
- 不将原始网络响应、截图、浏览器跟踪数据或临时导出数据提交到技能包或 Git 仓库。
- 仅在用户具备相应查看权限时执行导出。

### 输出与校验

成功导出的 Excel 应包含：

- 目标视图的可见字段顺序；
- 与源数据一致的记录数量；
- 首行冻结与筛选；
- 自动换行和基础列宽；
- 可识别链接保留为超链接。

若记录总数不匹配，应停止并报告不完整状态，而不是生成误导性的完整导出文件。

### GitHub 发布建议

建议仅提交以下通用文件：

```text
SKILL.md
README.md
references/playwright-mcp.md
templates/playwright-mcp.json
```

不要提交浏览器用户数据目录、包含真实凭据的 MCP 配置、导出的 Excel、网页截图、网络日志、缓存或调试输出。

---

<a id="english"></a>

## English

A general-purpose skill package for exporting Feishu Bitable data that the user is legitimately allowed to view into an Excel (`.xlsx`) workbook. It opens an **isolated browser session** through Playwright MCP, requires the user to sign in to Feishu manually, reads the target view, and creates a structured Excel export.

This package is intended for coding agents that support skill folders and MCP configuration, including Codex, Claude Code, Cursor, and other compatible clients. Skill installation locations and MCP configuration entry points vary by client; follow the documentation for the client in use.

### Features

- Read all accessible records from a specified Feishu Bitable view.
- Export fields in the view's visible order and omit hidden fields.
- Convert single-select and multi-select option identifiers into displayed labels.
- Preserve identifiable single-link cells as Excel hyperlinks.
- Create an `.xlsx` workbook with a frozen header row, filters, wrapped text, and practical column widths.
- Compare the metadata record count with the retrieved record count before delivery to prevent incomplete exports from being presented as complete.

### Prerequisites

- Legitimate view access to the target Feishu Bitable.
- Node.js 20 or later.
- A client that supports MCP configuration.
- Ability to sign in to Feishu directly in the browser window opened for the task.

### Installation

1. Download and extract `feishu-bitable-export.zip`, or clone a Git repository containing this directory.
2. Place the `feishu-bitable-export` folder in the skill directory supported by the chosen client, or reference the directory according to that client's skill-loading mechanism.
3. Confirm that the directory contains at least:

   ```text
   feishu-bitable-export/
   ├── SKILL.md
   ├── README.md
   ├── references/
   │   └── playwright-mcp.md
   └── templates/
       └── playwright-mcp.json
   ```

### Configure Playwright MCP

**Merge** the `mcpServers.playwright` entry from `templates/playwright-mcp.json` into the existing MCP configuration. Do not overwrite other configured MCP servers.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--browser=chrome",
        "--isolated"
      ]
    }
  }
}
```

Trust and enable the MCP server in the client, then start a new or refreshed session. Refer to the chosen client's official documentation for the location of its MCP configuration.

### Why `--isolated` must remain enabled

`--isolated` creates a new in-memory browser session for every run:

- Existing cookies are not loaded automatically.
- The current sign-in state is not saved.
- Existing browser tabs and personal browser profiles are not read.
- The current browser state is discarded when the session closes.

Do not add the following options unless their privacy implications have been assessed and the user has explicitly approved the change:

- `--extension`: may connect to existing browser tabs.
- `--storage-state`: may load session state from a file.
- `--user-data-dir`: may make browser profiles reusable across runs.

### Usage

1. Provide the Feishu Bitable link in a conversation and request an Excel export.
2. Sign in to Feishu manually when the browser window opens.
3. Confirm that the target Bitable and view are visible.
4. Tell the agent that sign-in is complete.
5. The agent reads data within the authorized session, verifies the record count, and generates an `.xlsx` file.
6. Download or save the generated Excel file.

Example:

```text
Export the current view of this Feishu Bitable to Excel and name the file exported-data.xlsx.
```

### Privacy and security

- Do not bypass sign-in, access controls, anti-bot protections, or export restrictions.
- Do not store accounts, passwords, cookies, authorization headers, browser profiles, Bitable links, table/view/field identifiers, or exported data in this skill package.
- Do not sign in to Feishu automatically; manual sign-in is required for every isolated session.
- Do not commit raw network responses, screenshots, browser traces, or temporary exports to the skill package or a Git repository.
- Export only data that the user is authorized to view.

### Output and verification

A successful Excel export should include:

- The visible field order of the target view.
- A record count consistent with the source metadata.
- A frozen header row and filters.
- Wrapped text and practical column widths.
- Recognized links preserved as hyperlinks.

If the record count does not match, stop and report an incomplete result rather than producing a misleading complete export.

### GitHub publishing guidance

Commit only the general skill files:

```text
SKILL.md
README.md
references/playwright-mcp.md
templates/playwright-mcp.json
```

Do not commit browser user-data directories, MCP configurations containing real credentials, exported workbooks, screenshots, network logs, caches, or debug output.
