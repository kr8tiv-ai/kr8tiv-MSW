/**
 * Rich error context formatting for NotebookLM queries.
 */

import { AgentError, ErrorQueryOptions } from '../types/bidirectional.js';

const DEFAULT_MAX_LENGTH = 2000;
const TRUNCATION_SUFFIX = '... [truncated]';

export function truncateToLimit(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

export function formatErrorQuery(
  error: AgentError,
  taskGoal: string,
  options?: ErrorQueryOptions,
): string {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;
  const parts: string[] = [];

  parts.push(`I'm working on: ${taskGoal}`);
  parts.push(`I'm getting this error: ${error.message}`);

  if (error.file) {
    const location = error.line != null ? `${error.file}:${error.line}` : error.file;
    parts.push(`In file: ${location}`);
  }

  if (error.codeSnippet) {
    parts.push(`Relevant code:\n${error.codeSnippet}`);
  }

  if (error.attemptedFixes && error.attemptedFixes.length > 0) {
    parts.push(`I already tried:\n${error.attemptedFixes.map((f) => `- ${f}`).join('\n')}`);
  }

  if (error.technology) {
    parts.push(`Technology: ${error.technology}`);
  }

  parts.push("What's the correct approach based on the documentation?");

  if (options?.includeStackTrace && error.stackTrace) {
    parts.push(`Stack trace:\n${error.stackTrace}`);
  }

  const query = parts.join('\n\n');
  return truncateToLimit(query, maxLength);
}
