---
phase: 05-gsd-ralph-integration
plan: 02
status: complete
---

# 05-02 Summary: GSD Format Adapter

## What Was Done

Created `src/planning/gsd-adapter.ts` providing bidirectional conversion between MSW internal task representation and GSD XML task format used in PLAN.md files.

## Artifacts

| File | Purpose |
|------|---------|
| `src/planning/gsd-adapter.ts` | GSD XML adapter with `toGsdXml`, `fromGsdXml`, `MswTask` exports |
| `tests/test-gsd-adapter.ts` | 6 tests covering round-trip, escaping, all task types |

## Exports

- **`MswTask`** interface: id, name, files, action, verify, done, type
- **`MswTaskType`** union: `'auto' | 'checkpoint:human-verify' | 'checkpoint:decision'`
- **`toGsdXml(tasks: MswTask[]): string`** - converts MSW tasks to GSD XML
- **`fromGsdXml(xml: string): MswTask[]`** - parses GSD XML back to MSW tasks

## Verification

- `npx tsc --noEmit` passes with zero errors
- 6/6 tests pass including round-trip fidelity and XML escape handling

## Key Decisions

- Used regex parsing (not a DOM parser) since GSD XML is flat with no nesting -- sufficient and dependency-free
- XML special characters (`&`, `<`, `>`, `"`) are escaped/unescaped for safe round-tripping
- Files array serialized as comma-separated string per GSD format convention
- `id` field is auto-generated from parse order in `fromGsdXml` (1-indexed)
