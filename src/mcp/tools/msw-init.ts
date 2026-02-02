import fs from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMswInit(server: McpServer): void {
  server.tool(
    "msw_init",
    "Initialize MSW protocol for a project directory",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      notebookUrls: z
        .array(z.string())
        .optional()
        .describe("NotebookLM notebook URLs to associate"),
    },
    async ({ projectDir, notebookUrls }) => {
      try {
        const mswDir = path.join(projectDir, ".msw");
        const researchDir = path.join(mswDir, "research");

        fs.mkdirSync(researchDir, { recursive: true });

        const config = {
          initialized: new Date().toISOString(),
          notebookUrls: notebookUrls ?? [],
          version: "0.1.0",
        };

        const configPath = path.join(mswDir, "config.json");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                projectDir,
                configPath,
                config,
              }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );
}
