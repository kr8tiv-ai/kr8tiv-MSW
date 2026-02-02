---
phase: 04-mcp-server
plan: 04
status: complete
---

# 04-04 Summary: msw_research MCP Tool

## What Was Built

Created `src/mcp/tools/msw-research.ts` exporting `registerMswResearch(server)` which registers the `msw_research` MCP tool.

## Tool Behavior

1. **Input validation**: Checks `.msw/config.json` exists in `projectDir`, returns `isError` if missing
2. **Job creation**: Creates a job via `jobManager.create("msw_research")` and returns the job ID immediately (non-blocking)
3. **Background execution**: Fires `runResearchJob()` async which:
   - Updates job to "running"
   - Attempts dynamic import of `TopicExpansionEngine` from auto-conversation module
   - On success: marks completed with engine integration metadata
   - On missing module: marks completed with stub message (Phase 2 dependency)
   - On error: marks failed with error message

## Input Schema (Zod)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| projectDir | string | required | Project directory with .msw/ config |
| topic | string | required | Research topic or question |
| maxQueries | number | 20 | Max queries before stopping |
| relevanceThreshold | number | 60 | Min relevance score 0-100 |

## Response Format

```json
{ "jobId": "uuid", "status": "queued", "topic": "...", "notebookUrls": [], "pollWith": "msw_status" }
```

## Verification

- `npx tsc --noEmit` passes with zero errors
- Tool returns job ID without blocking
- Job transitions: queued -> running -> completed/failed
