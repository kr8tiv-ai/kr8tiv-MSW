# 04-07: Wire All 7 Tools into Server

## What Was Done

1. **Created barrel export** `src/mcp/tools/index.ts` re-exporting all 7 tool registrars plus `registerTools` and `ToolRegistrar` type from registry.

2. **Updated `src/mcp/server.ts`** to import all registrars via the barrel and call `registerTools()` with all 7 in `createServer()`.

3. **Build verified** - `npm run build` compiles cleanly with no errors.

## Tools Wired
- msw_init
- msw_status
- msw_research
- msw_plan
- msw_execute
- msw_verify
- msw_notebook_add

## Files Changed
- `src/mcp/tools/index.ts` (new)
- `src/mcp/server.ts` (updated)
