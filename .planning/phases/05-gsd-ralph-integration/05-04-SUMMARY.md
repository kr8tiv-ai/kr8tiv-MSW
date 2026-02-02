---
phase: 05-gsd-ralph-integration
plan: 04
status: complete
---

# 05-04 Summary: Ralph Stop Hook

## What Was Built

`src/execution/stop-hook.ts` -- Standalone Node.js script that intercepts Claude Code exit via the hooks API.

## How It Works

1. Reads JSON from stdin (session_id, transcript_path, cwd, hook_event_name, stop_hook_active)
2. Loads Ralph state via IterationTracker
3. **Allows stop** (exit 0) when:
   - No active Ralph loop
   - Max iterations reached
   - Completion promise string found in transcript
   - Safety valve: stop_hook_active + at max iterations
4. **Blocks stop** (stdout JSON) when loop should continue:
   - Increments iteration counter
   - Builds continuation reason with prompt + optional NotebookLM guidance
   - Writes `{ "decision": "block", "reason": "..." }` to stdout

## Safety

- Entire script wrapped in try/catch -- any uncaught error allows stop (exit 0)
- Prevents broken hook from permanently blocking Claude Code

## Verification

- `npx tsc --noEmit` passes with no errors
