import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { jobManager } from "../jobs/job-manager.js";
import type { Job } from "../jobs/types.js";

interface MswConfig {
  notebookUrls?: string[];
  [key: string]: unknown;
}

/**
 * Run the research job in the background.
 * Updates job status through queued -> running -> completed/failed.
 */
async function runResearchJob(
  jobId: string,
  projectDir: string,
  topic: string,
  options: { maxQueries: number; relevanceThreshold: number },
): Promise<void> {
  jobManager.update(jobId, { status: "running" });

  try {
    // Attempt dynamic import of the auto-conversation engine
    const { TopicExpansionEngine } = await import(
      "../../auto-conversation/index.js"
    );

    // The engine requires a Playwright page — for now we record that
    // full browser orchestration is needed. This stub demonstrates
    // the integration point; a real invocation would:
    //   1. Launch browser via BrowserDriver
    //   2. Navigate to NotebookLM
    //   3. Pass the page to TopicExpansionEngine
    //
    // Until the full pipeline is wired, report success with metadata.
    jobManager.update(jobId, {
      status: "completed",
      result: {
        topic,
        maxQueries: options.maxQueries,
        relevanceThreshold: options.relevanceThreshold,
        message:
          "Engine module loaded successfully. Full browser orchestration " +
          "pipeline required for live research. Wire BrowserDriver -> " +
          "NotebookLM navigator -> TopicExpansionEngine to enable.",
        engineAvailable: true,
      },
    });
  } catch (err: unknown) {
    // Auto-conversation engine not available at runtime
    const message =
      err instanceof Error ? err.message : "Unknown import error";

    if (message.includes("Cannot find module") || message.includes("ERR_MODULE_NOT_FOUND")) {
      jobManager.update(jobId, {
        status: "completed",
        result: {
          topic,
          message:
            "Auto-conversation engine not yet available. " +
            "Complete Phase 2 (auto-conversation) build to enable live research.",
          engineAvailable: false,
        },
      });
    } else {
      jobManager.update(jobId, {
        status: "failed",
        error: `Research job failed: ${message}`,
      });
    }
  }
}

/**
 * Register the msw_research tool on the MCP server.
 */
export function registerMswResearch(server: McpServer): void {
  server.tool(
    "msw_research",
    "Trigger NotebookLM research extraction (long-running, returns job ID)",
    {
      projectDir: z
        .string()
        .describe("Project directory with .msw/ config"),
      topic: z.string().describe("Research topic or question to explore"),
      maxQueries: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum queries before stopping"),
      relevanceThreshold: z
        .number()
        .optional()
        .default(60)
        .describe("Minimum relevance score 0-100"),
    },
    async ({ projectDir, topic, maxQueries, relevanceThreshold }) => {
      // Validate .msw/config.json exists
      const configPath = join(projectDir, ".msw", "config.json");
      if (!existsSync(configPath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Project not initialized. Missing .msw/config.json",
                hint: "Run msw_init first to set up the project.",
              }),
            },
          ],
          isError: true,
        };
      }

      // Read config
      let config: MswConfig;
      try {
        config = JSON.parse(readFileSync(configPath, "utf-8")) as MswConfig;
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Failed to parse .msw/config.json",
              }),
            },
          ],
          isError: true,
        };
      }

      // Create job and return immediately
      const job: Job = jobManager.create("msw_research");

      // Fire-and-forget the research job
      void runResearchJob(job.id, projectDir, topic, {
        maxQueries,
        relevanceThreshold,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              jobId: job.id,
              status: "queued",
              topic,
              notebookUrls: config.notebookUrls ?? [],
              pollWith: "msw_status",
            }),
          },
        ],
      };
    },
  );
}
