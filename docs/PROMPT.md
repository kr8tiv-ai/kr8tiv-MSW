# STEP 1: READ EVERYTHING FIRST

Before doing ANYTHING else, read and understand ALL files from:

**GitHub Repository:** https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW

Clone it:
```bash
git clone https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW.git
cd kr8tiv-MSW
```

Read these files IN ORDER:
1. README.md
2. MSW_PRD.md (THIS IS THE SPECIFICATION - MOST IMPORTANT)
3. Research Report_ Architectural Blueprint for the MSW Protocol.md
4. MSW - The Ralph Loop and MCP_ Advanced Agentic Orchestration Frameworks.md
5. Implementing the MSW Protocol with Claude_ A Guide to Effective AI-Powered Development.md
6. Strategic Playbook_ Rapidly Developing and Launching a Market-Ready AI Agent.md
7. msw-notebooklm-extractor.js
8. msw-notebooklm-extractor(1).js

Also read ANY other files in the parent directory.

---

# STEP 2: UNDERSTAND THE CORE CONCEPT

Confirm you understand:

**The Problem:** Manual copy-paste between NotebookLM and coding agents is tedious but incredibly effective for fixing errors.

**The Solution:** MSW Protocol automates this with an Auto-Conversation Engine that:
- Clicks ALL suggested topics in NotebookLM (not just 1-2)
- Evaluates relevance of each (scores 0-100)
- Keeps clicking until no new relevant topics appear (10+ levels deep)
- Injects agent errors/questions INTO NotebookLM chat
- Auto-expands relevant follow-up suggestions
- Compiles and git commits all findings as .md files

**Built On:** GSD Protocol + Ralph Wiggum Loop + NotebookLM MCP

---

# STEP 3: START GSD

Once you have read ALL files, run:

```
/gsd:new-project
```

When GSD asks questions, use this information:

**What are you building?**
> MSW Protocol - An autonomous coding system that creates a bidirectional conversation bridge between NotebookLM and coding agents. The core is an Auto-Conversation Engine that auto-expands NotebookLM's suggested topics, evaluates their relevance, and injects agent errors to get grounded solutions automatically.

**Tech Stack:**
> Node.js, Playwright (browser automation), MCP SDK (IDE integration), Git

**V1 Scope:**
> - Topic detection and auto-clicking in NotebookLM
> - Relevance evaluation (local LLM scoring 0-100)  
> - Bidirectional query injection (agent → NotebookLM → agent)
> - Report compilation and git commit to .msw/research/
> - MCP server with init, research, plan, execute, verify tools

**Constraints:**
> - Must work with NotebookLM's current UI via browser automation
> - Must respect 50 queries/day rate limit
> - Must use persistent Chrome profile for auth
> - Must integrate with GSD planning format
> - Must work with Ralph Wiggum execution loop

---

# STEP 4: EXECUTE GSD PHASES

After /gsd:new-project completes, follow the GSD workflow:

```
/gsd:plan-phase 1
/gsd:execute-phase 1  
/gsd:verify-work 1
```

Repeat for each phase in the roadmap.

---

# COMPLETION CRITERIA

You are DONE when:

- [ ] All repo files have been read and understood
- [ ] /gsd:new-project has been run
- [ ] PROJECT.md exists with vision from PRD
- [ ] REQUIREMENTS.md exists with scoped features
- [ ] ROADMAP.md exists with phases
- [ ] At least Phase 1 is planned and executed
- [ ] Core structure exists:
  - `src/auto-conversation/engine.js`
  - `src/auto-conversation/relevance.js`
  - `src/browser/driver.js`
  - `server.js` (MCP entry point)
  - `package.json`
- [ ] Tests pass

Output `<promise>MSW-COMPLETE</promise>` when all criteria are met.

---

# NOTES

1. **READ FIRST** - Don't code until you've read everything
2. **PRD IS TRUTH** - MSW_PRD.md is the specification
3. **COMMIT ATOMIC** - Each task = one git commit
4. **TEST ALWAYS** - Verify before moving to next phase
5. **REFERENCE CODE** - Use msw-notebooklm-extractor.js as starting point for browser automation
