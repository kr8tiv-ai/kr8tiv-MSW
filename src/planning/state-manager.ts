/**
 * GSD state persistence -- reads/writes .planning/STATE.md with frontmatter.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { GsdState, IterationRecord } from '../types/planning.js';

const STATE_FILE = '.planning/STATE.md';

function statePath(projectDir: string): string {
  return path.join(projectDir, STATE_FILE);
}

const DEFAULT_STATE: GsdState = {
  currentPhase: '01',
  status: 'init',
  lastUpdated: new Date().toISOString(),
  decisions: {},
  blockers: [],
  iterationHistory: [],
};

/**
 * Read GSD state from .planning/STATE.md.
 * Returns parsed frontmatter as GsdState.
 */
export function readState(projectDir: string): GsdState {
  const fp = statePath(projectDir);
  if (!fs.existsSync(fp)) {
    throw new Error(`STATE.md not found at ${fp}. Run initState first.`);
  }
  const raw = fs.readFileSync(fp, 'utf-8');
  const { data } = matter(raw);
  return data as GsdState;
}

/**
 * Merge partial updates into existing STATE.md, preserving markdown content.
 */
export function updateState(projectDir: string, updates: Partial<GsdState>): void {
  const fp = statePath(projectDir);
  if (!fs.existsSync(fp)) {
    throw new Error(`STATE.md not found at ${fp}. Run initState first.`);
  }
  const raw = fs.readFileSync(fp, 'utf-8');
  const parsed = matter(raw);
  const merged: GsdState = {
    ...(parsed.data as GsdState),
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  const output = matter.stringify(parsed.content, merged);
  fs.writeFileSync(fp, output, 'utf-8');
}

/**
 * Create .planning/STATE.md with default state if it does not exist.
 */
export function initState(projectDir: string, config: { name: string }): void {
  const dir = path.join(projectDir, '.planning');
  fs.mkdirSync(dir, { recursive: true });

  const fp = statePath(projectDir);
  if (fs.existsSync(fp)) {
    return; // already initialized
  }

  const state: GsdState = {
    ...DEFAULT_STATE,
    lastUpdated: new Date().toISOString(),
  };

  const content = `# ${config.name} -- GSD State\n\nManaged by MSW Protocol.\n`;
  const output = matter.stringify(content, state);
  fs.writeFileSync(fp, output, 'utf-8');
}

/**
 * Append an iteration record to the state's iterationHistory.
 */
export function addIterationRecord(projectDir: string, record: IterationRecord): void {
  const state = readState(projectDir);
  const history = [...state.iterationHistory, record];
  updateState(projectDir, { iterationHistory: history });
}
