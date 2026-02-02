# Project Research Summary

**Project:** MSW Protocol (NotebookLM-Agent Bridge)
**Domain:** Autonomous Coding Agent with Browser Automation Integration
**Researched:** 2026-02-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

The MSW Protocol is an MCP server that creates a bidirectional bridge between NotebookLM (via browser automation) and coding agents (Claude Code, Cursor, Windsurf). This is a novel integration pattern - no existing tool automatically queries NotebookLM on errors and injects grounded answers back into the development loop. The recommended approach uses the official MCP TypeScript SDK (v1.25.x), Playwright for browser automation (since NotebookLM has no public consumer API), and a Hub-and-Spoke distributed architecture with specialized engines for Research, Planning, and Execution.

The architecture must externalize ALL state to files - not LLM memory - to survive context window exhaustion and enable session resumption. This aligns with both the GSD Protocol (file-based planning) and Ralph Wiggum Loop (fresh context per iteration) patterns. The system should spawn fresh sub-agents per task rather than accumulating context in one long session.

The dominant risk is Google's bot detection causing logout cascades across all Google accounts on the machine. This is not a theoretical concern - documented cases show Google's security systems can flag entire accounts for suspicious activity when Playwright automation is detected. Mitigation requires a dedicated automation account, aggressive humanization (10-20s delays), and staying well under the 50 queries/day limit (recommend 20-30). Secondary risks include NotebookLM selector fragility (UI elements change without notice) and silent code failures where NotebookLM guidance produces code that executes without errors but doesn't work.

## Key Findings

### Recommended Stack

The stack optimizes for MCP server development with browser automation. All technologies have active maintenance and long support windows.

**Core technologies:**
- **Node.js 24.x LTS**: Runtime with native ESM support, active LTS through Oct 2028
- **TypeScript 5.5+**: Required by MCP SDK, use `moduleResolution: "bundler"`
- **@modelcontextprotocol/sdk ^1.25.x**: Official Anthropic MCP server framework
- **Playwright ^1.58.0**: Browser automation with v1.58 Playwright Agents (planner/generator/healer)
- **Zod ^4.0.0**: Schema validation (14x faster parsing in v4), MCP SDK peer dependency
- **Pino ^9.x**: Structured logging, 5-10x faster than Winston (critical for agent loops)
- **Vitest ^3.x**: Test framework, native ESM support, MCP ecosystem standard

**Critical constraint:** MCP stdio transport requires ALL logging to stderr. `console.log()` breaks JSON-RPC protocol. Use `pino.destination(2)`.

### Expected Features

**Must have (table stakes):**
- Multi-file context awareness (all competitors have this)
- Self-correction loops (plan, execute, verify, correct)
- Error detection and retry
- MCP compatibility (de-facto standard for agent tooling)
- Git integration (every iteration creates commits)
- Test execution and verification
- Progress visibility and cancellation

