import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

interface NotebookEntry {
  url: string;
  label?: string;
  addedAt: string;
}

interface MswConfig {
  notebookUrls?: NotebookEntry[];
  notebookUrl?: string;
  [key: string]: unknown;
}

export function registerMswNotebookAdd(server: McpServer): void {
  server.tool(
    "msw_notebook_add",
    "Add NotebookLM notebook sources to MSW project",
    {
      projectDir: z.string().describe("Project directory with .msw/ config"),
      notebookUrl: z.string().describe("NotebookLM notebook URL to add"),
      label: z
        .string()
        .optional()
        .describe("Human-readable label for this notebook"),
    },
    async ({ projectDir, notebookUrl, label }) => {
      try {
        const configPath = join(projectDir, ".msw", "config.json");
        await access(configPath);

        const raw = await readFile(configPath, "utf-8");
        const config: MswConfig = JSON.parse(raw);

        if (!config.notebookUrls) {
          config.notebookUrls = [];
        }

        const exists = config.notebookUrls.some((e) => e.url === notebookUrl);
        if (!exists) {
          const entry: NotebookEntry = {
            url: notebookUrl,
            addedAt: new Date().toISOString(),
          };
          if (label) {
            entry.label = label;
          }
          config.notebookUrls.push(entry);
          if (!config.notebookUrl) {
            config.notebookUrl = notebookUrl;
          }
          await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  notebooks: config.notebookUrls,
                  added: !exists,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `.msw/config.json not found in ${projectDir}. Run msw_init first.`,
            },
          ],
        };
      }
    },
  );
}
