# Phase 4: MCP Server - Research

**Researched:** 2026-02-02
**Domain:** Model Context Protocol server, stdio transport, tool registration, long-running operations, multi-client compatibility
**Confidence:** HIGH

## Summary

Phase 4 wraps all MSW capabilities (init, research, plan, execute, verify, status, notebook management) as MCP tools exposed via stdio transport. The `@modelcontextprotocol/sdk` package (v1.25.3 stable) provides a high-level `McpServer` class with a `server.tool()` API that accepts Zod schemas directly -- which the project already uses (zod ^4.3.6 in package.json). The server connects via `StdioServerTransport` which is the universal transport supported by Claude Code, Windsurf, and Cursor.

For long-running operations (MCP-09), the formal Tasks SEP-1686 is still experimental and not finalized until mid-2026. The pragmatic approach is to implement the established "job ID" pattern: long-running tools (`msw_research`, `msw_execute`, `msw_plan`) return a job ID immediately, and a `msw_status` tool (MCP-07) doubles as the polling mechanism. This is backward-compatible and works today. When Tasks SEP lands in the SDK, migration is straightforward since the pattern is identical conceptually.

**Primary recommendation:** Use `McpServer` from `@modelcontextprotocol/sdk` v1.x with `StdioServerTransport`. Register each MSW capability as a separate tool with Zod input schemas. Implement job queue with in-memory Map + event emitter for long-running operations. Ship a single `bin` entry point (`msw-mcp-server`) that clients configure via their JSON config files.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 1.25.3 | MCP server framework (McpServer, StdioServerTransport) | Official SDK, used by all MCP servers |
| [zod](https://www.npmjs.com/package/zod) | ^4.3.6 | Tool input schema validation | Already in project; required peer dep of MCP SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | N/A | Generate job UUIDs | For long-running operation IDs |
| Node.js `events` (built-in) | N/A | EventEmitter for job state changes | Internal job queue notifications |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory job Map | SQLite/BullMQ | Over-engineered for single-process server; add if persistence needed later |
| StdioServerTransport | StreamableHttpTransport | Stdio is universal across all 3 target clients; HTTP only needed for remote deployment |
| Low-level `Server` class | `McpServer` high-level | McpServer handles tool listing/routing automatically; use low-level only for custom protocols |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── mcp/
│   ├── server.ts            # McpServer setup, transport connection
│   ├── tools/
│   │   ├── msw-init.ts      # MCP-02: Initialize MSW for a project
│   │   ├── msw-research.ts  # MCP-03: Trigger NotebookLM extraction
│   │   ├── msw-plan.ts      # MCP-04: Generate PRD from research
│   │   ├── msw-execute.ts   # MCP-05: Run Ralph loop
│   │   ├── msw-verify.ts    # MCP-06: Verify implementation
│   │   ├── msw-status.ts    # MCP-07: Report progress + poll jobs
│   │   └── msw-notebook-add.ts  # MCP-08: Add notebooks to library
│   ├── jobs/
│   │   ├── job-manager.ts   # MCP-09: Job queue with Map<string, Job>
│   │   └── types.ts         # Job states, result types
│   └── index.ts             # Entry point (bin target)
```

### Pattern 1: High-Level McpServer with server.tool()
**What:** Use `McpServer` class which auto-handles `tools/list` and `tools/call` routing
**When to use:** Always (unless needing custom protocol handling)
**Example:**
```typescript
// Source: https://github.com/modelcontextprotocol/typescript-sdk
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "msw-protocol",
  version: "0.1.0",
});

