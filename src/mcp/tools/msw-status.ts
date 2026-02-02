import fs from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jobManager } from "../jobs/job-manager.js";

export function registerMswStatus(server: McpServer): void {
  server.tool(
    "msw_status",
    "Check MSW status and poll long-running jobs",
    {
      jobId: z
        .string()
        .optional()
        .describe("Specific job ID to check (omit for overall status)"),
      projectDir: z
        .string()
        .optional()
        .describe("Project directory to check .msw/ state"),
    },
    async ({ jobId, projectDir }) => {
      try {
        if (jobId) {
          const job = jobManager.get(jobId);
          if (!job) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ error: `Job not found: ${jobId}` }),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(job) }],
          };
        }

        if (projectDir) {
          const configPath = path.join(projectDir, ".msw", "config.json");
          if (!fs.existsSync(configPath)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "MSW not initialized in this project",
                    projectDir,
                  }),
                },
              ],
              isError: true,
            };
          }
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ projectDir, config }),
              },
            ],
          };
        }

        // Default: list all jobs
        const jobs = jobManager.list();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ jobs, count: jobs.length }),
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
