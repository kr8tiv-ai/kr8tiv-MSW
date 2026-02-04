import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerTools,
  registerMswInit,
  registerMswDiscover,
  registerMswStatus,
  registerMswResearch,
  registerMswPlan,
  registerMswExecute,
  registerMswVerify,
  registerMswNotebookAdd,
  registerMswUploadSources,
} from "./tools/index.js";

const VERSION = "0.1.0";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "msw-protocol",
    version: VERSION,
  });

  registerTools(server, [
    registerMswInit,
    registerMswDiscover,
    registerMswStatus,
    registerMswResearch,
    registerMswPlan,
    registerMswExecute,
    registerMswVerify,
    registerMswNotebookAdd,
    registerMswUploadSources,
  ]);

  return server;
}
