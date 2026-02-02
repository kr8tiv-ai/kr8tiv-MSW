# MSW Protocol Setup Guide

Complete instructions to install, configure, and run MSW (Make Shit Work) from scratch.

## Prerequisites

- **Node.js 18+** - [nodejs.org](https://nodejs.org/)
- **Chrome or Chromium** - Required for browser automation
- **Ollama** (optional) - For local relevance scoring. Without it, scoring degrades to keyword matching. [ollama.com](https://ollama.com/)
- **Git** - For research persistence and knowledge management

## Installation

```bash
git clone <repo-url> msw-protocol
cd msw-protocol
npm install
npx playwright install chromium
npm run build
```

Verify the build succeeded by checking that `dist/index.js` exists.

## MCP Client Configuration

MSW exposes its tools via the Model Context Protocol. Add the following configuration to your MCP client.

Replace `/absolute/path/to/msw-protocol` with the actual path to your cloned repository.

### Claude Code (`.claude/mcp.json`)

```json
{
  "mcpServers": {
    "msw": {
      "command": "node",
      "args": ["/absolute/path/to/msw-protocol/dist/mcp/index.js"]
    }
  }
}
```

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "msw": {
      "command": "node",
      "args": ["/absolute/path/to/msw-protocol/dist/mcp/index.js"]
    }
  }
}
```

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "msw": {
      "command": "node",
      "args": ["/absolute/path/to/msw-protocol/dist/mcp/index.js"]
    }
  }
}
```

## First Run

1. Call `msw_init` with your project directory to create the `.msw/` workspace:

   ```
   msw_init({ projectDir: "/path/to/your/project" })
   ```

2. Edit `.msw/config.json` to set your preferences:

   | Field | Description | Default |
   |-------|-------------|---------|
   | `notebookUrl` | URL of your NotebookLM notebook | (required) |
   | `profileDir` | Chrome profile directory for persistent auth | system default |
   | `relevanceThreshold` | Minimum relevance score (0-1) for topic expansion | `0.4` |
   | `maxDepth` | Maximum topic expansion depth | `3` |
   | `maxQueriesPerDay` | Daily query budget | `50` |

3. Call `msw_status` to verify all subsystems are healthy:

   ```
   msw_status({ projectDir: "/path/to/your/project" })
   ```

## NotebookLM Setup

On the first run, MSW launches Chrome for NotebookLM interaction. You must:

1. **Log in to your Google account** in the Chrome window that opens
2. Complete any 2FA prompts
3. The Chrome profile persists your authentication across restarts

The profile is stored in the default Playwright location unless you override it with `profileDir` in `.msw/config.json`.

## Available Tools

| Tool | Description |
|------|-------------|
| `msw_init` | Initialize `.msw/` workspace in a project directory |
| `msw_status` | Check health of all MSW subsystems |
| `msw_research` | Run autonomous research via NotebookLM conversation |
| `msw_plan` | Generate a PRD and execution plan from research findings |
| `msw_execute` | Execute plan iterations with the Ralph loop |
| `msw_verify` | Run behavioral verification on completed work |
| `msw_notebook_add` | Add a source document to the NotebookLM notebook |

## Troubleshooting

### "Browser not found"

Playwright cannot locate Chromium. Run:

```bash
npx playwright install chromium
```

### "Ollama unavailable"

Ollama is not running or not installed. MSW will fall back to keyword-based relevance scoring. To restore full scoring:

```bash
# Install ollama from https://ollama.com/
ollama serve
```

### "Rate limit exceeded"

MSW enforces a daily query budget (default 50 queries/day) to avoid overloading NotebookLM. Options:

- Wait until the next day for the budget to reset
- Increase `maxQueriesPerDay` in `.msw/config.json`
- Use query batching to combine related questions

### Build errors after pulling updates

```bash
npm install
npm run build
```

### Chrome profile corrupted

Delete the profile directory and log in again on next run. The default location depends on your OS and Playwright configuration.
