---
phase: 06-end-to-end-integration
plan: 03
status: complete
completed: 2026-02-02
---

# 06-03 Summary: E2E Smoke Tests for MCP stdio Protocol

## What Was Done

Created E2E test infrastructure using vitest that spawns the MCP server as a real child process and communicates over stdio using the MCP SDK's StdioClientTransport.

## Artifacts Created

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration with 30s timeout for MCP startup |
| `tests/e2e/helpers/spawn-server.ts` | Test helper: spawns MCP server, returns SDK Client + cleanup |
| `tests/e2e/mcp-client.test.ts` | 4 E2E smoke tests for MCP tool round-trips |
| `package.json` | Added `test` and `test:watch` scripts |

## Tests

| Test | What It Validates |
|------|-------------------|
| `server lists all 7 tools` | listTools returns all 7 registered tools by name |
| `msw_init creates config` | msw_init tool creates .msw/config.json on disk via MCP protocol |
| `msw_status returns status after init` | msw_status reads config back through full round-trip |
| `msw_status without project returns job list` | Default status returns job listing |

All 4 tests pass. No browser required.

## Key Decisions

- Used `StdioClientTransport` from MCP SDK directly (no execa dependency needed)
- Tests use `os.tmpdir()` with unique suffix for isolation
- Server process cleaned up in afterAll via `client.close()`
- Browser-dependent tests (msw_research) deferred to live-test suite behind env var gate
