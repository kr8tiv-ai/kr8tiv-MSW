/**
 * MCP Tool: msw_upload_sources
 *
 * Upload files and URLs to a NotebookLM notebook
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SourceUploader, type SourceItem } from '../../sources/index.js';

export function registerMswUploadSources(server: McpServer): void {
  server.tool(
    'msw_upload_sources',
    'Upload files and URLs to a NotebookLM notebook. Supports .md, .txt, .pdf, .docx files and web URLs.',
    {
      notebookUrl: z
        .string()
        .describe('NotebookLM notebook URL (https://notebooklm.google.com/notebook/xxx)'),
      sources: z
        .array(
          z.object({
            type: z.enum(['file', 'url']).describe('Source type: file or url'),
            path: z.string().optional().describe('File path (required for type=file)'),
            url: z.string().optional().describe('URL (required for type=url)'),
            title: z.string().optional().describe('Optional display title'),
          }),
        )
        .describe('Array of sources to upload'),
      headless: z
        .boolean()
        .optional()
        .default(false)
        .describe('Run browser in headless mode (default: false for visibility)'),
    },
    async ({ notebookUrl, sources, headless }) => {
      try {
        // Validate sources
        const validation = SourceUploader.validateSources(sources as SourceItem[]);
        if (!validation.valid) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: 'Source validation failed',
                    details: validation.errors,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Upload sources
        const uploader = new SourceUploader({
          notebookUrl,
          headless,
        });

        const result = await uploader.uploadSources(sources as SourceItem[]);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result.success,
                  uploaded: result.uploaded,
                  failed: result.failed,
                  errors: result.errors.map((e) => ({
                    source: e.source.path || e.source.url,
                    error: e.error,
                  })),
                  message: result.success
                    ? `Successfully uploaded ${result.uploaded} source(s) to NotebookLM`
                    : `Uploaded ${result.uploaded} source(s), ${result.failed} failed`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}
