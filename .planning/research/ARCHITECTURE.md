# Architecture Patterns

**Domain:** Autonomous coding system with NotebookLM integration (MCP-based)
**Researched:** 2026-02-02
**Confidence:** MEDIUM (patterns verified via official docs and multiple sources; NotebookLM integration relies on unofficial APIs)

---

## Executive Summary

The MSW Protocol requires a **Hub-and-Spoke distributed architecture** with three specialized subsystems coordinated by a central orchestrator. This pattern is well-established in the agentic AI ecosystem (2026) and aligns with Microsoft's documented AI Agent Orchestration Patterns.

Key architectural insight: **Do NOT build a monolithic agent.** Distribute responsibilities across:
1. **Research Layer** - NotebookLM browser automation (Playwright)
2. **Planning Layer** - GSD Protocol integration (file-based state)
3. **Execution Layer** - Ralph Loop continuous iteration

The architecture must externalize ALL state to files (not memory) to survive context window exhaustion and enable session resumption.

---

## Recommended Architecture

```
                    ┌─────────────────────────────────────┐
                    │          MCP CLIENTS                │
                    │  (Claude Code, Windsurf, Cursor)    │
                    └──────────────┬──────────────────────┘
                                   │ JSON-RPC 2.0
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MSW MCP SERVER (Node.js)                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      TOOL HANDLER LAYER                                 │ │
│  │  msw_init | msw_research | msw_plan | msw_execute | msw_verify | status │ │
│  └─────────────────────────────────────┬───────────────────────────────────┘ │
│                                        │                                     │
│  ┌─────────────────────────────────────┴───────────────────────────────────┐ │
│  │                         ORCHESTRATOR                                    │ │
│  │            (Request Router + Wave Coordinator)                          │ │
│  └──────┬──────────────────────┬──────────────────────┬───────────────────┘ │
│         │                      │                      │                      │
│         ▼                      ▼                      ▼                      │
│  ┌────────────┐        ┌────────────┐        ┌────────────┐                 │
│  │  RESEARCH  │        │  PLANNING  │        │ EXECUTION  │                 │
│  │   ENGINE   │        │   ENGINE   │        │   ENGINE   │                 │
│  │            │        │            │        │            │                 │
│  │ ┌────────┐ │        │ ┌────────┐ │        │ ┌────────┐ │                 │
│  │ │Browser │ │        │ │  GSD   │ │        │ │ Ralph  │ │                 │
│  │ │ Driver │ │        │ │Adapter │ │        │ │ Runner │ │                 │
│  │ └───┬────┘ │        │ └────────┘ │        │ └────────┘ │                 │
│  │     │      │        │            │        │            │                 │
│  │ ┌───┴────┐ │        │ ┌────────┐ │        │ ┌────────┐ │                 │
│  │ │Relevance│ │       │ │Roadmap │ │        │ │  Stop  │ │                 │
│  │ │Evaluator│ │       │ │Planner │ │        │ │  Hook  │ │                 │
│  │ └────────┘ │        │ └────────┘ │        │ └────────┘ │                 │
│  └──────┬─────┘        └──────┬─────┘        └──────┬─────┘                 │
│         │                     │                     │                        │
└─────────┼─────────────────────┼─────────────────────┼────────────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
   ┌────────────┐        ┌────────────┐        ┌────────────┐
   │ NotebookLM │        │ .planning/ │        │  progress  │
   │  (Chrome)  │        │   files    │        │   .txt     │
   └────────────┘        └────────────┘        └────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Input | Output |
|-----------|---------------|-------------------|-------|--------|
| **Tool Handler** | MCP tool routing, parameter validation | Orchestrator | JSON-RPC tool calls | Tool responses |
| **Orchestrator** | Request routing, wave coordination, state synthesis | All engines, State Manager | Tool requests + state | Delegated tasks |
| **Research Engine** | NotebookLM browser automation, topic extraction | Browser Driver, Relevance Evaluator | Research queries | Grounded Q&A pairs |
| **Browser Driver** | Playwright wrapper, auth management, humanization | NotebookLM Chrome session | Navigation/query commands | DOM content, responses |
| **Relevance Evaluator** | Score topics 0-100, filter low-relevance | Local LLM (optional) or heuristics | Topic text + context | Relevance score |
| **Planning Engine** | GSD format adaptation, PRD generation | GSD file system | Interview + research data | PLAN.md, ROADMAP.md |
| **Execution Engine** | Ralph loop, iteration management | Stop Hook, Git Manager | PLAN.md | Completed code + commits |
| **Stop Hook** | Session interception, completion promise check | Execution Engine | Exit signal | Continue/complete decision |
| **State Manager** | File persistence, handoff data | All components | State updates | STATE.md reads/writes |
| **Git Manager** | Atomic commits, history tracking | Execution Engine | Commit requests | Git operations |

---

## Data Flow

### Phase 1: Initialization Flow

```
MCP Client                MSW Server                    File System
    │                         │                              │
    │ msw_init(project_path)  │                              │
    ├────────────────────────>│                              │
    │                         │                              │
    │                         │ Create .msw/ structure       │
    │                         ├─────────────────────────────>│
    │                         │                              │
    │                         │ Analyze codebase (parallel)  │
    │                         │ ┌───────────────────────────┐│
    │                         │ │ Agent 1: structure-mapper ││
    │                         │ │ Agent 2: dep-analyzer     ││
    │                         │ │ Agent 3: pattern-detector ││
    │                         │ │ Agent 4: concern-finder   ││
    │                         │ └───────────────────────────┘│
    │                         │                              │
    │                         │ Write analysis files         │
    │                         ├─────────────────────────────>│
    │                         │    .msw/codebase/*.md        │
    │                         │                              │
    │<────────────────────────│                              │
    │  {status: ready}        │                              │
```

### Phase 2: Research Flow

```
MSW Server              Research Engine            NotebookLM
    │                        │                         │
    │ research(topic)        │                         │
    ├───────────────────────>│                         │
    │                        │                         │
    │                        │ Select notebook         │
    │                        │ (from .msw/notebooks.yaml)
    │                        │                         │
    │                        │ Activate notebook       │
    │                        ├────────────────────────>│
    │                        │                         │
    │                        │ Query primary question  │
    │                        ├────────────────────────>│
    │                        │<────────────────────────│
    │                        │ Response + suggestions  │
    │                        │                         │
    │                        │ ┌─────────────────────┐ │
    │                        │ │ For each suggestion:│ │
    │                        │ │  1. Score relevance │ │
    │                        │ │  2. If score > 30:  │ │
    │                        │ │     Click & extract │ │
    │                        │ │  3. Repeat (max 10) │ │
    │                        │ └─────────────────────┘ │
    │                        │                         │
    │<───────────────────────│                         │
    │ Compiled Q&A report    │                         │
```

### Phase 3: Execution Flow (Ralph Loop)

```
Execution Engine         Code Agent           Verification
     │                       │                     │
     │ Load PLAN.md          │                     │
     │                       │                     │
     │ Spawn with fresh ctx  │                     │
     ├──────────────────────>│                     │
     │                       │                     │
     │                       │ Execute task        │
     │                       │                     │
     │                       │ Attempt exit        │
     │<──────────────────────│                     │
     │                       │                     │
     │ ┌──────────────────┐  │                     │
     │ │ STOP HOOK CHECK: │  │                     │
     │ │ Has <promise>?   │  │                     │
     │ │ Tests passing?   │  │                     │
     │ └────────┬─────────┘  │                     │
     │          │            │                     │
     │  ┌───────┴───────┐    │                     │
     │  │ NO            │ YES│                     │
     │  ▼               ▼    │                     │
     │ Re-inject      Complete                     │
     │ + error logs     │                          │
     │  │               │                          │
     │  │               │ Run verification         │
     │  │               ├─────────────────────────>│
     │  │               │<─────────────────────────│
     │  │               │ Pass/Fail                │
     │  │               │                          │
     │ Loop back        │ Git commit               │
     │  │               │                          │
     └──┘               └──────────────────────────┘
```

### Mid-Loop Research Injection

```
Execution Engine         Research Engine           progress.txt
     │                        │                         │
     │ Error after N fails    │                         │
     │                        │                         │
     │ Query NotebookLM       │                         │
     ├───────────────────────>│                         │
     │                        │                         │
     │                        │ Get grounded answer     │
     │                        │                         │
     │<───────────────────────│                         │
     │ Research findings      │                         │
     │                        │                         │
     │ Append to progress.txt │                         │
     ├───────────────────────────────────────────────>│
     │                        │                         │
     │ Next iteration reads   │                         │
     │ progress.txt           │                         │
     │<──────────────────────────────────────────────│
```

---

## Patterns to Follow

### Pattern 1: Fresh Context per Task

**What:** Each execution task spawns a new sub-agent with a clean 200k-token context window

**When:** Always during execution phase; prevents "context rot"

**Why:** Long-running conversations accumulate irrelevant tokens, causing hallucinations and quality degradation

**Implementation:**
```typescript
// Good: Fresh context per task
async function executeTask(plan: Plan): Promise<TaskResult> {
  const subAgent = await spawnAgent({
    contextWindow: 'fresh',
    prompt: plan.toPrompt(),
    stateFile: '.msw/STATE.md'  // External memory
  });
  return subAgent.execute();
}

// Bad: Reusing accumulated context
async function executeAllTasks(plans: Plan[]) {
  for (const plan of plans) {
    await this.execute(plan);  // Context grows, quality degrades
  }
}
```

### Pattern 2: Files as Long-Term Memory

**What:** All state persisted to Markdown files, not in-memory

**When:** Every phase transition, every significant decision

**Why:** Enables crash recovery, session resumption, and human debugging

**Key Files:**
| File | Purpose | Update Frequency |
|------|---------|------------------|
| `STATE.md` | Current position, blockers, decisions | Every phase transition |
| `progress.txt` | Iteration history, error logs | Every Ralph loop iteration |
| `PLAN.md` | Current execution instructions | Start of each phase |
| `CONTEXT.md` | User preferences captured in interview | After interview phase |

### Pattern 3: Wave-Based Parallel Execution

**What:** Group independent tasks into "waves"; execute Wave 1 in parallel, then Wave 2

**When:** Planning phase identifies task dependencies

**Why:** Maximizes throughput while respecting dependencies

```typescript
interface WaveAssignment {
  wave1: Task[];  // No dependencies, execute in parallel
  wave2: Task[];  // Depend on Wave 1, execute after verification
}

async function executePhase(waves: WaveAssignment) {
  // Wave 1: All parallel
  const wave1Results = await Promise.all(
    waves.wave1.map(task => spawnExecutor(task))
  );

  // Aggregate and verify
  await verifyAllPassed(wave1Results);

  // Wave 2: Now safe to execute
  const wave2Results = await Promise.all(
    waves.wave2.map(task => spawnExecutor(task))
  );
}
```

### Pattern 4: Stop Hook Completion Promise

**What:** Terminal-level script intercepts agent exit, checks for completion marker

**When:** Every iteration of Ralph loop

**Why:** Prevents premature exit when agent "thinks" it's done but tests fail

**Cross-Platform Implementation:**
```
                     ┌─────────────────┐
                     │ Agent attempts  │
                     │     exit        │
                     └────────┬────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Stop Hook Intercepts        │
              │   (stop-hook.sh / .ps1 / .js) │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Check for <promise>DONE</promise>
              │ AND run verification tests    │
              └───────────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
     ┌────────────────┐            ┌────────────────┐
     │  MISSING or    │            │   PRESENT +    │
     │  TESTS FAIL    │            │   TESTS PASS   │
     │                │            │                │
     │  exit code: 2  │            │  exit code: 0  │
     │  (loop back)   │            │  (complete)    │
     └────────────────┘            └────────────────┘
```

### Pattern 5: API-First NotebookLM (Not UI Scraping)

**What:** Use HTTP/RPC calls where possible; reserve Playwright for authentication and unavoidable UI

**When:** All NotebookLM queries

**Why:** UI scraping is brittle; API calls survive interface changes

**Layered Strategy:**
1. **Preferred:** notebooklm-mcp-cli API calls (stable)
2. **Fallback:** Playwright for topic pill clicking (unavoidable UI)
3. **Auth only:** Playwright for initial Google login (one-time)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Agent

**What:** Single agent handling research, planning, AND execution in one context

**Why bad:** Context window exhaustion, quality degradation, no crash recovery

**Instead:** Hub-and-spoke with specialized sub-agents and externalized state

### Anti-Pattern 2: In-Memory State

**What:** Storing decisions, progress, and context in JavaScript variables

**Why bad:** Lost on crash, can't resume sessions, invisible to debugging

**Instead:** Write everything to `.msw/` files; read STATE.md on every operation start

### Anti-Pattern 3: UI Scraping for Core Operations

**What:** Using Playwright for everything including API-equivalent operations

**Why bad:** NotebookLM UI changes frequently; scraping breaks

**Instead:** Use official CLI/API where available; Playwright only for unavoidable UI (topic pills, auth)

### Anti-Pattern 4: Infinite Loops Without Safety Valves

**What:** Ralph loop with no max-iterations limit

**Why bad:** Runaway API costs, stuck on impossible tasks

**Instead:** Always set `--max-iterations` (recommended: 30-50); trigger diagnostic agent on limit

### Anti-Pattern 5: Synchronous Long Operations

**What:** Blocking MCP client while long operation runs

**Why bad:** Timeouts, unresponsive client experience

**Instead:** Return job_id immediately, poll for status via `get_job_status(job_id)`

---

## Component Build Order (Dependencies)

The following build order respects component dependencies:

```
Phase 1 (Foundation - No Dependencies)
├── State Manager          ─┬─ Required by everything else
├── Git Manager            ─┘
└── Config/Logger utilities

Phase 2 (Browser Layer - Depends on Phase 1)
├── Browser Driver (Playwright wrapper)
├── Auth Manager (Chrome profile persistence)
└── Selector definitions (NotebookLM UI elements)

Phase 3 (Research Layer - Depends on Phase 2)
├── Relevance Evaluator (can be simple heuristics initially)
├── Auto-Conversation Engine (topic expansion loop)
└── Report Compiler (Q&A → Markdown)

Phase 4 (Planning Layer - Depends on Phase 1)
├── GSD Adapter (format translation)
├── PRD Generator
└── Phase Planner (PLAN.md creation)

Phase 5 (Execution Layer - Depends on Phases 1, 3, 4)
├── Ralph Runner (iteration loop)
├── Stop Hook (cross-platform: .sh, .ps1, .js)
└── Feedback Injector (NotebookLM → execution context)

Phase 6 (MCP Server - Depends on ALL)
├── Tool Handler Layer
├── Orchestrator (request router)
└── Long-running job handler (polling pattern)

Phase 7 (Integration Testing)
└── End-to-end workflow validation
```

### Rationale for Build Order

1. **State Manager first**: Every component needs to read/write state
2. **Browser before Research**: Research engine needs browser automation
3. **Planning independent of Research**: Can develop in parallel after State Manager
4. **Execution last**: Requires all other components to function
5. **MCP Server wraps everything**: Must be built after all engines exist

---

## Scalability Considerations

| Concern | At 1 User | At 10 Users | At 100 Users |
|---------|-----------|-------------|--------------|
| NotebookLM rate limits | 50 queries/day | Multi-account rotation | Enterprise API (if available) |
| Browser instances | Single Chrome profile | Profile pool per account | Headless farm |
| State files | Local .msw/ directory | Per-user isolation | Database backend option |
| MCP connections | Single server | Load balancer | Horizontal scaling |

**v1 Scope:** Single user, single notebook session. Scaling is out of scope for MVP.

---

## File System Structure

```
project/
├── .msw/                           # MSW Protocol working directory
│   ├── config.yaml                 # MSW configuration
│   ├── notebooks.yaml              # NotebookLM library registry
│   │
│   ├── codebase/                   # From Ingest Layer
│   │   ├── STRUCTURE.md            # Directory tree, file purposes
│   │   ├── DEPENDENCIES.md         # Package analysis
│   │   ├── CONVENTIONS.md          # Code patterns detected
│   │   └── CONCERNS.md             # Tech debt, security issues
│   │
│   ├── interview/                  # From Interview Layer
│   │   ├── GOALS.md                # User objectives
│   │   ├── DIFFICULTIES.md         # Pain points, failed attempts
│   │   └── CONSTRAINTS.md          # Hard requirements
│   │
│   ├── research/                   # From Research Layer
│   │   ├── QUESTIONS.md            # Generated research questions
│   │   ├── FINDINGS.md             # NotebookLM Q&A pairs
│   │   └── BEST_PRACTICES.md       # Synthesized recommendations
│   │
│   ├── planning/                   # From Planning Layer (GSD format)
│   │   ├── PRD.md                  # Product requirements
│   │   ├── ROADMAP.md              # Phase breakdown
│   │   └── phases/
│   │       ├── 01-PLAN.md          # XML task structure
│   │       └── ...
│   │
│   └── execution/                  # From Execution Layer
│       ├── progress.txt            # Ralph loop memory
│       └── phase-01/
│           ├── iteration-001.log
│           └── SUMMARY.md
│
├── .planning/                      # GSD Protocol directory (optional compatibility)
│   └── STATE.md                    # Current position, decisions, blockers
│
└── chrome_profile/                 # Persistent NotebookLM auth
    └── [Chrome user data]
```

---

## MCP Tool Definitions

| Tool | Parameters | Returns | Long-Running |
|------|------------|---------|--------------|
| `msw_init` | `project_path`, `github_url?` | `{status, files_created}` | No |
| `msw_research` | `topic`, `notebook_id?`, `depth?` | `{findings, qa_pairs}` | Yes (polling) |
| `msw_plan` | `phase_number?` | `{prd_path, plan_paths}` | No |
| `msw_execute` | `phase_number`, `max_iterations?` | `{job_id}` | Yes (polling) |
| `msw_verify` | `phase_number` | `{passed, failures}` | No |
| `msw_status` | `job_id?` | `{state, progress, eta?}` | No |
| `msw_notebook_add` | `url`, `topics[]` | `{notebook_id}` | No |

### Long-Running Operation Pattern

```typescript
// Client calls msw_execute
const result = await mcp.call('msw_execute', { phase_number: 1 });
// Returns immediately: { job_id: 'exec-abc123' }

// Client polls for status
while (true) {
  const status = await mcp.call('msw_status', { job_id: result.job_id });
  // { state: 'running', progress: 45, iteration: 12 }

  if (status.state === 'completed' || status.state === 'failed') {
    break;
  }
  await sleep(5000);
}
```

---

## Risk Mitigations (Architecture-Level)

| Risk | Architectural Mitigation |
|------|--------------------------|
| NotebookLM UI changes | Abstract selectors in `selectors.ts`; version-pin browser automation |
| Rate limit exhaustion | Multi-profile rotation; query batching; cache recent Q&A |
| Context window exhaustion | Fresh context per task; externalized state files |
| Agent premature exit | Stop hook with completion promise verification |
| Session crash | STATE.md persistence; resume from last checkpoint |
| Windows compatibility | Cross-platform stop hook (.sh, .ps1, .js options) |

---

## Sources

### HIGH Confidence (Official Documentation)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) - Official MCP specification
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK repo
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server) - Official implementation guide

### MEDIUM Confidence (Verified Multiple Sources)
- [Microsoft AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Enterprise patterns
- [Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) - Browser automation patterns
- [Agentic AI Design Patterns 2026](https://medium.com/@dewasheesh.rana/agentic-ai-design-patterns-2026-ed-e3a5125162c5) - Multi-agent patterns

### LOW Confidence (Project-Specific, Requires Validation)
- NotebookLM unofficial API behavior (relies on undocumented Google APIs)
- Stop hook Windows compatibility (community fixes, not officially documented)
- Rate limit values (approximate, subject to Google changes)

---

## Roadmap Implications

Based on this architecture research:

1. **Build Foundation First (Phase 1):** State Manager + Git Manager are blocking dependencies
2. **Browser Automation Early (Phase 2):** High-risk component; validate NotebookLM automation works before building research engine
3. **Planning Can Parallelize (Phase 3-4):** GSD adapter has no dependency on browser layer
4. **Execution Requires Everything (Phase 5):** Must wait for research + planning to be complete
5. **MCP Server Last (Phase 6):** Integration layer wrapping all engines

**Research Flags:**
- Phase 2 (Browser): HIGH risk - NotebookLM selectors may change
- Phase 5 (Execution): MEDIUM risk - Stop hook Windows compatibility needs validation
- Phase 6 (MCP): LOW risk - Well-documented official SDK

---

*Architecture research complete. Component boundaries defined. Build order dependencies mapped.*
