# Phase 5: GSD + Ralph Integration - Research

**Researched:** 2026-02-02
**Domain:** Claude Code hooks API, Stop hook interception, Ralph Wiggum loop pattern, GSD state management, cross-platform shell scripting
**Confidence:** HIGH

## Summary

Phase 5 integrates two established patterns into MSW: GSD Protocol for research-grounded planning with file-based state persistence, and the Ralph Wiggum Loop for continuous autonomous execution with NotebookLM feedback on failures. The core technical challenge is implementing a Stop hook that intercepts Claude Code's exit attempts, checks for completion criteria, and re-injects prompts with NotebookLM-derived guidance when failures are detected.

Claude Code's hooks API (documented at https://code.claude.com/docs/en/hooks) provides first-class support for Stop hooks. Exit code 2 from a Stop hook prevents Claude from stopping and continues the conversation. The `stop_hook_active` field in the Stop hook input indicates when Claude is already continuing due to a prior stop hook, which is critical for preventing infinite loops. The hook receives JSON on stdin including `session_id`, `transcript_path`, and `cwd`, giving the hook script full context to evaluate whether work is complete.

The GSD component is simpler: it involves creating and maintaining STATE.md, ROADMAP.md, and PROJECT.md files, injecting NotebookLM findings into PRD generation, and translating between MSW's internal format and GSD's XML task structure. The project already has a `.planning/` directory with this exact pattern in use.

**Primary recommendation:** Implement Stop hook as a Node.js script (not Bash) for cross-platform Windows/macOS/Linux compatibility. Use the Claude Code JSON stdin/stdout protocol for structured decision control. Track iterations via a `.msw/ralph-state.json` file. Query NotebookLM via the existing bidirectional communication module (Phase 3) when failures are detected.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js (built-in `readline`, `fs`, `child_process`) | N/A | Stop hook script runtime, JSON stdin parsing, state file I/O | Cross-platform; already project runtime |
| `@modelcontextprotocol/sdk` | 1.25.3 | MCP tool calls from Ralph runner to MSW server | Already in project from Phase 4 |
| `simple-git` | ^3.30.0 | Git operations for state persistence and atomic commits | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gray-matter` | ^4.0.3 | Parse frontmatter from STATE.md/ROADMAP.md | Already in project; used for GSD file parsing |
| `zod` | ^4.3.6 | Validate Ralph state JSON, GSD task schemas | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js stop hook script | Bash stop hook | Bash fails on Windows without WSL; Node.js is cross-platform and already the project runtime |
| File-based iteration state (`.msw/ralph-state.json`) | Environment variables | Env vars don't persist across process restarts; file state survives crashes |
| Direct NotebookLM query from hook | Queuing to MCP server | Hook has 600s timeout by default; direct query is simpler and NotebookLM responses complete within 5s |

**Installation:**
```bash
# No new dependencies needed - all libraries already in package.json
npm install  # Ensures existing deps are current
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── planning/
│   ├── gsd-adapter.ts         # GSD-04: Translate MSW <-> GSD XML task format
│   ├── state-manager.ts       # GSD-01: Read/write STATE.md, ROADMAP.md, PROJECT.md
│   ├── prd-generator.ts       # GSD-02: Generate PRDs with NotebookLM research refs
│   └── phase-planner.ts       # GSD-03: Phase plans with research references
├── execution/
│   ├── ralph-runner.ts        # RALPH-01/02: Orchestrates loop, manages iterations
│   ├── stop-hook.ts           # RALPH-01: The Stop hook script (runs as CLI)
│   ├── iteration-tracker.ts   # RALPH-02: Counts attempts, enforces max-iterations
│   ├── feedback-injector.ts   # RALPH-04: Prepends NotebookLM guidance to prompt
│   ├── completion-detector.ts # RALPH-05: Checks success criteria before stopping
│   └── behavioral-verifier.ts # RALPH-06: Validates actual functionality
├── execution/
│   └── index.ts               # Barrel exports
└── planning/
    └── index.ts               # Barrel exports