**Should have (differentiators):**
- Bidirectional NotebookLM bridge (MSW's core innovation - no competitors do this)
- Auto-Conversation Engine (automatically click suggested topics, score relevance)
- Knowledge persistence as commits (.msw/research/ becomes versioned artifact)
- Query batching intelligence (work within 50 queries/day free tier)
- Ralph Loop + NotebookLM feedback integration

**Defer (v2+):**
- Multi-notebook simultaneous routing (complexity without clear v1 value)
- Web UI for notebook management (CLI/MCP sufficient for power users)
- Custom relevance models (local LLM scoring adequate)
- Audio/podcast features (out of scope - text-based research only)

### Architecture Approach

Hub-and-Spoke distributed architecture with three specialized engines coordinated by a central orchestrator. Do NOT build a monolithic agent.

**Major components:**
1. **Research Engine** - NotebookLM browser automation, topic extraction, relevance scoring
2. **Planning Engine** - GSD Protocol adapter, PRD generation, phase planning
3. **Execution Engine** - Ralph Loop runner, iteration management, stop hook
4. **Orchestrator** - Request routing, wave coordination, state synthesis
5. **State Manager** - File persistence (STATE.md, progress.txt), crash recovery

**Key patterns:**
- Fresh context per task (prevents "context rot")
- Files as long-term memory (Markdown, not in-memory)
- Wave-based parallel execution (group independent tasks)
- Stop hook completion promise (prevent premature exit)
- Async polling for long operations (return job_id, poll status)

### Critical Pitfalls

1. **Google Bot Detection Logout Cascade** - Use dedicated automation account, playwright-stealth, humanization delays (10-20s), session isolation. Never use primary Google account. Phase 1 blocker.

2. **NotebookLM UI Selector Fragility** - Use semantic selectors (`getByRole`, `getByText`), create selector abstraction layer (`selectors.ts`), health check on startup. CSS class names change on every Google deploy. Phase 1 blocker.

3. **Silent Code Failures** - NotebookLM guidance may produce code that "works" but doesn't function. Require behavioral verification (actual outcomes) not just structural verification (code exists). Include golden path tests. Phase 5 blocker.

4. **Prompt Decay in Long Loops** - After 20+ iterations, agent loses effectiveness of system prompt. Spawn fresh subagents per task (not one long session), set max-iterations at 5-10 per atomic task, re-read spec at each iteration start. Phase 5 blocker.

5. **Error Escalation Loops** - Same error queried to NotebookLM repeatedly burns 50 queries/day. Track queried errors, after 3 failed attempts escalate to human or skip task, budget queries per phase (not global pool). Phase 3 blocker.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Browser Automation Foundation
**Rationale:** Browser automation is the highest-risk component and blocking dependency for all NotebookLM features. Must validate this works before building anything else.
**Delivers:** Playwright wrapper, Chrome profile persistence, NotebookLM connection, selector abstraction layer, humanization patterns, health check system
**Addresses:** Browser automation table stake, stealth measures
**Avoids:** Google bot detection (Pitfall #1), Selector fragility (Pitfall #2), Chrome profile corruption (Pitfall #6)
**Research needed:** HIGH - NotebookLM selectors may change, stealth effectiveness varies

### Phase 2: Auto-Conversation Engine
**Rationale:** Core differentiator - automatic topic expansion is what makes MSW unique. Depends on Phase 1 browser foundation.
**Delivers:** Topic detection, relevance scoring, multi-level topic expansion (up to 10 levels), Q&A extraction, report compilation, git commit integration
**Addresses:** Auto-Conversation differentiator, knowledge persistence
**Avoids:** Relevance scoring false positives (Pitfall #8), Rate limit exhaustion
**Research needed:** MEDIUM - relevance scoring thresholds need tuning

### Phase 3: Bidirectional Communication
**Rationale:** Connects agent errors to NotebookLM queries. Depends on Phase 2's extraction and query capabilities.
**Delivers:** Error context templates, query injection (agent to NotebookLM), response injection (NotebookLM to agent), query deduplication, stuck escalation protocol
**Addresses:** Bidirectional bridge differentiator
**Avoids:** Error escalation loops (Pitfall #5), Insufficient error context (Pitfall #10)
**Research needed:** MEDIUM - query formatting optimization

### Phase 4: MCP Server
**Rationale:** Integration layer wrapping all engines. Requires core features to exist first.
**Delivers:** Tool handler layer (msw_init, msw_research, msw_plan, msw_execute, msw_verify, msw_status), long-running operation polling, multi-client compatibility
**Addresses:** MCP compatibility table stake, IDE integration
**Avoids:** Long-running operation timeouts (Pitfall #7), Multi-client compatibility issues (Pitfall #14)
**Research needed:** LOW - MCP SDK is well-documented

### Phase 5: GSD + Ralph Integration
**Rationale:** Execution layer combining GSD planning with Ralph continuous iteration. Requires all previous phases.
**Delivers:** GSD adapter, PRD generation, phase planning, Ralph runner, stop hook (cross-platform), iteration management, behavioral verification
**Addresses:** Self-correction loops table stake, Research-grounded planning differentiator
**Avoids:** Silent code failures (Pitfall #3), Prompt decay (Pitfall #4), Spec drift (Pitfall #9)
**Research needed:** MEDIUM - stop hook Windows compatibility needs validation

### Phase 6: End-to-End Integration
**Rationale:** Full workflow validation, production hardening
**Delivers:** Complete error-to-resolution pipeline, e2e tests, documentation, deployment configuration
**Addresses:** Progress visibility, state persistence
**Avoids:** All pitfalls via comprehensive testing
**Research needed:** LOW - integration testing patterns are standard

### Phase Ordering Rationale

- **Browser automation first** because every other feature depends on it. If this fails, the product concept is invalid.
- **Auto-Conversation before Bidirectional** because we need reliable Q&A extraction before injecting agent errors.
- **MCP Server in the middle** because tools need engines to wrap, but execution needs MCP to coordinate.
- **GSD + Ralph last** because it requires the full stack - research, planning, and MCP integration.
- **Pitfall-informed ordering** - Critical pitfalls addressed in early phases (bot detection, selector fragility) to fail fast if architecture is flawed.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Browser):** HIGH - NotebookLM has no stability guarantees; selector changes unpredictable; stealth effectiveness unknown
- **Phase 2 (Auto-Conversation):** MEDIUM - Relevance scoring thresholds need empirical tuning
- **Phase 5 (GSD + Ralph):** MEDIUM - Stop hook Windows/PowerShell compatibility needs testing

Phases with standard patterns (skip research-phase):
- **Phase 4 (MCP Server):** LOW - Official SDK, well-documented patterns, community examples
- **Phase 6 (Integration):** LOW - Standard testing and deployment patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Anthropic SDK, Microsoft Playwright, active LTS Node.js - all authoritative sources |
| Features | MEDIUM | Industry comparison verified via multiple sources; MSW-specific differentiators are novel (no prior art) |
| Architecture | MEDIUM | Hub-and-spoke pattern well-documented for agents; NotebookLM integration is project-specific inference |
| Pitfalls | HIGH | Bot detection and autonomous agent failures verified via multiple credible sources (IEEE, Microsoft, community) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **NotebookLM Enterprise API**: Currently alpha, enterprise-only. Monitor for consumer availability - could eliminate browser automation risk entirely.
- **Playwright stealth longevity**: Current stealth packages have stale maintenance. May need custom solutions if Google updates detection.
- **Rate limit values**: 50 queries/day is approximate, subject to Google changes. Build for 20-30 to be safe.
- **Stop hook Windows compatibility**: Community fixes exist but not officially documented. Needs validation on Windows.
- **Relevance scoring effectiveness**: Local LLM scoring untested at scale. Plan for threshold tuning and potential upgrade path.

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official Anthropic SDK
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - Protocol definition
- [Playwright Release Notes](https://playwright.dev/docs/release-notes) - v1.58 agent features
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) - Reference implementation
- [Node.js Release Schedule](https://nodejs.org/en/about/previous-releases) - LTS timelines

### Secondary (MEDIUM confidence)
- [IEEE Spectrum: AI Coding Degrades](https://spectrum.ieee.org/ai-coding-degrades) - Silent failure patterns
- [Microsoft AI Agent Orchestration Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) - Hub-and-spoke architecture
- [ZenRows Bot Detection Guide](https://www.zenrows.com/blog/avoid-playwright-bot-detection) - Stealth patterns
- [BrowserStack Playwright Selectors](https://www.browserstack.com/guide/playwright-selectors-best-practices) - Selector resilience
- [MCP Server Testing Guide](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/) - Testing patterns

### Tertiary (LOW confidence, needs validation)
- NotebookLM unofficial API behavior (undocumented Google APIs)
- Stop hook Windows compatibility (community fixes)
- Rate limit recovery timing (approximate, varies by account)
- Principal Skinner harness patterns (emerging, not fully documented)

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
