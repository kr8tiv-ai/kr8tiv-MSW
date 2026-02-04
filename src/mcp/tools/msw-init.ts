import fs from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PipelineOrchestrator } from "../../pipeline/orchestrator.js";
import { Authenticator } from "../../auth/index.js";

export function registerMswInit(server: McpServer): void {
  server.tool(
    "msw_init",
    "Initialize MSW protocol for a project directory with authentication",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      notebookUrls: z
        .array(z.string())
        .optional()
        .describe("NotebookLM notebook URLs to associate"),
      skipAuth: z
        .boolean()
        .optional()
        .default(false)
        .describe("Skip authentication setup (for testing)"),
    },
    async ({ projectDir, notebookUrls, skipAuth }) => {
      try {
        const mswDir = path.join(projectDir, ".msw");
        const researchDir = path.join(mswDir, "research");

        fs.mkdirSync(researchDir, { recursive: true });

        const config = {
          initialized: new Date().toISOString(),
          notebookUrl: notebookUrls?.[0] ?? "",
          notebookUrls: notebookUrls ?? [],
          version: "0.1.0",
        };

        const configPath = path.join(mswDir, "config.json");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Handle authentication
        let authResult = null;
        if (!skipAuth) {
          console.log("[msw] Setting up Google authentication...");
          const authenticator = new Authenticator({
            profileDir: path.join(mswDir, "chrome_profile"),
            headless: false, // Visible browser for manual login
            timeout: 120000, // 2 minutes
            validateAuth: true,
          });

          authResult = await authenticator.authenticate();

          if (!authResult.success) {
            console.error("[msw] Authentication failed:", authResult.error);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    success: false,
                    error: authResult.error,
                    authHelp: [
                      "Close all Chrome instances and try again",
                      "Make sure to complete the full Google login flow",
                      "Check TROUBLESHOOTING.md for detailed steps",
                    ],
                  }),
                },
              ],
              isError: true,
            };
          }

          console.log("[msw] Authentication successful!");
        }

        // Run pipeline orchestrator for health checks and crash recovery
        const orchestrator = new PipelineOrchestrator(projectDir);
        const initResult = await orchestrator.initialize();

        if (initResult.resumed) {
          console.error("[msw] Resuming from previous session checkpoint");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                projectDir,
                configPath,
                config,
                authentication: authResult ? {
                  authenticated: authResult.authenticated,
                  profilePath: authResult.profilePath,
                  validatedAt: authResult.validatedAt,
                } : { skipped: true },
                health: initResult.health,
                degraded: orchestrator.getDegradedCapabilities(),
                resumed: initResult.resumed,
                ...(initResult.resumed
                  ? { resumedPhase: initResult.state.phase }
                  : {}),
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