```

### Pattern 1: Stop Hook as Node.js Script
**What:** The Stop hook is a standalone Node.js script that reads JSON from stdin, evaluates completion, and returns a JSON decision to stdout.
**When to use:** Every time Claude attempts to stop during a Ralph loop.
**Example:**
```typescript
// Source: Claude Code hooks reference (https://code.claude.com/docs/en/hooks)
// stop-hook.ts - compiled to dist/execution/stop-hook.js

import { readFileSync } from 'fs';
import { join } from 'path';

interface StopHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}

interface RalphState {
  active: boolean;
  prompt: string;
  iteration: number;
  maxIterations: number;
  completionPromise: string;
  lastError: string | null;
  notebookLmGuidance: string | null;
}

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const hookInput: StopHookInput = JSON.parse(input);

  // Load Ralph state
  const statePath = join(hookInput.cwd, '.msw', 'ralph-state.json');
  let state: RalphState;
  try {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    // No active Ralph loop - allow stop
    process.exit(0);
  }

  if (!state.active) {
    process.exit(0); // Allow stop
  }

  // Check max iterations
  if (state.iteration >= state.maxIterations) {
    // Allow stop - max iterations reached
    process.exit(0);
  }

  // Check completion promise in transcript
  const transcript = readFileSync(hookInput.transcript_path, 'utf8');
  if (transcript.includes(state.completionPromise)) {
    process.exit(0); // Completion detected - allow stop
  }

  // Block stop and re-inject prompt
  state.iteration++;
  // Write updated state back
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  // Build continuation reason
  let reason = `Ralph Loop iteration ${state.iteration}/${state.maxIterations}. `;
  reason += state.prompt;
  if (state.notebookLmGuidance) {
    reason += `\n\n## NotebookLM Guidance (from previous failure):\n${state.notebookLmGuidance}`;
  }

  // Return blocking decision
  const output = {
    decision: 'block',
    reason: reason
  };
  process.stdout.write(JSON.stringify(output));
});
```

### Pattern 2: GSD State File Management
**What:** Read and write GSD planning files (STATE.md, ROADMAP.md, PROJECT.md) with frontmatter metadata and structured sections.
**When to use:** When initializing MSW for a project or updating state during execution.
**Example:**
```typescript
// state-manager.ts
import matter from 'gray-matter';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface GsdState {
  currentPhase: number;
  decisions: Record<string, string>;
  blockers: string[];
  iterationHistory: Array<{
    iteration: number;
    timestamp: string;
    result: 'success' | 'failure';
    error?: string;
  }>;
}

export function readState(projectDir: string): GsdState {
  const statePath = join(projectDir, '.planning', 'STATE.md');
  const { data, content } = matter(readFileSync(statePath, 'utf8'));
  return data as GsdState;
}

export function updateState(projectDir: string, updates: Partial<GsdState>): void {
  const statePath = join(projectDir, '.planning', 'STATE.md');
  const { data, content } = matter(readFileSync(statePath, 'utf8'));
  const updated = { ...data, ...updates };
  const output = matter.stringify(content, updated);
  writeFileSync(statePath, output);
}
```

### Pattern 3: GSD XML Task Format Adapter
**What:** Translates MSW internal task representation to/from GSD's XML task format used in PLAN.md files.
**When to use:** When generating plans or reading existing GSD plans.
**Example:**
```typescript
// gsd-adapter.ts
interface MswTask {
  id: string;
  name: string;
  files: string[];
  action: string;
  verify: string;
  done: string;
}

export function toGsdXml(tasks: MswTask[]): string {
  return tasks.map(t => `<task id="${t.id}">
  <name>${t.name}</name>
  <files>${t.files.join(', ')}</files>
  <action>${t.action}</action>
  <verify>${t.verify}</verify>
  <done>${t.done}</done>
</task>`).join('\n\n');
}

