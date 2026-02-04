---
phase: 09-production-hardening
plan: 04
subsystem: diagnostics
tags: [self-healing, chrome-locks, selector-diagnostics, health-checks, auto-fix]

# Dependency graph
requires:
  - phase: 09-production-hardening
    plan: 01
    provides: Structured logging infrastructure
affects: [09-05 (interactive-demo), all components using browser automation]

# Tech tracking
tech-stack:
  added: []
  patterns: [auto-remediation, health-check-validation, diagnostic-reporting]

key-files:
  created:
    - src/diagnostics/chrome-profile.ts
    - src/diagnostics/selector-report.ts
    - src/diagnostics/auto-fixer.ts
    - src/diagnostics/health-checker.ts
    - src/diagnostics/index.ts

key-decisions:
  - "Chrome lock detection checks SingletonLock, SingletonSocket, SingletonCookie, and database lock patterns"
  - "Auto-fix only clears locks if Chrome hasn't modified them in last 5 seconds (safety check)"
  - "Selector diagnostic reports include HTML snapshots (10KB limit) and pattern-based suggestions"
  - "Health checker returns healthy/degraded/unhealthy status with canProceed flag"
  - "Diagnostic reports saved to .msw/diagnostics/ directory"

patterns-established:
  - "Chrome lock detection pattern: detectChromeLock() → auto-clear if safe → verify success"
  - "Selector failure pattern: capture HTML snapshot → analyze selector pattern → suggest alternatives"
  - "Health check pattern: run checks → auto-fix issues → return status with canProceed"
  - "Auto-fixer pattern: AutoFixer class with pluggable fix handlers (chrome-lock, selector, config)"

# Metrics
duration: 3.5min
completed: 2026-02-04
---

# Phase 9 Plan 4: Self-Healing Diagnostics Summary

**Self-healing diagnostics that detect and auto-fix common issues like Chrome profile locks and selector failures**

## Performance

- **Duration:** 3.5 min
- **Started:** 2026-02-04T05:05:04Z
- **Completed:** 2026-02-04T05:08:29Z
- **Tasks:** 2
- **Files modified:** 5 (all new src/diagnostics/ files)

## Accomplishments

- Chrome profile lock detection for SingletonLock, SingletonSocket, SingletonCookie, and database locks
- Auto-clearing of stale lock files with safety check (verifies Chrome isn't running)
- Selector failure diagnostic report generation with HTML snapshots and pattern-based suggestions
- Health checker that validates configuration, profile directory, lock files, and .msw directory
- AutoFixer class for automatic remediation with pluggable fix handlers
- Format functions for human-readable output of health checks and selector reports

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Chrome profile lock detection and clearing** - `5fbc0dc` (feat)
2. **Task 2: Implement selector diagnostic reports and auto-fixer** - `45aaf7f` (feat)

## Files Created/Modified

- `src/diagnostics/chrome-profile.ts` - Lock detection and clearing with safety checks
- `src/diagnostics/selector-report.ts` - Diagnostic report generation with pattern analysis
- `src/diagnostics/auto-fixer.ts` - AutoFixer class for automatic remediation
- `src/diagnostics/health-checker.ts` - Pre-launch health validation with auto-fix integration
- `src/diagnostics/index.ts` - Barrel exports for diagnostics module

## Decisions Made

1. **Chrome lock safety check** - Only auto-clear locks if not modified in last 5 seconds to prevent clearing locks from running Chrome instances
2. **HTML snapshot limit** - Limit HTML snapshots to 10KB to prevent huge diagnostic files while preserving debugging context
3. **Pattern-based selector suggestions** - Analyze selector patterns (aria-label, CSS classes, XPath) and suggest alternatives based on NotebookLM UI characteristics
4. **Health status levels** - Three-tier status (healthy/degraded/unhealthy) with canProceed flag for automated decision-making
5. **Database lock patterns** - Include shared_proto_db/metadata/LOCK, Local State.lock, Cookies.lock, History.lock in detection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - diagnostics module is ready for integration into browser launch flow.

## Next Phase Readiness

- Diagnostics module ready for integration into BrowserDriver (pre-launch health checks)
- AutoFixer can be invoked before browser launch to remediate common issues
- Selector failure handler ready for integration into NotebookNavigator error handling
- Health checker can be exposed via MCP tool for user-facing diagnostics
- Ready for 09-05: Interactive demo mode (can use health checker for setup validation)

## Self-Healing Capabilities

**Chrome Profile Lock Auto-Fix:**
- Detects: SingletonLock, SingletonSocket, SingletonCookie, database LOCK files
- Safety: Checks last modified time (only clear if >5s old to avoid clearing running Chrome)
- Reports: Clear success/failure for each lock file

**Selector Failure Diagnostics:**
- Captures: HTML snapshot (10KB), page URL, error message, timestamp
- Analyzes: Selector pattern (aria-label, data-*, CSS classes, ID, XPath)
- Suggests: Alternative selector strategies based on NotebookLM UI patterns
- Saves: JSON report to .msw/diagnostics/ for debugging

**Health Check Validation:**
- Checks: Configuration exists, profile directory exists, no Chrome locks, .msw directory writable
- Auto-fixes: Chrome locks (via AutoFixer integration)
- Status: healthy (all passed) / degraded (non-critical failures) / unhealthy (critical failures)
- Decision: canProceed flag guides whether to proceed with browser launch

---
*Phase: 09-production-hardening*
*Completed: 2026-02-04*
