# Phase 6: End-to-End Integration - Research

**Researched:** 2026-02-02
**Domain:** Integration testing, CLI entry points, crash recovery, documentation
**Confidence:** MEDIUM

## Summary

Phase 6 integrates all prior phases (browser automation, auto-conversation, bidirectional communication, knowledge persistence, MCP server, GSD+Ralph) into a validated end-to-end system. The codebase already has all modules scaffolded across `src/browser`, `src/auto-conversation`, `src/bidirectional`, `src/knowledge`, `src/mcp`, and `src/planning`. The MCP server entry point exists at `src/mcp/index.ts` with stdio transport and all 7 tools registered.

The primary work is: (1) wiring real implementations through the MCP tool handlers to underlying engines, (2) E2E test infrastructure, (3) crash recovery/state restoration, (4) user-facing documentation, and (5) production hardening.

**Primary recommendation:** Use Vitest for unit/integration tests and a custom E2E test harness that spawns the MCP server as a child process and communicates via stdio, since that mirrors real client usage.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.x | Test runner | Fast, TS-native, ESM support matches project config |
| @modelcontextprotocol/sdk | ^1.25.3 | MCP client for testing | Already in deps; use Client class to test server |
| playwright | ^1.58.1 | Browser E2E (already installed) | Already the browser engine |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| execa | ^9.x | Spawn MCP server process for E2E | Cleaner child_process wrapper for test harness |
| memfs | ^4.x | In-memory filesystem for knowledge persistence tests | Avoid real git/fs in unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | jest | Jest has worse ESM support; project uses ESM (`"type": "module"`) |
| execa | child_process | execa is cleaner but adds a dep; child_process works fine too |

**Installation:**
```bash
npm install -D vitest execa
```

## Architecture Patterns

### Recommended Test Structure
```
tests/
├── unit/              # Individual module tests (mocked deps)
│   ├── browser/
│   ├── auto-conversation/
│   ├── bidirectional/
│   ├── knowledge/
│   └── mcp/
├── integration/       # Cross-module tests (real deps, mock browser)
│   ├── research-pipeline.test.ts
│   ├── error-to-resolution.test.ts
│   └── knowledge-persistence.test.ts
└── e2e/               # Full pipeline with MCP server process
    ├── mcp-client.test.ts
    ├── crash-recovery.test.ts
    └── helpers/
        └── spawn-server.ts
```

### Pattern 1: MCP Server E2E Test Harness
**What:** Spawn the MCP server as a child process, connect via stdio using the SDK Client, call tools, and assert results.
**When to use:** Testing the full MCP tool flow end-to-end.
**Example:**
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function createTestClient() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/mcp/index.js"],
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

// Then call tools:
const result = await client.callTool({ name: "msw_init", arguments: { projectDir: "/tmp/test" } });
```

### Pattern 2: Graceful Degradation Chain
**What:** Each module exposes a health check; the pipeline degrades gracefully when a component is unavailable.
**When to use:** Browser not available, Ollama not running, git not configured.
**Example:**
```typescript
interface HealthCheck {
  component: string;
  healthy: boolean;
  degraded?: string; // what capability is lost
}

async function checkHealth(): Promise<HealthCheck[]> {
  return [
    await checkBrowser(),    // Can we launch Chrome?
    await checkOllama(),     // Is relevance scoring available?
    await checkGit(),        // Can we persist research?
  ];
}
```

### Pattern 3: State Snapshot for Crash Recovery
**What:** Serialize pipeline state to `.msw/state.json` at checkpoints; restore on restart.
**When to use:** Before/after each major operation (research session, query batch).
**Example:**
```typescript
interface PipelineState {
  sessionId: string;
  phase: "idle" | "researching" | "querying" | "persisting";
  pendingQueries: string[];
  completedQA: Array<{ q: string; a: string }>;
  lastCheckpoint: string; // ISO timestamp
}
```

### Anti-Patterns to Avoid
- **Testing MCP tools by importing handler functions directly:** This skips serialization/transport issues. Always test through the actual MCP protocol.
- **Mocking the browser for E2E tests:** E2E means real browser. Use integration tests for mocked browser scenarios.
- **Hardcoded paths in tests:** Use `os.tmpdir()` and unique test directories.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP client for testing | Custom stdio parser | `@modelcontextprotocol/sdk` Client class | Protocol compliance, error handling |
| Process spawning in tests | Raw child_process | execa or StdioClientTransport | Handles cleanup, signals, buffering |
| Config file validation | Manual if/else checking | zod schemas (already in deps) | Already using zod; consistent validation |
| Markdown doc generation | String templates | Simple template files + variable replacement | Maintainability |

## Common Pitfalls

### Pitfall 1: Stdio Buffering in E2E Tests
**What goes wrong:** MCP messages get stuck in Node.js stdio buffers, causing test timeouts.
**Why it happens:** Node buffers stdout when it detects a pipe (non-TTY).
**How to avoid:** The MCP SDK handles framing correctly. Ensure tests have proper timeouts and use the SDK transport, not raw pipes.
**Warning signs:** Tests pass locally but timeout in CI.

### Pitfall 2: Browser State Leaking Between Tests
**What goes wrong:** One test's browser session affects another.
**Why it happens:** Chrome profile persistence (by design) carries state.
**How to avoid:** Use separate profile directories per test or clean state between runs.
**Warning signs:** Tests pass individually but fail when run together.

### Pitfall 3: Orphaned Browser Processes
**What goes wrong:** Playwright browsers not cleaned up after test failures.
**Why it happens:** Test crash before `browser.close()`.
**How to avoid:** Use `afterEach`/`afterAll` hooks with process cleanup. Kill by PID if needed.
**Warning signs:** Multiple Chrome processes accumulating.

### Pitfall 4: NotebookLM Rate Limits in E2E
**What goes wrong:** E2E tests burn through the 50 queries/day limit.
**Why it happens:** Each test run sends real queries.
**How to avoid:** E2E tests against NotebookLM should be opt-in (env var gated), not part of regular CI. Use recorded fixtures for CI.
**Warning signs:** Tests fail after midday.

### Pitfall 5: MCP Server Doesn't Exit Cleanly
**What goes wrong:** Server process hangs after test, blocking CI.
**Why it happens:** Open handles (browser, event listeners) prevent Node exit.
**How to avoid:** Implement proper shutdown: close browser, clear intervals, then `process.exit`. The entry point already handles SIGINT/SIGTERM.
**Warning signs:** CI jobs timeout at cleanup.

## Code Examples

### CLI Entry Point Validation
```typescript
// src/mcp/index.ts already handles this well.
// For config validation, add:
import { z } from "zod";