export function fromGsdXml(xml: string): MswTask[] {
  // Parse XML task elements back to MswTask objects
  const taskRegex = /<task id="([^"]+)">([\s\S]*?)<\/task>/g;
  const tasks: MswTask[] = [];
  let match;
  while ((match = taskRegex.exec(xml)) !== null) {
    const id = match[1];
    const body = match[2];
    tasks.push({
      id,
      name: extractTag(body, 'name'),
      files: extractTag(body, 'files').split(',').map(f => f.trim()),
      action: extractTag(body, 'action'),
      verify: extractTag(body, 'verify'),
      done: extractTag(body, 'done'),
    });
  }
  return tasks;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
  return match ? match[1].trim() : '';
}
```

### Pattern 4: NotebookLM Failure Feedback Loop
**What:** When a Ralph iteration fails, query NotebookLM with the error context and inject the guidance into the next iteration.
**When to use:** RALPH-03 and RALPH-04 -- when iteration fails and the stop hook re-injects.
**Example:**
```typescript
// feedback-injector.ts
import { ErrorBridge } from '../bidirectional/error-bridge.js';
import { ContextInjector } from '../bidirectional/context-injector.js';

export async function getFailureGuidance(
  error: string,
  taskContext: string,
  notebookUrl: string,
): Promise<string> {
  // Format the error for NotebookLM using existing Phase 3 code
  const bridge = new ErrorBridge();
  const query = bridge.formatError(error, taskContext);

  // Query NotebookLM via the bidirectional module
  const injector = new ContextInjector();
  const response = await injector.queryAndExtract(query, notebookUrl);

  return response.compiledAnswer;
}
```

### Anti-Patterns to Avoid
- **Bash-only stop hooks:** Will fail on Windows. Always use Node.js scripts.
- **In-memory iteration tracking:** Lost on crash. Always persist to `.msw/ralph-state.json`.
- **Checking transcript for completion in the hook directly:** Transcript can be large; use `stop_hook_active` field to detect re-entry and limit reads.
- **Infinite loop without safety:** Always check `stop_hook_active` and respect `maxIterations`.
- **Synchronous NotebookLM queries in the stop hook:** The hook has a 600s default timeout, but NotebookLM queries should be done asynchronously or cached from the previous iteration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON stdin parsing in hook | Custom stream reader | Node.js `process.stdin` with `on('data')` + `on('end')` | Standard pattern, handles chunked input |
| XML task parsing | Full XML parser | Regex-based extraction for GSD's simple format | GSD XML is flat (no nesting), regex is sufficient and avoids xml2js dependency |
| Frontmatter parsing | Custom YAML parser | `gray-matter` (already in project) | Battle-tested, handles edge cases |
| Git commit operations | Raw `child_process` git calls | `simple-git` (already in project) | Handles escaping, error messages, cross-platform paths |
| Completion promise detection | Custom transcript parser | String search on `transcript_path` file | Completion promise is an exact string match |

**Key insight:** Phase 5 is primarily an integration phase. Almost all building blocks exist from Phases 1-4. The new code is the Stop hook script, the iteration tracker, the GSD adapter, and the wiring that connects NotebookLM feedback to the Ralph loop.

## Common Pitfalls

### Pitfall 1: Stop Hook Infinite Loop
**What goes wrong:** Stop hook blocks every stop attempt indefinitely, burning tokens forever.
**Why it happens:** No max-iterations check or `stop_hook_active` guard in the hook.
**How to avoid:** Always check `state.iteration >= state.maxIterations` and the `stop_hook_active` field. When `stop_hook_active` is true AND max iterations reached, exit 0.
**Warning signs:** Token usage spikes, no progress between iterations, identical errors repeating.

### Pitfall 2: Windows Path Issues in Hooks
**What goes wrong:** Hook script paths with backslashes fail, or `$CLAUDE_PROJECT_DIR` resolves incorrectly.
**Why it happens:** Windows uses backslashes; Node.js `path.join` handles this but shell commands may not.
**How to avoid:** Always use `node` as the hook command runner: `"command": "node \"$CLAUDE_PROJECT_DIR/dist/execution/stop-hook.js\""`. Node.js normalizes paths internally.
**Warning signs:** "File not found" errors on Windows, hooks that work on macOS but fail on Windows.

### Pitfall 3: Stale Ralph State After Crash
**What goes wrong:** MSW crashes mid-iteration, `.msw/ralph-state.json` says `active: true` with stale data, next session gets stuck.
**Why it happens:** No cleanup on abnormal exit.
**How to avoid:** Include a SessionStart hook that checks for stale Ralph state (e.g., `lastHeartbeat` older than 1 hour) and resets it. Also expose `msw_status` MCP tool to show Ralph loop state.
**Warning signs:** Claude refusing to stop on first message of a new session.

### Pitfall 4: NotebookLM Rate Limit During Failure Loop
**What goes wrong:** Every failed iteration queries NotebookLM, burning through the 50 queries/day limit.
**Why it happens:** No deduplication of failure queries.
**How to avoid:** Track queried errors in Ralph state. If the same error (or semantically similar) was already queried, skip NotebookLM and use cached guidance. Use the deduplication module from Phase 3.
**Warning signs:** Rate limit hit after 10-15 iterations on the same error.

### Pitfall 5: Stop Hooks in Skills Never Fire (Known Bug)
**What goes wrong:** Stop hooks defined in SKILL.md frontmatter don't fire.
**Why it happens:** Known Claude Code bug as of January 2026 (https://github.com/anthropics/claude-code/issues/19225).
**How to avoid:** Define Stop hooks in `.claude/settings.json` or `.claude/settings.local.json` instead of skill frontmatter. PreToolUse hooks in skills DO work.
**Warning signs:** Ralph loop never intercepts exit; Claude exits normally despite active loop.

### Pitfall 6: Behavioral Verification False Positives
**What goes wrong:** Completion detector checks for file existence or code structure but the code doesn't actually work.
**Why it happens:** Structural checks (file exists, function defined) don't validate behavior.
**How to avoid:** RALPH-06 requires running actual tests, hitting actual endpoints, or executing the code. Use `Bash` tool invocations in an agent-type hook to verify.
**Warning signs:** "All checks passed" but manual testing reveals broken functionality.

## Code Examples

### Stop Hook Configuration (`.claude/settings.json`)
```json
// Source: Claude Code hooks reference (https://code.claude.com/docs/en/hooks)
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/dist/execution/stop-hook.js\"",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### Agent-Based Behavioral Verification Hook
```json
// Source: Claude Code hooks reference - agent hooks
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify the current task's success criteria are met. Read .msw/ralph-state.json for the current task. Run tests if specified. Check that behavioral requirements pass, not just structural ones. Context: $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### Ralph State File Format
```json
// .msw/ralph-state.json
{
  "active": true,
  "prompt": "Implement feature X. Output <promise>COMPLETE</promise> when done.",
  "completionPromise": "<promise>COMPLETE</promise>",
  "iteration": 3,
  "maxIterations": 50,
  "startedAt": "2026-02-02T10:00:00Z",
  "lastHeartbeat": "2026-02-02T10:15:00Z",
  "lastError": "TypeError: Cannot read properties of undefined",
  "notebookLmGuidance": "Based on the documentation, this error occurs when...",
  "queriedErrors": [
    "TypeError: Cannot read properties of undefined"
  ],
  "taskContext": {
    "phase": 2,
    "planId": "02-03",
    "description": "Multi-level topic expansion"
  }
}
```

### GSD State File Format (STATE.md)
```markdown
---
currentPhase: 2
status: in-progress
lastUpdated: 2026-02-02T10:00:00Z
decisions:
  runtime: "Node.js with TypeScript"
  browser: "Playwright with stealth"
  transport: "stdio MCP"
