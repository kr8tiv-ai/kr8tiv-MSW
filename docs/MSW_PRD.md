# MSW Protocol - Product Requirements Document

**Version:** 1.0  
**Date:** February 2, 2026  
**Author:** Matt @ Aurora Ventures  
**Status:** Ready for Development

---

## Executive Summary

MSW (Make Shit Work) Protocol is an autonomous coding system that bridges NotebookLM and coding agents (Claude Code, Windsurf, Cursor) through an automated conversation engine. It eliminates the manual copy-paste workflow between NotebookLM and your IDE by creating a bidirectional feedback loop that queries NotebookLM when errors occur and auto-expands suggested topics to build a comprehensive research foundation.

**Core Innovation:** The Auto-Conversation Engine that automatically clicks NotebookLM's suggested questions, evaluates their relevance, and builds a committed knowledge base — then continues this conversation bidirectionally during code execution.

---

## Problem Statement

### Current Pain Points

1. **Manual Copy-Paste Loop:** Developers manually copy errors to NotebookLM, get answers, paste back to agent
2. **Wasted Suggested Topics:** NotebookLM suggests relevant questions that most users ignore
3. **No Persistent Knowledge:** Research isn't committed or tracked between sessions
4. **Agent Hallucinations:** Without grounded documentation, agents invent APIs that don't exist
5. **Endless Loops:** Agents retry the same failing approach without new information

### User Quote
> "I kept doing the same thing over and over — copy error to NotebookLM, get grounded answer, paste back. It worked incredibly well. I just got tired of being the middleman."

---

## Solution Overview

MSW Protocol creates three integrated layers:

| Layer | Function | Based On |
|-------|----------|----------|
| **Auto-Conversation Engine** | Bidirectional NotebookLM communication | NEW |
| **Planning Layer** | Spec-driven development with research grounding | GSD Protocol |
| **Execution Layer** | Continuous iteration with NotebookLM feedback | Ralph Wiggum Loop |

---

## Functional Requirements

### FR-1: NotebookLM Auto-Conversation Engine

#### FR-1.1: Topic Auto-Expansion
- **SHALL** detect all suggested topic pills in NotebookLM's chat UI
- **SHALL** evaluate each topic for relevance to current task (score 0-100)
- **SHALL** auto-click topics scoring above configurable threshold (default: 30)
- **SHALL** continue expanding until no new relevant topics appear (max depth: 10 levels)
- **SHALL** handle rate limits gracefully (50 queries/day limit)

#### FR-1.2: Relevance Evaluation
- **SHALL** score topics based on:
  - Direct relevance to stated task goal (0-40 points)
  - Relevance to current error if present (0-30 points)
  - Likelihood of providing implementation details (0-20 points)
  - Non-redundancy with previous answers (0-10 points)
- **SHALL** use local LLM for fast evaluation (no external API latency)

#### FR-1.3: Bidirectional Communication
- **SHALL** accept queries from coding agent (errors, questions)
- **SHALL** format queries naturally for NotebookLM
- **SHALL** type queries into NotebookLM chat
- **SHALL** wait for and extract responses
- **SHALL** auto-expand relevant follow-up suggestions after each response
- **SHALL** inject full answer chain back to coding agent

#### FR-1.4: Knowledge Persistence
- **SHALL** compile all Q&A pairs into markdown report
- **SHALL** structure report with metadata, sections per topic, and synthesis
- **SHALL** git commit report to `.msw/research/` directory
- **SHALL** make reports available to coding agent context

### FR-2: Codebase Integration

#### FR-2.1: Ingest Layer
- **SHALL** analyze local directory structure
- **SHALL** connect to GitHub repositories via API or clone
- **SHALL** map dependencies, conventions, architecture, and concerns
- **SHALL** output analysis to `.msw/codebase/` directory

#### FR-2.2: Interview Layer
- **SHALL** ask user about goals and desired outcomes
- **SHALL** capture difficulties and what's been tried
- **SHALL** collect agent error messages and failed approaches
- **SHALL** record constraints and requirements
- **SHALL** output to `.msw/interview/` directory

### FR-3: Planning Layer (GSD Integration)

#### FR-3.1: Research-Grounded Planning
- **SHALL** read NotebookLM findings before generating plans
- **SHALL** incorporate best practices from research into task specifications
- **SHALL** use GSD's XML task format for atomic, verifiable tasks
- **SHALL** include verification steps derived from research

