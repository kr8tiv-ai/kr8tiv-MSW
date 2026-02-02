import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { jobManager } from "../jobs/job-manager.js";
import type { ToolResult } from "../jobs/types.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerMswExecute(server: McpServer): void {
  server.tool(
    "msw_execute",
    "Run Ralph execution loop with NotebookLM feedback (long-running, returns job ID)",
    {
      projectDir: z.string().describe("Project directory with .msw/ config"),
      taskDescription: z.string().describe("What to implement"),
      maxIterations: z.number().optional().default(5).describe("Maximum Ralph loop iterations"),
    },
    async ({ projectDir, taskDescription, maxIterations }): Promise<ToolResult> => {
      const mswDir = join(projectDir, ".msw");

      try {
        await access(mswDir);
      } catch {
        return {
          content: [{ type: "text", text: `Error: .msw/ directory not found in ${projectDir}` }],
          isError: true,
        };
      }

      const job = jobManager.create("msw_execute");
      const iterations = maxIterations ?? 5;

      // Run in background
      void (async () => {
        try {
          jobManager.update(job.id, { status: "running" });

          const executionDir = join(mswDir, "execution");
          await mkdir(executionDir, { recursive: true });

          const logs: string[] = [];

          for (let i = 1; i <= iterations; i++) {
            jobManager.update(job.id, {
              progress: {
                step: i,
                total: iterations,
                message: `Ralph loop iteration ${i}/${iterations}`,
              },
            });

            // Stub: simulate iteration work (Phase 5 will add real Ralph loop)
            const iterationLog = [
              `# Iteration ${i}`,
              `Timestamp: ${new Date().toISOString()}`,
              `Task: ${taskDescription}`,
              `Status: stub iteration (pending Phase 5 engine integration)`,
              "",
            ].join("\n");

            logs.push(iterationLog);

            await writeFile(
              join(executionDir, `iteration-${i}.md`),
              iterationLog,
              "utf-8",
            );

            // Small delay between iterations to simulate work
            if (i < iterations) {
              await delay(100);
            }
          }

          jobManager.update(job.id, {
            status: "completed",
            progress: {
              step: iterations,
              total: iterations,
              message: "Ralph loop complete",
            },
            result: {
              iterationsRun: iterations,
              taskDescription,
              executionDir,
            },
          });
        } catch (err) {
          jobManager.update(job.id, {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();

      return {
        content: [{ type: "text", text: JSON.stringify({ jobId: job.id, status: "queued" }) }],
      };
    },
  );
}
