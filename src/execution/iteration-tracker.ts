/**
 * File-based iteration tracker for Ralph loop state.
 * Persists state to .msw/ralph-state.json and survives process restarts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type RalphState,
  type RalphConfig,
  type IterationResult,
  RalphStateSchema,
  DEFAULT_MAX_ITERATIONS,
} from '../types/execution.js';

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export class IterationTracker {
  private readonly projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /** Path to the persisted state file */
  get statePath(): string {
    return path.join(this.projectDir, '.msw', 'ralph-state.json');
  }

  /** Initialize a new Ralph loop, creating .msw dir if needed */
  init(config: RalphConfig): void {
    const mswDir = path.join(this.projectDir, '.msw');
    if (!fs.existsSync(mswDir)) {
      fs.mkdirSync(mswDir, { recursive: true });
    }

    const now = new Date().toISOString();
    const state: RalphState = {
      active: true,
      prompt: config.prompt,
      completionPromise: config.completionPromise,
      iteration: 0,
      maxIterations: config.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      startedAt: now,
      lastHeartbeat: now,
      lastError: null,
      notebookLmGuidance: null,
      queriedErrors: [],
      taskContext: config.taskContext,
    };

    this.save(state);
  }

  /** Load state from disk. Returns null if file not found or invalid. */
  load(): RalphState | null {
    if (!fs.existsSync(this.statePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      const data: unknown = JSON.parse(raw);
      return RalphStateSchema.parse(data) as RalphState;
    } catch {
      return null;
    }
  }

  /** Increment iteration, update heartbeat, check limits. */
  increment(): IterationResult {
    const state = this.load();
    if (!state) {
      throw new Error('No Ralph state found. Call init() first.');
    }

    state.iteration += 1;
    state.lastHeartbeat = new Date().toISOString();

    if (state.iteration >= state.maxIterations) {
      state.active = false;
      this.save(state);
      return 'exceeded';
    }

    this.save(state);
    return 'continue';
  }

  /** Record an error in state */
  recordError(error: string): void {
    const state = this.requireState();
    state.lastError = error;
    state.lastHeartbeat = new Date().toISOString();
    this.save(state);
  }

  /** Record NotebookLM guidance in state */
  recordGuidance(guidance: string): void {
    const state = this.requireState();
    state.notebookLmGuidance = guidance;
    state.lastHeartbeat = new Date().toISOString();
    this.save(state);
  }

  /** Append an error to the queriedErrors list */
  addQueriedError(error: string): void {
    const state = this.requireState();
    state.queriedErrors.push(error);
    state.lastHeartbeat = new Date().toISOString();
    this.save(state);
  }

  /** Check if state is stale (lastHeartbeat > 1 hour ago) */
  isStale(): boolean {
    const state = this.load();
    if (!state) return false;

    const elapsed = Date.now() - new Date(state.lastHeartbeat).getTime();
    return elapsed > STALE_THRESHOLD_MS;
  }

  /** Deactivate the Ralph loop */
  reset(): void {
    const state = this.load();
    if (!state) return;

    state.active = false;
    state.lastHeartbeat = new Date().toISOString();
    this.save(state);
  }

  /** Update heartbeat timestamp */
  heartbeat(): void {
    const state = this.requireState();
    state.lastHeartbeat = new Date().toISOString();
    this.save(state);
  }

  private save(state: RalphState): void {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  private requireState(): RalphState {
    const state = this.load();
    if (!state) {
      throw new Error('No Ralph state found. Call init() first.');
    }
    return state;
  }
}
