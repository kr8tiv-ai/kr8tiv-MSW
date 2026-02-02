/**
 * Two-tier query deduplication.
 *
 * Tier 1: SHA-256 hash of normalized query text (exact match).
 * Tier 2: Dice coefficient via string-similarity (near match, threshold 0.85).
 */

import { createHash } from 'node:crypto';
import stringSimilarity from 'string-similarity';
import type { DeduplicationResult } from '../types/bidirectional.js';

const SIMILARITY_THRESHOLD = 0.85;

/**
 * Normalize a query string for comparison:
 * lowercase, trimmed, punctuation stripped, whitespace collapsed.
 */
function normalize(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Compute SHA-256 hex digest of a string.
 */
function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export class QueryDeduplicator {
  private hashSet = new Set<string>();
  private queries: string[] = [];

  /**
   * Check whether a query is a duplicate of a previously recorded query.
   *
   * Tier 1 checks exact match via SHA-256 hash.
   * Tier 2 checks near match via Dice coefficient > 0.85.
   */
  isDuplicate(query: string): DeduplicationResult {
    const normalized = normalize(query);
    const hash = sha256(normalized);

    // Tier 1: exact hash match
    if (this.hashSet.has(hash)) {
      const matched = this.queries.find((q) => sha256(q) === hash);
      return { duplicate: true, matchedQuery: matched, similarity: 1.0 };
    }

    // Tier 2: fuzzy Dice coefficient match
    for (const recorded of this.queries) {
      const similarity = stringSimilarity.compareTwoStrings(
        normalized,
        recorded,
      );
      if (similarity >= SIMILARITY_THRESHOLD) {
        return { duplicate: true, matchedQuery: recorded, similarity };
      }
    }

    return { duplicate: false };
  }

  /**
   * Record a query so future calls to isDuplicate can detect it.
   */
  record(query: string): void {
    const normalized = normalize(query);
    const hash = sha256(normalized);
    this.hashSet.add(hash);
    this.queries.push(normalized);
  }

  /**
   * Clear all recorded queries. Use when starting a new session.
   */
  clear(): void {
    this.hashSet.clear();
    this.queries = [];
  }

  /**
   * Return all recorded normalized queries.
   */
  getRecordedQueries(): string[] {
    return [...this.queries];
  }
}