blockers: []
---

# MSW Protocol - State

## Current Phase
Phase 2: Auto-Conversation Engine (in progress)

## Iteration History
| Iteration | Phase | Plan | Result | Error |
|-----------|-------|------|--------|-------|
| 1 | 2 | 02-03 | failure | Timeout on topic expansion |
| 2 | 2 | 02-03 | success | - |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bash `while true` loop (Ralph original) | Claude Code Stop hook (exit code 2) | Late 2025 | Native integration, no external loop script needed |
| `decision: "block"` (deprecated for PreToolUse) | `hookSpecificOutput.permissionDecision` | 2025 | Stop hooks still use top-level `decision: "block"` |
| No `stop_hook_active` field | `stop_hook_active` boolean in Stop input | 2025 | Enables safe re-entry detection to prevent infinite loops |
| Prompt hooks only | Agent hooks (`type: "agent"`) | 2026 | Agents can use tools (Read, Grep, Glob) to verify conditions before deciding |

**Deprecated/outdated:**
- **Bash while-loop Ralph:** Still works but unnecessary with native Stop hooks. The hook-based approach is preferred as it runs inside the Claude Code session with full context.
- **Top-level `decision`/`reason` for PreToolUse:** Deprecated in favor of `hookSpecificOutput`. However, Stop hooks still use top-level `decision: "block"` as their current format.

