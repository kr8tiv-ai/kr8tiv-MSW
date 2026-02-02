#!/usr/bin/env node

/**
 * MSW Protocol MCP Server
 *
 * Autonomous coding orchestration via Model Context Protocol.
 * Exposes tools: msw_init, msw_status, msw_research, msw_plan, msw_execute, msw_verify, msw_notebook_add
 *
 * ## Client Configuration
 *
 * ### Claude Code (`.claude/mcp.json`)
 * ```json
 * {
 *   "mcpServers": {
 *     "msw": {
 *       "command": "node",
 *       "args": ["C:/path/to/msw-protocol/dist/mcp/index.js"]
 *     }
 *   }
 * }
 * ```
 *
 * ### Cursor (`~/.cursor/mcp.json`)
 * ```json
 * {
 *   "mcpServers": {
 *     "msw": {
 *       "command": "node",
 *       "args": ["C:/path/to/msw-protocol/dist/mcp/index.js"]
 *     }
 *   }
 * }
 * ```
 *
 * ### Windsurf (`~/.codeium/windsurf/mcp_config.json`)
 * ```json
 * {
 *   "mcpServers": {
 *     "msw": {
 *       "command": "node",
 *       "args": ["C:/path/to/msw-protocol/dist/mcp/index.js"]
 *     }
 *   }
 * }
 * ```
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("[msw-mcp-server] MCP server started on stdio transport");
}

main().catch((error: unknown) => {
  console.error("[msw-mcp-server] Fatal error:", error);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[msw-mcp-server] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[msw-mcp-server] Unhandled rejection:", reason);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.error("[msw-mcp-server] Received SIGINT, shutting down");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("[msw-mcp-server] Received SIGTERM, shutting down");
  process.exit(0);
});
