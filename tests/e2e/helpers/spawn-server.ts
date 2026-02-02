import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";

const DIST_ENTRY = path.resolve(__dirname, "../../../dist/mcp/index.js");

export interface TestClient {
  client: Client;
  cleanup: () => Promise<void>;
}

export async function createTestClient(): Promise<TestClient> {
  if (!fs.existsSync(DIST_ENTRY)) {
    throw new Error(
      `dist/mcp/index.js not found at ${DIST_ENTRY}. Run "npm run build" first.`,
    );
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: [DIST_ENTRY],
  });

  const client = new Client({
    name: "msw-e2e-test",
    version: "0.0.1",
  });

  await client.connect(transport);

  const cleanup = async (): Promise<void> => {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  };

  return { client, cleanup };
}