## Open Questions

1. **Hook execution on Windows with Node.js**
   - What we know: Node.js scripts work cross-platform. `$CLAUDE_PROJECT_DIR` is available as an env var.
   - What's unclear: Whether Claude Code on Windows properly resolves the env var in the `command` field with double-quoted paths. The official docs show Unix-style examples only.
   - Recommendation: Test on Windows early (plan 05-04). If env var expansion fails, use an absolute path or a `.cmd` wrapper.

2. **Agent-type hook vs command-type for behavioral verification**
   - What we know: Agent hooks can use tools (Read, Grep, Bash) to verify. Command hooks just run a script.
   - What's unclear: Agent hooks use a "fast model" by default. Whether that model is accurate enough for nuanced verification.
   - Recommendation: Start with agent-type hook for RALPH-06. If verification accuracy is insufficient, fall back to command hook that runs a Node.js script invoking tests directly.

3. **Stop hook + SubagentStop interaction**
   - What we know: Stop hooks fire for main agent. For subagents, they auto-convert to SubagentStop.
   - What's unclear: If Ralph loop runs within a GSD subagent execution, does SubagentStop fire instead of Stop?
   - Recommendation: Register hooks for BOTH Stop and SubagentStop with the same handler. The input format is compatible.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Complete hooks API: events, matchers, JSON I/O, exit codes, Stop hook behavior, agent hooks
- [Ralph Wiggum Plugin (Anthropic)](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum) - Official plugin: stop hook architecture, completion promise detection, iteration tracking

### Secondary (MEDIUM confidence)
- [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code) - Community implementation: dual-condition exit, circuit breaker, rate limiting patterns
- [GSD Claude Code](https://github.com/b-r-a-n/gsd-claude) - GSD framework: XML task format, state persistence, phase-based planning
- [GSD Framework overview](https://pasqualepillitteri.it/en/news/169/gsd-framework-claude-code-ai-development) - GSD architecture: context engineering, sub-agent orchestration

### Tertiary (LOW confidence)
- [Claude Code hooks bug #19225](https://github.com/anthropics/claude-code/issues/19225) - Stop hooks in Skills don't fire (known bug, may be fixed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; no new dependencies
- Architecture: HIGH - Stop hook API is well-documented with clear JSON protocol; GSD pattern already used in this project
- Pitfalls: HIGH - Known bugs documented in GitHub issues; cross-platform concerns are well-understood
- Behavioral verification: MEDIUM - Agent-type hooks are newer; real-world accuracy of fast-model verification unclear

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - Claude Code hooks API is stable)