const MswConfigSchema = z.object({
  notebookUrl: z.string().url(),
  profileDir: z.string().optional(),
  relevanceThreshold: z.number().min(0).max(100).default(30),
  maxDepth: z.number().min(1).max(10).default(5),
  maxQueriesPerDay: z.number().default(50),
});
```

### Crash Recovery - State Persistence
```typescript
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const STATE_FILE = ".msw/state.json";

async function saveCheckpoint(projectDir: string, state: PipelineState): Promise<void> {
  const path = join(projectDir, STATE_FILE);
  await writeFile(path, JSON.stringify(state, null, 2));
}

async function restoreCheckpoint(projectDir: string): Promise<PipelineState | null> {
  try {
    const raw = await readFile(join(projectDir, STATE_FILE), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
```

### E2E Test: Error-to-Resolution Pipeline
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("error-to-resolution pipeline", () => {
  let client: Client;

  beforeAll(async () => {
    client = await createTestClient();
    await client.callTool({ name: "msw_init", arguments: { projectDir: tmpDir } });
  });

  afterAll(async () => {
    await client.close();
  });

  it("researches an error and returns grounded answer", async () => {
    const result = await client.callTool({
      name: "msw_research",
      arguments: {
        query: "TypeError: Cannot read property 'map' of undefined",
        notebookUrl: "https://notebooklm.google.com/notebook/test",
      },
    });
    expect(result.content).toBeDefined();
    // Job ID pattern for long-running ops
    expect(result.content[0].text).toMatch(/jobId|answer/);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom MCP test clients | SDK provides Client + StdioClientTransport | MCP SDK 1.x | Use official client for testing |
| Jest for TS projects | Vitest dominates ESM TypeScript | 2024+ | Better DX, faster, native ESM |

## Open Questions

1. **NotebookLM test fixtures vs live testing**
   - What we know: Live tests burn rate limits; fixtures may go stale
   - What's unclear: Best fixture recording approach for NotebookLM responses
   - Recommendation: Record fixtures manually, gate live tests behind `MSW_LIVE_TESTS=1` env var

2. **Multi-client compatibility testing scope**
   - What we know: Claude Code, Cursor, Windsurf all use stdio MCP
   - What's unclear: Whether there are client-specific quirks in tool result handling
   - Recommendation: Test with MCP SDK client (covers protocol); manual smoke test with each real client

3. **CI environment for browser tests**
   - What we know: Playwright needs browser binaries installed
   - What's unclear: Whether the project will have CI initially
   - Recommendation: Document `npx playwright install chromium` as setup step; defer CI to post-v1

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/mcp/index.ts`, `src/mcp/server.ts`, `package.json`, `tsconfig.json`
- MCP SDK already in dependencies at ^1.25.3

### Secondary (MEDIUM confidence)
- Vitest as standard for ESM TypeScript projects (widely adopted, training data)
- MCP SDK Client class for testing (standard pattern from SDK docs)

### Tertiary (LOW confidence)
- execa recommendation (training data only, verify version)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - vitest recommendation from training data, not verified against latest
- Architecture: HIGH - based on actual codebase structure and MCP SDK patterns
- Pitfalls: HIGH - derived from concrete codebase analysis (stdio transport, browser state, rate limits)

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (stable domain, 30 days)
