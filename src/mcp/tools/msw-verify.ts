import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdir, access } from "node:fs/promises";
import { join } from "node:path";

export function registerMswVerify(server: McpServer): void {
  server.tool(
    "msw_verify",
    "Verify implementation against research requirements",
    {
      projectDir: z.string().describe("Project directory with .msw/ config"),
      requirementIds: z
        .array(z.string())
        .optional()
        .describe("Specific requirement IDs to verify (all if omitted)"),
    },
    async ({ projectDir, requirementIds }) => {
      try {
        const mswDir = join(projectDir, ".msw");
        await access(mswDir);

        const researchDir = join(mswDir, "research");
        let files: string[] = [];
        try {
          files = await readdir(researchDir);
        } catch {
          // research directory may not exist yet
        }

        const requirements = requirementIds
          ? files.filter((f) => requirementIds.some((id) => f.includes(id)))
          : files;

        const summary = {
          total: requirements.length,
          verified: 0,
          pending: requirements.length,
          requirements,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `.msw/ directory not found in ${projectDir}. Run msw_init first.`,
            },
          ],
        };
      }
    },
  );
}
