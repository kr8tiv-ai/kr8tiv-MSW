/**
 * Feedback injector for the Ralph loop.
 *
 * Queries NotebookLM when the agent encounters errors, caches guidance,
 * and deduplicates to avoid re-querying similar errors.
 */

import type { IterationTracker } from './iteration-tracker.js';
import type { ErrorBridge } from '../bidirectional/error-bridge.js';
import type { QueryInjector } from '../bidirectional/query-injector.js';
import type { AgentError } from '../types/bidirectional.js';

/**
 * Compute word-level similarity between two strings.
 * Returns a ratio from 0 to 1 representing shared word overlap.
 */
function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return shared / union;
}

const SIMILARITY_THRESHOLD = 0.8;

export class FeedbackInjector {
  private readonly tracker: IterationTracker;
  private readonly errorBridge: ErrorBridge;
  private readonly queryInjector: QueryInjector;

  constructor(
    tracker: IterationTracker,
    errorBridge: ErrorBridge,
    queryInjector: QueryInjector,
  ) {
    this.tracker = tracker;
    this.errorBridge = errorBridge;
    this.queryInjector = queryInjector;
  }

  /**
   * Get guidance for an error. Returns cached guidance if a similar error
   * was already queried, otherwise queries NotebookLM and caches the result.
   */
  async getGuidance(
    error: string,
    taskContext: string,
  ): Promise<string | null> {
    const state = this.tracker.load();
    if (!state) {
      console.warn('[feedback-injector] No Ralph state found');
      return null;
    }

    // Check for duplicate error (>80% word similarity with a previously queried error)
    const isDuplicate = state.queriedErrors.some(
      (prev) => wordSimilarity(prev, error) >= SIMILARITY_THRESHOLD,
    );

    if (isDuplicate && state.notebookLmGuidance) {
      return state.notebookLmGuidance;
    }

    // Format error as an AgentError and create a query
    const agentError: AgentError = { message: error };
    const query = this.errorBridge.formatQuery(agentError, taskContext);

    try {
      const qaPair = await this.queryInjector.inject(query);
      const guidance = qaPair.answer;

      // Persist guidance and mark error as queried
      this.tracker.recordGuidance(guidance);
      this.tracker.addQueriedError(error);

      return guidance;
    } catch (err) {
      console.warn(
        '[feedback-injector] NotebookLM query failed:',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }
}
