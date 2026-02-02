/**
 * Ralph Stop Hook — Standalone script for Claude Code hook system.
 *
 * Reads JSON from stdin, checks Ralph loop state, and either:
 * - Allows stop (exit 0): no active loop, max iterations reached, or completion found
 * - Blocks stop (stdout JSON + natural exit): injects continuation prompt
 *
 * Safety: entire script wrapped in try/catch — any error allows stop.
 */

import * as fs from 'node:fs';
import { IterationTracker } from './iteration-tracker.js';

interface StopHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: string;
  stop_hook_active?: boolean;
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const input: StopHookInput = JSON.parse(raw);

  const tracker = new IterationTracker(input.cwd);
  const state = tracker.load();

  // No active loop — allow stop
  if (!state || !state.active) {
    process.exit(0);
  }

  // Safety valve: if hook is re-entered and already at max, allow stop
  if (input.stop_hook_active === true && state.iteration >= state.maxIterations) {
    process.exit(0);
  }

  // Max iterations reached — allow stop
  if (state.iteration >= state.maxIterations) {
    process.exit(0);
  }

  // Check transcript for completion promise
  if (input.transcript_path) {
    try {
      const transcript = fs.readFileSync(input.transcript_path, 'utf-8');
      if (transcript.includes(state.completionPromise)) {
        process.exit(0);
      }
    } catch {
      // Transcript unreadable — continue looping (don't stop on read error)
    }
  }

  // Continue looping: increment iteration and build continuation reason
  const result = tracker.increment();
  const updatedState = tracker.load();

  if (result === 'exceeded') {
    // increment() set active=false and iteration hit max — allow stop
    process.exit(0);
  }

  const iteration = updatedState?.iteration ?? state.iteration + 1;
  const max = state.maxIterations;

  let reason = `Ralph Loop iteration ${iteration}/${max}. ${state.prompt}`;

  if (state.notebookLmGuidance) {
    reason += `\n\n## NotebookLM Guidance:\n${state.notebookLmGuidance}`;
  }

  // Block stop — write decision to stdout and let Node exit naturally
  const output = JSON.stringify({ decision: 'block', reason });
  process.stdout.write(output);
}

// Top-level safety net: any uncaught error allows stop
try {
  main().catch(() => {
    process.exit(0);
  });
} catch {
  process.exit(0);
}
