# MSW Protocol Development Prompt

## For Claude Code with GSD + Ralph Wiggum Loop (Opus 4.5)

---

### PROMPT.md

Copy this entire prompt into your Claude Code session or use it with Ralph Wiggum:

```
/ralph-loop "
# MSW Protocol Development Task

## STEP 1: INGEST ALL PROJECT FILES

First, read and understand ALL files in this project. This is critical before any development.

### GitHub Repository
Clone and read ALL files from:
https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW

```bash
git clone https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW.git
cd kr8tiv-MSW
```

### Files to Read (in order):
1. `README.md` - Project overview and philosophy
2. `MSW_PRD.md` - Product Requirements Document (THE SPECIFICATION)
3. `Research Report_ Architectural Blueprint for the MSW Protocol.md` - Technical architecture
4. `MSW - The Ralph Loop and MCP_ Advanced Agentic Orchestration Frameworks.md` - Integration patterns
5. `Implementing the MSW Protocol with Claude_ A Guide to Effective AI-Powered Development.md` - Implementation guide
6. `Strategic Playbook_ Rapidly Developing and Launching a Market-Ready AI Agent.md` - Launch strategy
7. `msw-notebooklm-extractor.js` - Existing NotebookLM extraction code
8. `msw-notebooklm-extractor(1).js` - Alternative extraction implementation

### Parent Directory Files (if present):
Also check and read any additional files in the parent directory:
- Any `.md` documentation files
- Any `.js` or `.ts` source files
- Any `package.json` for dependencies
- Any `.pdf` files (extract key information)

## STEP 2: UNDERSTAND THE CORE CONCEPT

After reading all files, confirm you understand:

1. **The Problem**: Manual copy-paste between NotebookLM and coding agents is tedious but effective
2. **The Solution**: Automate the bidirectional conversation with NotebookLM
3. **Core Feature**: Auto-Conversation Engine that:
   - Clicks ALL suggested topics in NotebookLM (not just one or two)
   - Evaluates relevance of each topic (score 0-100)
   - Continues clicking until no new relevant topics appear
   - Injects agent errors/questions INTO NotebookLM
   - Auto-expands follow-up suggestions
   - Compiles and git commits all findings
4. **Integration**: Built on GSD Protocol + Ralph Wiggum Loop

## STEP 3: START GSD

Once you have read and understood ALL files, initialize GSD:

/gsd:new-project

Answer GSD's questions based on the PRD and documentation you've read:

### Answers to GSD Questions:

**What are you building?**
MSW Protocol - An autonomous coding system that creates a bidirectional conversation bridge between NotebookLM and coding agents. It auto-expands NotebookLM's suggested topics, evaluates their relevance, and injects agent errors to get grounded solutions.

**What's the primary goal?**
Eliminate manual copy-paste between NotebookLM and coding agents by automating the conversation loop. When an agent hits an error, MSW queries NotebookLM automatically and injects the grounded answer back.

**What technology stack?**
- Node.js (primary runtime)
- Playwright (browser automation for NotebookLM)
- MCP SDK (Model Context Protocol for IDE integration)
- Git (for committing research findings)

**What's the scope?**
V1: Core auto-conversation engine with:
- Topic detection and auto-clicking
- Relevance evaluation (local LLM scoring)
- Bidirectional query injection
- Report compilation and git commit
- MCP server with basic tools

V2 (out of scope for now):
- Web UI for notebook management
- Multi-notebook routing
- Custom relevance models

**What are the constraints?**
- Must work with NotebookLM's current UI (browser automation)
- Must respect rate limits (50 queries/day)
- Must use persistent Chrome profile for auth
- Must integrate with GSD planning format
- Must work with Ralph Wiggum execution loop

## STEP 4: FOLLOW GSD WORKFLOW

After /gsd:new-project completes:

1. **Research Phase**: GSD will research the domain
2. **Requirements Phase**: Confirm requirements match PRD
3. **Roadmap Phase**: Approve the phase breakdown

Then execute each phase:
- /gsd:plan-phase 1
- /gsd:execute-phase 1
- /gsd:verify-work 1

Repeat for all phases.

## COMPLETION CRITERIA

Output <promise>MSW-COMPLETE</promise> when:
- [ ] All files from the repo have been read
- [ ] GSD new-project has been initialized
- [ ] PROJECT.md exists with correct vision
- [ ] REQUIREMENTS.md exists with scoped features
- [ ] ROADMAP.md exists with phase breakdown
- [ ] At least Phase 1 planning is complete
- [ ] Core auto-conversation engine structure exists:
  - src/auto-conversation/engine.js
  - src/auto-conversation/relevance.js
  - src/browser/driver.js
  - server.js (MCP entry point)
- [ ] package.json with dependencies
- [ ] Tests exist and pass

## IMPORTANT NOTES

1. **Read ALL files first** - Don't start coding until you've read everything
2. **Use GSD format** - All plans should use GSD's XML task structure
3. **Commit frequently** - Each task should have its own atomic git commit
4. **Test as you go** - Don't move to next phase until current phase passes verification
5. **Reference the PRD** - The PRD is the source of truth for requirements

## IF YOU GET STUCK

1. Re-read the relevant documentation file
2. Check if the PRD has guidance for your specific issue
3. If implementing NotebookLM automation, reference msw-notebooklm-extractor.js
4. If implementing MCP server, reference the MCP SDK docs

Keep iterating until all criteria are met.

" --max-iterations 50 --completion-promise "MSW-COMPLETE"
```

