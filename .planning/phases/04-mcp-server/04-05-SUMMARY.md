---
phase: 04-mcp-server
plan: 05
status: complete
completed: 2026-02-02
---

# 04-05 Summary: msw_plan and msw_execute MCP Tools

## What Was Done

Implemented two MCP tool registrars following the existing job-manager pattern:

### msw_plan (`src/mcp/tools/msw-plan.ts`)
- Exports `registerMswPlan(server: McpServer)`
- Registers `msw_plan` tool with inputs: `projectDir`, `researchJobId` (optional), `outputPath` (optional)
- Validates `.msw/` directory exists and research job completion (if provided)
- Creates background job that reads `.msw/research/` files and compiles a basic PRD markdown
- Writes output to `outputPath` (default: `.msw/PRD.md`)
- Stub PRD generation ready for Phase 5 engine integration

### msw_execute (`src/mcp/tools/msw-execute.ts`)
- Exports `registerMswExecute(server: McpServer)`
- Registers `msw_execute` tool with inputs: `projectDir`, `taskDescription`, `maxIterations` (default 5)
- Validates `.msw/` directory exists
- Creates background job that runs a stubbed Ralph loop with iteration logging
- Writes per-iteration logs to `.msw/execution/iteration-N.md`
- Progress updates on each iteration via job manager

## Verification

- `npx tsc --noEmit` passes with zero errors
- Both tools follow the same job ID pattern: create job, return ID immediately, run background work

## Files Created
- `src/mcp/tools/msw-plan.ts`
- `src/mcp/tools/msw-execute.ts`
