# Technology Stack

**Project:** MSW Protocol (NotebookLM-Agent Bridge)
**Researched:** 2026-02-02
**Overall Confidence:** HIGH

## Executive Summary

This stack is optimized for building an MCP server that bridges browser automation (for NotebookLM interaction) with agentic coding workflows. The recommended stack leverages the official MCP TypeScript SDK (v1.25.x), Microsoft's official Playwright MCP patterns, and modern Node.js tooling. The architecture supports both stdio transport (for Claude Code/Cursor/Windsurf integration) and Streamable HTTP (for remote/production deployment).

---

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Node.js** | 24.x LTS | Runtime | Active LTS through Oct 2028. Native ESM support, experimental TypeScript stripping (`--experimental-strip-types`). Best long-term support window for a new project. | HIGH |
| **TypeScript** | 5.5+ | Language | Required by MCP SDK. Use `moduleResolution: "bundler"` for clean ESM. Zod v4 tested against TS 5.5+. | HIGH |
| **tsx** | latest | Dev runner | Zero-config TypeScript execution. Eliminates ESM/CJS friction. Use for development; compile for production. | HIGH |

**Alternative considered:** Node.js 22.x (Jod) - still in maintenance LTS, but 24.x gives longer runway. Bun was considered but MCP SDK explicitly targets Node.js.

### MCP Server Core

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@modelcontextprotocol/sdk** | ^1.25.x | MCP server framework | Official Anthropic SDK. v2 expected Q1 2026 but v1.x supported 6+ months after. Current production recommendation. | HIGH |
| **zod** | ^3.25.0 or v4.x | Schema validation | Required peer dependency of MCP SDK. v4 offers 14x faster parsing, 57% smaller bundle. SDK imports from `zod/v4` but backwards compatible with 3.25+. | HIGH |

**SDK Transport Decision:**
- **stdio** - For local Claude Code/Cursor/Windsurf integration (primary use case)
- **Streamable HTTP** - For remote/production deployment (replaces deprecated SSE)

```typescript
// Recommended: stdio for local agent integration
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Production remote: Streamable HTTP (not SSE - deprecated)
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
```

**Sources:**
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)

### Browser Automation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **playwright** | ^1.58.0 | Browser automation | Microsoft's browser automation. v1.58 adds Playwright Agents (planner/generator/healer) - directly relevant for agentic workflows. | HIGH |
| **@playwright/mcp** | latest | MCP-native browser control | Official Microsoft MCP server for Playwright. Uses accessibility tree (not screenshots) - LLM-friendly, no vision models needed. | HIGH |

**Key Playwright 1.58 Features:**
1. **Playwright Agents** - Built-in planner, generator, healer agents for test automation
2. **Token-efficient CLI mode** - `playwright-cli` skills for coding agent integration
3. **Chrome for Testing** - Switched from Chromium to official Chrome builds

**Architecture Decision: Use @playwright/mcp as reference, build custom tools**

The MSW Protocol needs custom behavior (NotebookLM-specific clicks, relevance scoring, bidirectional message flow). Recommended approach:

```typescript
// DON'T just wrap @playwright/mcp
// DO use Playwright directly with custom MCP tools

import { chromium } from "playwright";

// Custom MCP tool for NotebookLM interaction
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "notebooklm_click_topic") {
    // Custom logic: click suggested topic, evaluate relevance
    const page = await browser.newPage();
    // ... NotebookLM-specific automation
  }
});
```