---

## Alternative: Manual Step-by-Step Execution

If you prefer not to use Ralph loop, execute these commands in sequence:

### Phase 0: Ingest

```bash
# Clone the repo
git clone https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW.git
cd kr8tiv-MSW

# Read all files
cat README.md
cat MSW_PRD.md
cat "Research Report_ Architectural Blueprint for the MSW Protocol.md"
cat "MSW - The Ralph Loop and MCP_ Advanced Agentic Orchestration Frameworks.md"
cat "Implementing the MSW Protocol with Claude_ A Guide to Effective AI-Powered Development.md"
cat "Strategic Playbook_ Rapidly Developing and Launching a Market-Ready AI Agent.md"
cat msw-notebooklm-extractor.js
```

### Phase 1: Initialize GSD

```
/gsd:new-project
```

### Phase 2: Execute Development Loop

```
/gsd:plan-phase 1
/gsd:execute-phase 1
/gsd:verify-work 1
```

Repeat for each phase until complete.

---

## Configuration for Opus 4.5

### Claude Code Settings

Ensure you're using Opus 4.5 for best results:

```json
{
  "model": "claude-opus-4-5-20250514",
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Git(*)"
    ]
  }
}
```

### GSD Settings (optional)

For comprehensive planning:

```
/gsd:settings
- mode: interactive (recommended for first run)
- depth: comprehensive
- profile: quality (uses Opus for planning)
- workflow.research: true
- workflow.plan_check: true
- workflow.verifier: true
```

---

## Expected Outputs After Execution

### Directory Structure

```
kr8tiv-MSW/
├── .planning/
│   ├── PROJECT.md
│   ├── REQUIREMENTS.md
│   ├── ROADMAP.md
│   ├── STATE.md
│   └── phases/
│       ├── 01-PLAN.md
│       ├── 01-SUMMARY.md
│       └── ...
├── src/
│   ├── auto-conversation/
│   │   ├── engine.js
│   │   ├── relevance.js
│   │   ├── extractor.js
│   │   └── compiler.js
│   ├── browser/
│   │   ├── driver.js
│   │   ├── selectors.js
│   │   └── auth.js
│   ├── tools/
│   │   ├── init.js
│   │   ├── research.js
│   │   └── ...
│   └── utils/
│       └── ...
├── server.js
├── package.json
├── README.md
└── tests/
    └── ...
```

### Git History

Each task should produce an atomic commit:

```
abc123f feat(01-01): implement Playwright browser driver
def456g feat(01-02): add NotebookLM topic detection
ghi789h feat(01-03): implement relevance scoring
jkl012i feat(01-04): create auto-expansion loop
...
```

---

## Troubleshooting

### "GSD commands not found"

```bash
npx get-shit-done-cc --claude --local
```

### "Files not read from repo"

Ensure you've cloned the repo first:

```bash
git clone https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW.git
cd kr8tiv-MSW
```

### "Ralph loop exits early"

Check that your completion promise matches exactly:

```
--completion-promise "MSW-COMPLETE"
```

The agent must output `<promise>MSW-COMPLETE</promise>` to exit successfully.

### "Rate limit hit during development"

If testing NotebookLM automation, use a dedicated Google account and limit test runs.

---

## Quick Start (Copy-Paste Ready)

```bash
# 1. Clone repo
git clone https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW.git
cd kr8tiv-MSW

# 2. Install GSD (if not already installed)
npx get-shit-done-cc --claude --local

# 3. Start Claude Code
claude

# 4. In Claude Code, paste:
```

```
Read ALL files in this directory and the following from GitHub:
https://github.com/Matt-Aurora-Ventures/kr8tiv-MSW

Then run /gsd:new-project to start development of the MSW Protocol.

The PRD (MSW_PRD.md) is the source of truth. The core feature is the Auto-Conversation Engine that:
1. Auto-clicks NotebookLM's suggested topics
2. Evaluates relevance (score 0-100)
3. Continues until no new relevant topics
4. Injects agent errors INTO NotebookLM
5. Compiles and commits all findings

Follow GSD workflow: plan → execute → verify for each phase.
```

---

**Good luck. Make shit work. 🚀**
