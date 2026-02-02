/**
 * Report compiler: converts Q&A pairs to structured markdown with YAML frontmatter.
 *
 * Produces persistent research reports (KNOW-01) suitable for version control.
 */

import matter from 'gray-matter';
import { join } from 'node:path';
import type { ResearchReport, QAPair } from '../types/bidirectional.js';

/**
 * Compile a research report into markdown with YAML frontmatter.
 */
export function compileReport(report: ResearchReport): string {
  const frontmatter: Record<string, unknown> = {
    sessionId: report.sessionId,
    notebook: report.notebook,
    taskGoal: report.taskGoal,
    queryCount: report.pairs.length,
    startTime: report.startTime.toISOString(),
    endTime: report.endTime.toISOString(),
    sources: [...new Set(report.pairs.map((p) => p.source))],
  };

  const bodyLines: string[] = [];

  report.pairs.forEach((pair: QAPair, index: number) => {
    bodyLines.push(`## Q${index + 1}: ${pair.question}`);
    bodyLines.push('');

    const meta: string[] = [`Source: ${pair.source}`];
    if (pair.relevanceScore !== undefined) {
      meta.push(`Relevance: ${pair.relevanceScore}`);
    }
    meta.push(`Timestamp: ${pair.timestamp.toISOString()}`);
    bodyLines.push(`> ${meta.join(' | ')}`);
    bodyLines.push('');

    bodyLines.push(pair.answer);

    if (pair.citations && pair.citations.length > 0) {
      bodyLines.push('');
      bodyLines.push(`**Citations:** ${pair.citations.join(', ')}`);
    }

    bodyLines.push('');
  });

  const body = bodyLines.join('\n');
  return matter.stringify(body, frontmatter);
}

/**
 * Compiles research reports to structured markdown.
 */
export class ReportCompiler {
  /** Compile a report to markdown with YAML frontmatter. */
  compile(report: ResearchReport): string {
    return compileReport(report);
  }

  /** Get the canonical file path for a session report. */
  getFilePath(sessionId: string, baseDir: string): string {
    return join(baseDir, '.msw', 'research', 'sessions', `${sessionId}.md`);
  }
}
