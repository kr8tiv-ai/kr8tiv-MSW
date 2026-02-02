/**
 * Context injector: formats NotebookLM answers for coding agent consumption.
 *
 * Closes the bidirectional loop (BIDR-07) by producing self-contained
 * markdown that agents can use without additional context.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AgentContext } from '../types/bidirectional.js';

/**
 * Format a single agent context as self-contained markdown.
 */
export function formatForAgent(ctx: AgentContext): string {
  const lines: string[] = [
    '## NotebookLM Research Finding',
    '',
    `**Query:** ${ctx.query}`,
    `**Confidence:** ${ctx.confidence} (grounded in uploaded documentation)`,
  ];

  if (ctx.citations.length > 0) {
    lines.push(`**Sources:** ${ctx.citations.join(', ')}`);
  }

  lines.push('', ctx.answer, '', '---', '*Retrieved via MSW Protocol from NotebookLM*');

  return lines.join('\n');
}

/**
 * Formats and delivers research context to coding agents.
 */
export class ContextInjector {
  /** Format a single finding for agent consumption. */
  formatSingle(ctx: AgentContext): string {
    return formatForAgent(ctx);
  }

  /**
   * Combine a chain summary with the latest finding.
   */
  formatChainSummary(summary: string, latest?: AgentContext): string {
    if (!latest) {
      return summary;
    }

    return [summary, '', '---', '', formatForAgent(latest)].join('\n');
  }

  /**
   * Write formatted context to a file path.
   * Creates parent directories as needed.
   */
  async writeToFile(content: string, outputPath: string): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, 'utf-8');
  }
}