server.tool(
  "msw_init",
  "Initialize MSW for a project directory",
  {
    projectDir: z.string().describe("Absolute path to the project directory"),
    notebookSources: z.array(z.string()).optional().describe("URLs or paths to notebook sources"),
  },
  async ({ projectDir, notebookSources }) => {
    // Phase 3 engine call: initialize .msw/ directory, config, etc.
    const result = await mswEngine.init(projectDir, notebookSources);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

// Register all other tools...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 2: Job ID Pattern for Long-Running Operations
**What:** Tools that take >30s return a job ID immediately; `msw_status` polls for completion
**When to use:** `msw_research`, `msw_execute`, `msw_plan` (all long-running)
**Example:**
```typescript
import { randomUUID } from "node:crypto";

interface Job {
  id: string;
  tool: string;
  status: "queued" | "running" | "completed" | "failed";
  progress?: { step: number; total: number; message: string };
  result?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobs = new Map<string, Job>();

server.tool(
  "msw_research",
  "Trigger NotebookLM extraction session (long-running, returns job ID)",
  {
    projectDir: z.string().describe("Project directory with .msw/ config"),
    topic: z.string().describe("Research topic or question"),
  },
  async ({ projectDir, topic }) => {
    const jobId = randomUUID();
    const job: Job = {
      id: jobId,
      tool: "msw_research",
      status: "queued",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jobs.set(jobId, job);

    // Fire and forget -- engine runs in background
    runResearchJob(jobId, projectDir, topic).catch((err) => {
      const j = jobs.get(jobId);
      if (j) { j.status = "failed"; j.error = String(err); j.updatedAt = new Date(); }
    });

    return {
      content: [{ type: "text", text: JSON.stringify({ jobId, status: "queued", pollWith: "msw_status" }) }],
    };
  }
);

server.tool(
  "msw_status",
  "Check status of MSW operations and long-running jobs",
  {
    jobId: z.string().optional().describe("Job ID to check (omit for overall status)"),
  },
  async ({ jobId }) => {
    if (jobId) {
      const job = jobs.get(jobId);
      if (!job) return { content: [{ type: "text", text: JSON.stringify({ error: "Job not found" }) }] };
      return { content: [{ type: "text", text: JSON.stringify(job) }] };
    }
    // Return overall MSW state
    const allJobs = [...jobs.values()].map(j => ({ id: j.id, tool: j.tool, status: j.status }));
    return { content: [{ type: "text", text: JSON.stringify({ jobs: allJobs }) }] };
  }
);
```

### Pattern 3: Binary Entry Point
**What:** Ship as `bin` in package.json so clients can invoke directly
**When to use:** Always for stdio MCP servers
**Example:**
```json
{
  "bin": {
    "msw-mcp-server": "./dist/mcp/index.js"
  }
}
```

The entry point file must start with `#!/usr/bin/env node` and be marked executable.

### Anti-Patterns to Avoid
- **Monolithic tool handler:** Don't put all tool logic in a single `CallToolRequestSchema` handler with a giant switch. Use `McpServer.tool()` per-tool.
- **Blocking stdio with console.log:** All debug output MUST go to `console.error` (stderr). Stdout is the MCP transport channel.
- **Synchronous long-running tools:** Never block the stdio transport. Always return a job ID and run async.
- **Stateful server assumptions:** Each client connection may spawn a new process. Don't assume persistent state across restarts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol compliance | Custom JSON-RPC handler | `@modelcontextprotocol/sdk` McpServer | Protocol has many edge cases (capabilities negotiation, error codes, content types) |
| Input validation | Manual JSON parsing | Zod schemas via `server.tool()` | SDK validates automatically, type-safe |
| Transport layer | Raw stdin/stdout parsing | `StdioServerTransport` | Handles framing, buffering, line protocol |
| Tool listing | Manual `tools/list` handler | `McpServer` auto-generates from registered tools | Keeps tool metadata in sync with handlers |

**Key insight:** The MCP SDK handles all protocol negotiation, capability advertisement, and transport framing. Building any of this manually introduces subtle bugs with message framing and capability negotiation.

## Common Pitfalls

### Pitfall 1: stdout Pollution
**What goes wrong:** Any `console.log()` or uncaught error writing to stdout corrupts the MCP transport
**Why it happens:** Stdio transport uses stdout as the JSON-RPC channel
**How to avoid:** Use `console.error()` for all logging. Set up a logger that writes to stderr. Catch all unhandled promise rejections.
**Warning signs:** Client shows "parse error" or disconnects immediately

### Pitfall 2: Forgetting Shebang Line
**What goes wrong:** Client fails to start the server with "permission denied" or "not recognized"
**Why it happens:** Node.js bin scripts need `#!/usr/bin/env node` at the top
**How to avoid:** Add shebang to entry point; ensure `chmod 755` in build script (Unix) or use `node` command explicitly in client config
**Warning signs:** Works with `node dist/mcp/index.js` but not as bare command

### Pitfall 3: Job Memory Leak
**What goes wrong:** Completed jobs accumulate in memory indefinitely
**Why it happens:** No TTL/cleanup for the job Map
**How to avoid:** Implement a TTL (e.g., 1 hour) and periodic cleanup. Delete completed/failed jobs after client retrieves result.
**Warning signs:** Memory usage growing over long sessions

### Pitfall 4: Client Config Differences
**What goes wrong:** Server works with one client but not another
**Why it happens:** Each client has different config file locations and slightly different JSON schema
**How to avoid:** Document all three configs; test with each client. Provide a setup command or script.
**Warning signs:** "Tool not found" in one client but works in another

### Pitfall 5: Zod Version Mismatch
**What goes wrong:** Runtime error about incompatible Zod versions
**Why it happens:** MCP SDK imports `zod/v4` internally; project may have different Zod
**How to avoid:** Project already has zod ^4.3.6 which is compatible. Ensure single Zod instance (no duplicate in node_modules).
**Warning signs:** "Cannot read properties of undefined" errors from schema validation

## Code Examples

### Complete Minimal MCP Server
```typescript
#!/usr/bin/env node
// Source: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "msw-protocol",
  version: "0.1.0",
});

// Synchronous tool
server.tool(
  "msw_init",
  "Initialize MSW protocol for a project directory",
  { projectDir: z.string() },
  async ({ projectDir }) => ({
    content: [{ type: "text", text: `Initialized MSW at ${projectDir}` }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MSW MCP Server running on stdio");
```

### Client Configuration Files
```jsonc
// Claude Code: .claude/mcp.json or ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "msw": {
      "command": "node",
      "args": ["C:/path/to/msw-protocol/dist/mcp/index.js"]
    }
  }
}

// Cursor: ~/.cursor/mcp.json
{
  "mcpServers": {
    "msw": {
      "command": "node",
      "args": ["C:/path/to/msw-protocol/dist/mcp/index.js"]
    }
  }
}

// Windsurf: ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "msw": {
      "command": "node",
      "args": ["C:/path/to/msw-protocol/dist/mcp/index.js"]
    }
  }
}
```

### Error Response Pattern
```typescript
// Source: MCP SDK conventions
server.tool("msw_verify", "Verify implementation against requirements", {
  projectDir: z.string(),
  requirementIds: z.array(z.string()).optional(),
}, async ({ projectDir, requirementIds }) => {
  try {
    const result = await engine.verify(projectDir, requirementIds);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Verification failed: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Low-level `Server` + manual `setRequestHandler` | `McpServer.tool()` high-level API | SDK v1.x | 80% less boilerplate for tool-only servers |
| HTTP+SSE transport | Streamable HTTP transport | 2025 | New standard for remote; stdio unchanged for local |
| Ad-hoc job ID pattern | Tasks SEP-1686 (experimental) | Nov 2025 spec | Formal protocol for long-running ops; not yet stable |
| Zod v3 | Zod v4 (via `zod/v4`) | 2025 | SDK requires zod >=3.25; project already on v4 |

**Deprecated/outdated:**
- HTTP+SSE transport: Replaced by Streamable HTTP for remote deployments
- Manual `ListToolsRequestSchema`/`CallToolRequestSchema` handlers: Still works but `McpServer.tool()` is preferred

## Open Questions

1. **Tasks SEP-1686 timeline**
   - What we know: Experimental in Nov 2025 spec; finalization targeted Q1 2026 for June 2026 spec release
   - What's unclear: Whether the TypeScript SDK v1.x will backport Tasks support or if it requires v2
   - Recommendation: Implement job ID pattern now. It's functionally identical and migrates cleanly to Tasks when available.

2. **SDK v2 migration**
   - What we know: v2 pre-alpha on main branch; v1.x remains recommended; v2 uses `registerTool()` instead of `tool()`
   - What's unclear: Exact timeline for stable v2 release (Q1 2026 estimate)
   - Recommendation: Build on v1.x (1.25.3). The `tool()` → `registerTool()` migration is trivial (name + config object).

3. **Process lifecycle with Windsurf**
   - What we know: Windsurf runs MCP commands at startup. Cursor treats them as transactional.
   - What's unclear: Whether Windsurf keeps the process alive for the full session or restarts it
   - Recommendation: Design server to be stateless-by-default (job state is nice-to-have, not critical). Jobs can be re-triggered if process restarts.

## Sources

### Primary (HIGH confidence)
- [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) - SDK README, server.md docs
- npm registry: `@modelcontextprotocol/sdk` v1.25.3 (verified via `npm view`)
- Project package.json - confirmed zod ^4.3.6 already installed

### Secondary (MEDIUM confidence)
- [Dev.to MCP Server Guide](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28) - Low-level Server API patterns
- [Hackteam MCP Guide](https://hackteam.io/blog/build-test-mcp-server-typescript-mcp-inspector/) - McpServer.tool() examples
- [Agnost Long-Running Tasks](https://agnost.ai/blog/long-running-tasks-mcp/) - Tasks SEP-1686 implementation details
- [SEP-1686 Tasks Issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) - Formal spec proposal
- [BrainGrid Windsurf MCP Guide](https://www.braingrid.ai/blog/windsurf-mcp) - Windsurf config location
- [Claude Code as MCP Server](https://www.ksred.com/claude-code-as-an-mcp-server-an-interesting-capability-worth-understanding/) - Claude config details

### Tertiary (LOW confidence)
- [MCP Roadmap](https://modelcontextprotocol.io/development/roadmap) - Future spec plans (subject to change)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK, verified version, already-compatible Zod
- Architecture: HIGH - `McpServer.tool()` is well-documented with many examples
- Long-running operations: MEDIUM - Job ID pattern is proven but Tasks SEP is still experimental
- Multi-client compatibility: MEDIUM - Config locations verified via guides but not tested hands-on
- Pitfalls: HIGH - Well-documented across community (stdout pollution, shebang, etc.)

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days; SDK v2 release may change recommendations)
