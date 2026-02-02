/**
 * Metadata tracker: tracks per-session research statistics.
 *
 * Records query sources, relevance scores, and timing (KNOW-03).
 */

import type { QAPair } from '../types/bidirectional.js';

/**
 * Tracks metadata for a single research session.
 */
export class MetadataTracker {
  readonly sessionId: string;
  readonly notebook: string;
  readonly startTime: Date;

  private queryCounts = { 'auto-expansion': 0, 'error-bridge': 0, manual: 0 };
  private relevanceScores: number[] = [];

  constructor(sessionId: string, notebook: string) {
    this.sessionId = sessionId;
    this.notebook = notebook;
    this.startTime = new Date();
  }

  /** Record a query event with optional relevance score. */
  recordQuery(source: QAPair['source'], relevanceScore?: number): void {
    this.queryCounts[source]++;
    if (relevanceScore !== undefined) {
      this.relevanceScores.push(relevanceScore);
    }
  }

  /** Get aggregate statistics for this session. */
  getStats(): {
    totalQueries: number;
    avgRelevance: number;
    bySource: Record<string, number>;
  } {
    const total = Object.values(this.queryCounts).reduce((a, b) => a + b, 0);
    const avg =
      this.relevanceScores.length > 0
        ? this.relevanceScores.reduce((a, b) => a + b, 0) /
          this.relevanceScores.length
        : 0;

    return {
      totalQueries: total,
      avgRelevance: avg,
      bySource: { ...this.queryCounts },
    };
  }

  /** Return an object suitable for YAML frontmatter inclusion. */
  toFrontmatter(): Record<string, unknown> {
    const stats = this.getStats();
    return {
      sessionId: this.sessionId,
      notebook: this.notebook,
      startTime: this.startTime.toISOString(),
      totalQueries: stats.totalQueries,
      avgRelevance: stats.avgRelevance,
      queryBreakdown: stats.bySource,
    };
  }
}