#### FR-3.2: PRD Generation
- **SHALL** generate PROJECT.md with vision and success criteria
- **SHALL** generate REQUIREMENTS.md with scoped v1/v2 requirements
- **SHALL** generate ROADMAP.md with phase breakdown
- **SHALL** generate phase PLAN.md files with XML task structures

### FR-4: Execution Layer (Ralph Loop Integration)

#### FR-4.1: Iteration Loop
- **SHALL** execute tasks in Ralph-style continuous loop
- **SHALL** intercept exit attempts via Stop hook
- **SHALL** re-inject prompt with updated context
- **SHALL** track iteration count and respect max-iterations limit
- **SHALL** check for completion promises before stopping

#### FR-4.2: NotebookLM Feedback Integration
- **SHALL** detect when iteration fails with error
- **SHALL** automatically query NotebookLM about the error
- **SHALL** inject NotebookLM response into next iteration's context
- **SHALL** track which NotebookLM responses have been tried
- **SHALL** escalate if same error persists after NotebookLM guidance

#### FR-4.3: Verification
- **SHALL** run automated tests after each successful iteration
- **SHALL** check coverage thresholds
- **SHALL** execute custom verification commands
- **SHALL** compile verification report

### FR-5: MCP Server

#### FR-5.1: Tool Definitions
- **SHALL** expose `msw_init` tool for full initialization
- **SHALL** expose `msw_research` tool for NotebookLM extraction
- **SHALL** expose `msw_plan` tool for PRD generation
- **SHALL** expose `msw_execute` tool for Ralph loop execution
- **SHALL** expose `msw_verify` tool for verification
- **SHALL** expose `msw_status` tool for progress reporting
- **SHALL** expose `msw_notebook_add` tool for library management

#### FR-5.2: Long-Running Operations
- **SHALL** handle operations that span multiple iterations
- **SHALL** stream progress updates to client
- **SHALL** support cancellation mid-execution
- **SHALL** persist state for resume capability

---

## Non-Functional Requirements

### NFR-1: Performance
- Topic relevance evaluation: < 500ms per topic
- NotebookLM response extraction: < 5s after streaming completes
- Git commit operations: < 2s

### NFR-2: Reliability
- Graceful handling of NotebookLM rate limits
- Automatic retry with exponential backoff for network failures
- State persistence for crash recovery

### NFR-3: Compatibility
- Support Claude Code, Windsurf, Cursor as MCP clients
- Support Chrome-based browser automation (Playwright)
- Support macOS, Windows, Linux

### NFR-4: Security
- Store Chrome profile locally (no cloud credential storage)
- Support dedicated Google account for automation
- No transmission of code to external services (only NotebookLM queries)

---

## User Stories

### US-1: Initial Research Extraction
**As a** developer starting a new feature  
**I want** MSW to automatically extract all relevant knowledge from my NotebookLM  
**So that** my coding agent has access to grounded documentation before coding begins

**Acceptance Criteria:**
- MSW clicks all relevant suggested topics
- At least 20 Q&A pairs extracted per session
- Findings committed to git
- Agent can reference findings in context

### US-2: Error Resolution
**As a** developer whose agent hit an error  
**I want** MSW to automatically query NotebookLM and inject the answer  
**So that** I don't have to manually copy-paste between tools

**Acceptance Criteria:**
- Error detected within 1 iteration
- NotebookLM queried with error context
- Follow-up suggestions auto-expanded
- Full answer chain injected into next iteration
- Agent succeeds with NotebookLM guidance

### US-3: Continuous Coding Session
**As a** developer running a Ralph loop overnight  
**I want** MSW to handle all NotebookLM interactions automatically  
**So that** I can wake up to completed work

**Acceptance Criteria:**
- Loop runs unattended for 30+ iterations
- All errors trigger NotebookLM queries
- Rate limits respected (no account flags)
- Final report generated with all Q&A pairs used

---

## Technical Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MSW MCP SERVER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Tool Handler   │  │  State Manager  │  │  Git Manager    │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │               │
│           └────────────────────┼────────────────────┘               │
│                                │                                     │
│                    ┌───────────┴───────────┐                        │
│                    │   Orchestrator        │                        │
│                    └───────────┬───────────┘                        │
│                                │                                     │
│    ┌───────────────────────────┼───────────────────────────┐        │
│    │                           │                           │        │
│    ▼                           ▼                           ▼        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Auto-Convo     │  │  GSD Planner    │  │  Ralph Runner   │     │
│  │  Engine         │  │                 │  │                 │     │
│  └────────┬────────┘  └─────────────────┘  └────────┬────────┘     │
│           │                                          │              │
│           └──────────────────┬───────────────────────┘              │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │  Browser Driver   │                            │
│                    │  (Playwright)     │                            │
│                    └─────────┬─────────┘                            │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   NotebookLM        │
                    │   (Chrome Session)  │
                    └─────────────────────┘