**Sources:**
- [Playwright Release Notes](https://playwright.dev/docs/release-notes)
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [@playwright/mcp npm](https://www.npmjs.com/package/@playwright/mcp)

### NotebookLM Integration Strategy

| Approach | Recommendation | Why | Confidence |
|----------|---------------|-----|------------|
| **Browser Automation** | PRIMARY | No public consumer API. Browser automation via Playwright is the only viable path for auto-clicking topics and extracting responses. | HIGH |
| **Enterprise API** | FUTURE OPTION | NotebookLM Enterprise API (Sept 2025) exists but limited to enterprise tenants, alpha status, and doesn't cover consumer features like topic suggestions. | MEDIUM |
| **notebooklm-py** | REFERENCE | Unofficial Python library reverse-engineers NotebookLM. Use as reference for API endpoint discovery, but implement natively in TypeScript. | MEDIUM |

**Critical Note:** NotebookLM has no official consumer API. All automation must go through browser automation. This is the correct architectural choice - trying to reverse-engineer undocumented APIs is fragile.

**Sources:**
- [NotebookLM Enterprise API Docs](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks)
- [notebooklm-py](https://github.com/teng-lin/notebooklm-py)

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **vitest** | ^3.x | Test framework | Faster than Jest, native ESM support, tighter TypeScript integration. MCP ecosystem standardizing on Vitest. | HIGH |
| **@modelcontextprotocol/inspector** | latest | MCP debugging | Official Anthropic tool. Real-time protocol inspection, transport validation. Essential for MCP development. | HIGH |
| **mcp-jest** (optional) | latest | MCP-specific testing | Automated MCP server testing (connections, tools, resources). Use for CI/CD. | MEDIUM |

**Testing Strategy:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "inspector": "npx @modelcontextprotocol/inspector node ./dist/server.js"
  }
}
```

**Sources:**
- [MCP Server Testing Guide](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
- [Vitest MCP Server](https://github.com/djankies/vitest-mcp)
- [mcp-jest](https://github.com/josharsh/mcp-jest)

### Logging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **pino** | ^9.x | Structured logging | 5-10x faster than Winston. JSON output for log aggregation. Low overhead critical for agent loops. | HIGH |

**CRITICAL: stdio Transport Logging**

MCP servers using stdio transport MUST NOT write to stdout (breaks JSON-RPC). Use stderr:

```typescript
import pino from "pino";

// CORRECT: Log to stderr for stdio transport
const logger = pino({
  transport: { target: "pino-pretty" },
  // Force stderr - stdout breaks MCP stdio transport
}, pino.destination(2)); // fd 2 = stderr

// WRONG: console.log() writes to stdout - BREAKS MCP
// console.log("debug"); // DON'T DO THIS
```

**Sources:**
- [Pino Logger Guide](https://signoz.io/guides/pino-logger/)
- [Pino vs Winston](https://betterstack.com/community/guides/scaling-nodejs/pino-vs-winston/)

### Configuration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **dotenvx** | ^1.x | Environment management | Next-gen dotenv from same creator. Works with any language/framework. Better debugging than dotenv. | HIGH |
| **zod** | (shared) | Config validation | Already using for MCP schemas. Validate env vars at startup. | HIGH |

```typescript
// config.ts - Type-safe configuration
import { z } from "zod";
import "@dotenvx/dotenvx/config";

const ConfigSchema = z.object({
  NOTEBOOKLM_EMAIL: z.string().email(),
  NOTEBOOKLM_PASSWORD: z.string().min(1),
  BROWSER_HEADLESS: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = ConfigSchema.parse(process.env);
```

**Sources:**
- [dotenvx](https://dev.to/dotenv/from-dotenv-to-dotenvx-next-generation-config-management-2104)

### Build & Bundle

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **tsup** | ^8.x | Build tool | Zero-config bundling for Node.js. Outputs both ESM and CJS if needed. Built on esbuild. | HIGH |
| **esbuild** | (via tsup) | Transpilation | Lightning-fast. tsup uses it internally. | HIGH |

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node24",
  dts: true,
  clean: true,
  sourcemap: true,
});
```

---

## Complete package.json

```json
{
  "name": "msw-protocol",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "inspector": "npx @modelcontextprotocol/inspector node ./dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0",
    "playwright": "^1.58.0",
    "zod": "^4.0.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "pino-pretty": "^13.0.0"
  }
}
```

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **SSE Transport** | Deprecated in MCP spec 2025-06-18. Use Streamable HTTP for remote servers. |
| **Jest** | Slower than Vitest, worse ESM support. MCP ecosystem moving to Vitest. |
| **Winston** | 5-10x slower than Pino. Overhead matters in agent loops. |
| **dotenv** (old) | Use dotenvx instead - better debugging, cross-platform. |
| **puppeteer** | Playwright is the modern choice. Better API, official MCP support. |
| **@executeautomation/playwright-mcp-server** | Third-party. Use Microsoft's official @playwright/mcp as reference. |
| **CommonJS** | Use ESM exclusively. Node.js 24 has full ESM support. |
| **Bun** | MCP SDK targets Node.js. Bun compatibility untested. |
| **NotebookLM reverse-engineered APIs** | Fragile, will break. Browser automation is the stable path. |

---

## Architecture Integration Notes

### Ralph Wiggum Loop Compatibility

The MSW Protocol will feed errors back to NotebookLM for grounding. This aligns with the Ralph Wiggum Loop pattern where:
1. Agent encounters error
2. Error context sent to NotebookLM (via MSW MCP tools)
3. NotebookLM provides grounded answer from uploaded sources
4. Answer fed back to agent for retry

**Key design principle:** Memory persists via git history and NotebookLM sources, not LLM context. Fresh context each iteration.

### GSD Protocol Integration

MSW MCP server exposes tools that GSD phases can call:
- `/gsd:execute-phase` calls MSW tools for research grounding
- Each phase gets fresh context but can query NotebookLM for accumulated knowledge

### MCP Client Configuration

**Claude Code (~/.claude/mcp.json):**
```json
{
  "mcpServers": {
    "msw-protocol": {
      "command": "node",
      "args": ["C:/path/to/msw/dist/server.js"],
      "env": {
        "NOTEBOOKLM_EMAIL": "${NOTEBOOKLM_EMAIL}",
        "BROWSER_HEADLESS": "true"
      }
    }
  }
}
```

**Cursor (.cursor/mcp.json):**
```json
{
  "mcpServers": {
    "msw-protocol": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/path/to/msw/dist/server.js"]
    }
  }
}
```

**Windsurf:** Same configuration pattern as Cursor.

---

## Version Pinning Strategy

| Category | Strategy | Rationale |
|----------|----------|-----------|
| **MCP SDK** | `^1.25.0` (caret) | Minor updates safe. Lock before v2 migration. |
| **Playwright** | `^1.58.0` (caret) | Frequent updates, backwards compatible. |
| **Zod** | `^4.0.0` (caret) | v4 is stable, performance gains worth it. |
| **Node.js** | `>=24.0.0` | LTS baseline. Don't allow older. |
| **TypeScript** | `^5.5.0` (caret) | Match Zod testing baseline. |

---

## Sources

### Authoritative (HIGH confidence)
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Official Documentation](https://modelcontextprotocol.io/docs/develop/build-server)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes)
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Node.js Release Schedule](https://nodejs.org/en/about/previous-releases)
- [Zod v4 Announcement](https://www.infoq.com/news/2025/08/zod-v4-available/)

### Community/Guides (MEDIUM confidence)
- [MCP Node.js Best Practices](https://oneuptime.com/blog/post/2025-12-17-build-mcp-server-nodejs/view)
- [MCP Transport Comparison](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/)
- [MCP Server Testing Guide](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
- [GSD Framework](https://github.com/glittercowboy/get-shit-done)
- [Ralph Wiggum Loop](https://linearb.io/dev-interrupted/podcast/inventing-the-ralph-wiggum-loop)
