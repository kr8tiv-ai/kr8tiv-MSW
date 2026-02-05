import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "../../logging/index.js";

const logger = createLogger('msw-notebook-add');

interface NotebookEntry {
  url: string;
  label?: string;
  addedAt: string;
}

interface DiscoveredSource {
  title: string;
  url: string;
  description: string;
}

interface MswConfig {
  notebookUrls?: (NotebookEntry | string)[];
  notebookUrl?: string;
  discoveredSources?: DiscoveredSource[];
  [key: string]: unknown;
}

export function registerMswNotebookAdd(server: McpServer): void {
  server.tool(
    "msw_notebook_add",
    "Add NotebookLM notebook to MSW project. Optionally auto-upload discovered sources.",
    {
      projectDir: z.string().describe("Project directory with .msw/ config"),
      notebookUrl: z.string().describe("NotebookLM notebook URL to add"),
      label: z
        .string()
        .optional()
        .describe("Human-readable label for this notebook"),
      autoUpload: z
        .boolean()
        .optional()
        .default(false)
        .describe("Auto-upload discovered sources from msw_discover to this notebook"),
    },
    async ({ projectDir, notebookUrl, label, autoUpload }) => {
      try {
        const configPath = join(projectDir, ".msw", "config.json");
        await access(configPath);

        const raw = await readFile(configPath, "utf-8");
        const config: MswConfig = JSON.parse(raw);

        if (!config.notebookUrls) {
          config.notebookUrls = [];
        }

        // Normalize notebookUrls to handle both string[] and NotebookEntry[] formats
        const normalizedUrls = config.notebookUrls.map(e =>
          typeof e === 'string' ? e : e.url
        );

        const exists = normalizedUrls.includes(notebookUrl);
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
          logger.info({ notebookUrl, label }, 'Notebook added to project');
        }

        // Handle auto-upload of discovered sources
        let uploadResult = null;
        if (autoUpload && config.discoveredSources && config.discoveredSources.length > 0) {
          const urlSources = config.discoveredSources.filter(s => s.url && s.url.startsWith('http'));

          if (urlSources.length > 0) {
            logger.info({ count: urlSources.length }, 'Auto-uploading discovered sources');
            console.log(`[msw] Auto-uploading ${urlSources.length} discovered sources to notebook...`);

            try {
              // Dynamic import to avoid circular dependencies
              const { SourceUploader } = await import('../../sources/index.js');

              const sources = urlSources.map(s => ({
                type: 'url' as const,
                url: s.url,
                title: s.title,
              }));

              const uploader = new SourceUploader({
                notebookUrl,
                headless: false, // Show browser for user to see progress
              });

              const result = await uploader.uploadSources(sources);
              uploadResult = {
                attempted: urlSources.length,
                uploaded: result.uploaded,
                failed: result.failed,
                errors: result.errors.map(e => ({
                  url: e.source.url,
                  error: e.error,
                })),
              };

              logger.info({ uploadResult }, 'Source upload complete');
              console.log(`[msw] Uploaded ${result.uploaded}/${urlSources.length} sources`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              logger.error({ error: message }, 'Source upload failed');
              uploadResult = {
                attempted: urlSources.length,
                uploaded: 0,
                failed: urlSources.length,
                error: message,
              };
            }
          } else {
            uploadResult = {
              attempted: 0,
              message: 'No URL sources found in discoveredSources',
            };
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  notebook: {
                    url: notebookUrl,
                    label,
                    added: !exists,
                  },
                  totalNotebooks: config.notebookUrls.length,
                  autoUpload: uploadResult,
                  nextStep: uploadResult
                    ? 'Notebook added and sources uploaded. Ready for msw_research.'
                    : 'Notebook added. Run msw_research to start.',
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
              text: JSON.stringify({
                error: `.msw/config.json not found in ${projectDir}`,
                hint: "Run msw_init first to set up the project.",
              }),
            },
          ],
        };
      }
    },
  );
}