```

### File Structure

```
msw-protocol/
├── package.json
├── server.js                    # MCP server entry point
├── src/
│   ├── orchestrator.js          # Main coordination logic
│   ├── auto-conversation/
│   │   ├── engine.js            # Core auto-conversation logic
│   │   ├── relevance.js         # Topic relevance evaluation
│   │   ├── extractor.js         # Response extraction
│   │   └── compiler.js          # Report compilation
│   ├── browser/
│   │   ├── driver.js            # Playwright wrapper
│   │   ├── selectors.js         # NotebookLM UI selectors
│   │   └── auth.js              # Authentication handling
│   ├── planning/
│   │   ├── gsd-adapter.js       # GSD format adapter
│   │   ├── prd-generator.js     # PRD creation
│   │   └── phase-planner.js     # Phase breakdown
│   ├── execution/
│   │   ├── ralph-runner.js      # Ralph loop implementation
│   │   ├── stop-hook.js         # Exit interception
│   │   └── feedback-injector.js # Context injection
│   ├── tools/
│   │   ├── init.js
│   │   ├── research.js
│   │   ├── plan.js
│   │   ├── execute.js
│   │   ├── verify.js
│   │   └── status.js
│   └── utils/
│       ├── git.js
│       ├── config.js
│       └── logger.js
├── config/
│   └── default.yaml
└── chrome_profile/              # Persistent auth
```

---

## Milestones

### Milestone 1: Browser Automation Foundation (Week 1)
- [ ] Playwright integration for NotebookLM
- [ ] Persistent Chrome profile authentication
- [ ] Basic topic detection and clicking
- [ ] Response extraction with streaming detection

### Milestone 2: Auto-Conversation Engine (Week 2)
- [ ] Relevance evaluation system
- [ ] Multi-level topic expansion loop
- [ ] Report compilation and git commit
- [ ] Rate limit handling

### Milestone 3: Bidirectional Communication (Week 3)
- [ ] Query injection from agent errors
- [ ] Follow-up auto-expansion after queries
- [ ] Answer chain compilation
- [ ] Context injection back to agent

### Milestone 4: MCP Server (Week 4)
- [ ] Tool definitions and handlers
- [ ] State management
- [ ] Long-running operation support
- [ ] Client compatibility testing

### Milestone 5: GSD + Ralph Integration (Week 5)
- [ ] GSD format adapter
- [ ] PRD generation with research grounding
- [ ] Ralph loop with NotebookLM feedback
- [ ] End-to-end workflow testing

### Milestone 6: Polish and Release (Week 6)
- [ ] Documentation
- [ ] Example notebooks and configs
- [ ] Installation scripts
- [ ] Public release

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Q&A pairs extracted per session | ≥ 20 | Count from reports |
| Error resolution rate | ≥ 70% | Errors resolved after NotebookLM query |
| Time saved per error | ≥ 2 min | Compared to manual copy-paste |
| Unattended loop duration | ≥ 30 iterations | Without human intervention |
| GitHub stars (6 months) | ≥ 500 | Public validation |

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| NotebookLM UI changes | High | Medium | Abstract selectors, quick update process |
| Rate limit account flags | High | Low | Dedicated account, conservative limits |
| Browser automation detection | Medium | Medium | Humanization features, stealth mode |
| GSD protocol changes | Medium | Low | Version pinning, adapter pattern |

---

## Open Questions

1. Should we support multiple simultaneous NotebookLM notebooks?
2. Should bidirectional chat history persist across sessions?
3. Should we build a web UI for notebook management?
4. Should we support non-MCP integration (CLI-only mode)?

---

## Appendix: Inspiration

This protocol was born from the frustration of manual copy-paste between NotebookLM and coding agents, and the realization that this manual process was incredibly effective at fixing vibe coding errors.

**Influences:**
- [GSD Protocol](https://github.com/glittercowboy/get-shit-done) — Spec-driven development
- [Ralph Wiggum Loop](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum) — Continuous iteration
- [NotebookLM MCP](https://github.com/PleasePrompto/notebooklm-mcp) — Agent-to-NotebookLM bridge

**Philosophy:** No more fuckery. No more endless loops. Just make shit work.

---

*PRD Version 1.0 — Ready for GSD initialization*
