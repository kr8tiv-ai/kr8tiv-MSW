# Phase 9: Production Hardening - Research

**Researched:** 2026-02-03
**Domain:** Structured logging, rate limiting, interactive onboarding, self-healing diagnostics, session management, performance metrics
**Confidence:** HIGH

## Summary

Phase 9 establishes operational excellence through five key capabilities: (1) structured logging with Pino and automatic file rotation, (2) rate limiting with usage tracking and dashboard display, (3) interactive demo mode for first-time user onboarding, (4) self-healing diagnostics that detect and auto-fix common issues, and (5) session management with progress tracking and cancellation support. The project already uses Pino implicitly through the existing stack patterns; this phase formalizes logging infrastructure.

The primary work involves: (1) implementing Pino logger with pino-roll transport for log rotation to `.msw/logs/`, (2) building a quota tracker for NotebookLM's 50 queries/day limit with warning at 80%, (3) creating an Inquirer.js-based setup wizard for first-time configuration, (4) implementing circuit breaker and auto-recovery patterns for Chrome profile locks and selector failures, (5) building a blessed-contrib terminal dashboard for session visualization, and (6) using Node.js perf_hooks for timing metrics export.

**Primary recommendation:** Use Pino 9.x with pino-roll transport (worker thread) for non-blocking log rotation, build a simple in-memory quota tracker with persistent JSON state, use Inquirer.js for interactive prompts with validation, implement circuit breaker pattern for self-healing with graceful degradation, and use blessed-contrib for terminal UI dashboard with progress gauges.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [pino](https://github.com/pinojs/pino) | ^9.x | Structured JSON logging | 5-10x faster than Winston, minimal overhead, MCP stderr-safe |
| [pino-roll](https://github.com/mcollina/pino-roll) | ^2.x | Log rotation transport | Worker thread rotation, size+time based, file count limits |
| [inquirer](https://github.com/SBoudrias/Inquirer.js) | ^9.x | Interactive CLI prompts | Industry standard, validation, nested prompts, TypeScript support |
| [blessed-contrib](https://github.com/yaronn/blessed-contrib) | ^4.x | Terminal dashboard widgets | Gauges, charts, progress bars, low memory footprint |
| [perf_hooks](https://nodejs.org/api/perf_hooks.html) | (built-in) | Performance metrics | Native Node.js API, high-resolution timing, JSON export |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [pino-pretty](https://github.com/pinojs/pino-pretty) | ^13.x | Human-readable dev logs | Development only, never production |
| [chalk](https://github.com/chalk/chalk) | ^5.x | Colored CLI output | Colored prompts, status messages |
| [ora](https://github.com/sindresorhus/ora) | ^8.x | Elegant spinners | Loading states during setup wizard |
| [figlet](https://github.com/patorjk/figlet.js) | ^1.x | ASCII art text | Welcome banner in demo mode |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pino-roll | rotating-file-stream | pino-roll is Pino-native, worker thread support |
| blessed-contrib | ink (React) | blessed-contrib is lighter, no React dependency |
| inquirer | prompts | inquirer has better TypeScript support, more prompt types |
| perf_hooks | prom-client | perf_hooks is built-in, no external dependency for local metrics |

**Installation:**
```bash
npm install pino pino-roll inquirer blessed blessed-contrib chalk ora figlet
npm install -D pino-pretty @types/inquirer @types/blessed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── logging/
│   ├── index.ts          # Barrel export
│   ├── logger.ts         # Pino logger factory
│   ├── transports.ts     # Transport configuration (file, stderr)
│   └── levels.ts         # Log level configuration
├── rate-limiting/
│   ├── index.ts          # Barrel export
│   ├── quota-tracker.ts  # Query count tracking
│   ├── usage-store.ts    # Persistent JSON storage
│   └── dashboard.ts      # Usage display component
├── demo/
│   ├── index.ts          # Barrel export
│   ├── wizard.ts         # Setup wizard flow
│   ├── prompts.ts        # Inquirer prompt definitions
│   └── sample-notebook.ts # Sample notebook fallback
├── diagnostics/
│   ├── index.ts          # Barrel export
│   ├── health-checker.ts # Periodic health checks
│   ├── auto-fixer.ts     # Auto-remediation handlers
│   ├── chrome-profile.ts # Chrome lock detection/clearing
│   └── selector-report.ts # Selector failure diagnostics
├── session/
│   ├── index.ts          # Barrel export
│   ├── manager.ts        # Active session tracking
│   ├── progress.ts       # Progress state updates
│   ├── cancellation.ts   # Graceful cancellation
│   └── dashboard.ts      # Terminal UI dashboard
└── metrics/
    ├── index.ts          # Barrel export
    ├── collector.ts      # perf_hooks data collection
    └── exporter.ts       # JSON export functionality
```

### Pattern 1: Pino Structured Logging with Worker Thread Transport
**What:** Configure Pino logger with pino-roll transport running in worker thread for non-blocking file rotation.
**When to use:** All production logging throughout the application.
**Why:** MCP servers using stdio MUST NOT write to stdout (breaks JSON-RPC). Pino with stderr destination and worker thread transport ensures logging doesn't block the event loop.
**Example:**
```typescript
// src/logging/logger.ts
import pino from "pino";
import { join } from "node:path";

// Log level from environment variable (HARD-08)
const LOG_LEVEL = process.env.MSW_LOG_LEVEL || "info";

// Worker thread transport for file rotation (non-blocking)
const transport = pino.transport({
  targets: [
    // File transport with rotation (HARD-07)
    {
      target: "pino-roll",
      level: LOG_LEVEL,
      options: {
        file: join(process.cwd(), ".msw/logs/msw"),
        frequency: "daily",    // Rotate daily
        size: "10m",           // Or when file reaches 10MB
        limit: { count: 7 },   // Keep 7 rotated files + current
        dateFormat: "yyyy-MM-dd",
        mkdir: true,           // Create directory if missing
        extension: ".log",
      },
    },
    // Stderr for development visibility (doesn't break MCP)
    {
      target: "pino/file",
      level: LOG_LEVEL,
      options: { destination: 2 }, // fd 2 = stderr
    },
  ],
});

export const logger = pino(
  {
    level: LOG_LEVEL,
    // Structured logging fields
    base: {
      service: "msw-protocol",
      version: process.env.npm_package_version,
    },
    // Timestamp in ISO format
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive fields
    redact: {
      paths: ["password", "token", "cookie", "*.password", "*.token"],
      censor: "[REDACTED]",
    },
  },
  transport
);

// Child logger factory for component-specific logging
export function createLogger(component: string) {
  return logger.child({ component });
}
```

### Pattern 2: Rate Limiting with Quota Tracking
**What:** Track NotebookLM API usage against daily quota, warn at 80%, persist state across sessions.
**When to use:** Before every NotebookLM request.
**Why:** NotebookLM free tier is limited to 50 queries/day. Proactive warnings prevent workflow interruption.
**Example:**
```typescript
// src/rate-limiting/quota-tracker.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logging/logger.js";

const log = createLogger("quota-tracker");

interface QuotaState {
  date: string;           // Current day (YYYY-MM-DD)
  used: number;           // Queries used today
  limit: number;          // Daily limit (50 for free tier)
  lastReset: string;      // Last reset timestamp
}

const QUOTA_FILE = join(process.cwd(), ".msw/quota.json");
const DEFAULT_LIMIT = 50;
const WARNING_THRESHOLD = 0.8; // 80%

export class QuotaTracker {
  private state: QuotaState;

  constructor() {
    this.state = this.loadOrInitState();
  }

  private loadOrInitState(): QuotaState {
    const today = new Date().toISOString().split("T")[0];

    if (existsSync(QUOTA_FILE)) {
      const saved = JSON.parse(readFileSync(QUOTA_FILE, "utf-8")) as QuotaState;
      // Reset if new day
      if (saved.date !== today) {
        log.info({ previousUsed: saved.used }, "Daily quota reset");
        return this.initState(today);
      }
      return saved;
    }
    return this.initState(today);
  }

  private initState(date: string): QuotaState {
    return {
      date,
      used: 0,
      limit: DEFAULT_LIMIT,
      lastReset: new Date().toISOString(),
    };
  }

  private persist(): void {
    writeFileSync(QUOTA_FILE, JSON.stringify(this.state, null, 2));
  }

  /**
   * Check if a request can proceed. Returns status with warning if approaching limit.
   */
  canRequest(): { allowed: boolean; warning?: string; usage: QuotaUsage } {
    const usage = this.getUsage();

    if (this.state.used >= this.state.limit) {
      log.warn({ usage }, "Quota exhausted for today");
      return {
        allowed: false,
        warning: `Daily quota exhausted (${usage.used}/${usage.limit}). Resets at midnight.`,
        usage,
      };
    }

    // HARD-09: Warn at 80% threshold
    if (usage.percentUsed >= WARNING_THRESHOLD * 100) {
      log.warn({ usage }, "Approaching quota limit");
      return {
        allowed: true,
        warning: `Approaching quota limit: ${usage.remaining} requests remaining today.`,
        usage,
      };
    }

    return { allowed: true, usage };
  }

  /**
   * Record a request was made.
   */
  recordRequest(): void {
    this.state.used++;
    this.persist();
    log.debug({ used: this.state.used, limit: this.state.limit }, "Request recorded");
  }

  /**
   * Get current usage statistics (HARD-10: for dashboard display).
   */
  getUsage(): QuotaUsage {
    const resetTime = new Date(this.state.date);
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);

    return {
      used: this.state.used,
      limit: this.state.limit,
      remaining: Math.max(0, this.state.limit - this.state.used),
      percentUsed: Math.round((this.state.used / this.state.limit) * 100),
      resetTime: resetTime.toISOString(),
    };
  }
}

export interface QuotaUsage {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetTime: string;
}
```

### Pattern 3: Interactive Demo Mode with Setup Wizard
**What:** Guide first-time users through configuration with interactive prompts and sample notebook fallback.
**When to use:** On first run (no config exists) or with `--demo` flag.
**Why:** Reduces barrier to entry, provides safe exploration environment.
**Example:**
```typescript
// src/demo/wizard.ts
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import figlet from "figlet";
import { createLogger } from "../logging/logger.js";

const log = createLogger("setup-wizard");

// HARD-11: Sample notebook URL for demo mode
const SAMPLE_NOTEBOOK_URL = "https://notebooklm.google.com/notebook/demo-sample";

interface SetupAnswers {
  notebookUrl: string;
  useDemo: boolean;
  logLevel: string;
  headless: boolean;
}

export async function runSetupWizard(): Promise<SetupAnswers> {
  // Welcome banner
  console.log(
    chalk.cyan(
      figlet.textSync("MSW Protocol", { horizontalLayout: "default" })
    )
  );
  console.log(chalk.gray("Make Shit Work - NotebookLM Integration\n"));

  // HARD-12: Interactive setup wizard
  const answers = await inquirer.prompt<SetupAnswers>([
    {
      type: "confirm",
      name: "useDemo",
      message: "Would you like to start with demo mode (safe, read-only)?",
      default: true,
    },
    {
      type: "input",
      name: "notebookUrl",
      message: "Enter your NotebookLM notebook URL:",
      when: (answers) => !answers.useDemo,
      validate: (input: string) => {
        if (!input.includes("notebooklm.google.com/notebook/")) {
          return "Please enter a valid NotebookLM URL (e.g., https://notebooklm.google.com/notebook/abc123)";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "logLevel",
      message: "Select logging verbosity:",
      choices: [
        { name: "Error only (quiet)", value: "error" },
        { name: "Warnings and errors", value: "warn" },
        { name: "Standard (recommended)", value: "info" },
        { name: "Debug (verbose)", value: "debug" },
      ],
      default: "info",
    },
    {
      type: "confirm",
      name: "headless",
      message: "Run browser in headless mode (no visible window)?",
      default: true,
    },
  ]);

  // Use sample notebook in demo mode (HARD-11)
  if (answers.useDemo) {
    answers.notebookUrl = SAMPLE_NOTEBOOK_URL;
    console.log(
      chalk.yellow("\nDemo mode: Using sample notebook (read-only access)")
    );
  }

  // Save configuration with spinner
  const spinner = ora("Saving configuration...").start();
  try {
    await saveConfiguration(answers);
    spinner.succeed("Configuration saved to .msw/config.yaml");
  } catch (error) {
    spinner.fail("Failed to save configuration");
    log.error({ error }, "Configuration save failed");
    throw error;
  }

  log.info({ mode: answers.useDemo ? "demo" : "production" }, "Setup wizard completed");
  return answers;
}

async function saveConfiguration(answers: SetupAnswers): Promise<void> {
  // Implementation would write to .msw/config.yaml
}
```

### Pattern 4: Self-Healing Diagnostics with Auto-Fix
**What:** Detect common issues (Chrome profile locks, selector failures) and automatically remediate when possible.
**When to use:** Before browser launch and after browser errors.
**Why:** Reduces manual intervention, improves reliability.
**Example:**
```typescript
// src/diagnostics/auto-fixer.ts
import { existsSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logging/logger.js";

const log = createLogger("diagnostics");

// HARD-13: Chrome profile lock detection and clearing
export async function detectAndFixChromeLock(
  profilePath: string
): Promise<DiagnosticResult> {
  const lockFile = join(profilePath, "SingletonLock");
  const socketFile = join(profilePath, "SingletonSocket");
  const cookieLock = join(profilePath, "SingletonCookie");

  const issues: string[] = [];
  const fixes: string[] = [];

  // Check for lock files
  for (const lockPath of [lockFile, socketFile, cookieLock]) {
    if (existsSync(lockPath)) {
      issues.push(`Lock file found: ${lockPath}`);
      try {
        unlinkSync(lockPath);
        fixes.push(`Removed lock file: ${lockPath}`);
        log.info({ lockPath }, "Auto-removed Chrome lock file");
      } catch (error) {
        log.error({ lockPath, error }, "Failed to remove Chrome lock file");
      }
    }
  }

  // Check for database locks
  const dbLockPatterns = [
    "shared_proto_db/metadata/LOCK",
    "Local State.lock",
  ];

  for (const pattern of dbLockPatterns) {
    const dbLock = join(profilePath, pattern);
    if (existsSync(dbLock)) {
      issues.push(`Database lock found: ${pattern}`);
      try {
        unlinkSync(dbLock);
        fixes.push(`Removed database lock: ${pattern}`);
        log.info({ dbLock }, "Auto-removed database lock file");
      } catch (error) {
        // Database locks may be held by running process
        log.warn({ dbLock, error }, "Could not remove database lock (may be in use)");
      }
    }
  }

  return {
    healthy: issues.length === 0 || fixes.length === issues.length,
    issues,
    fixes,
    requiresManualIntervention: issues.length > fixes.length,
  };
}

// HARD-14: Selector failure detection with diagnostic report
export function createSelectorDiagnosticReport(
  selector: string,
  error: Error,
  pageHtml?: string
): SelectorDiagnostic {
  const report: SelectorDiagnostic = {
    timestamp: new Date().toISOString(),
    failedSelector: selector,
    error: error.message,
    suggestions: [],
    htmlSnapshot: pageHtml?.substring(0, 5000), // First 5KB for context
  };

  // Analyze selector pattern and suggest alternatives
  if (selector.includes("aria-label")) {
    report.suggestions.push(
      "aria-label may have changed - check NotebookLM UI for updated labels"
    );
    report.suggestions.push(
      "Try using role-based selector: [role='button'], [role='textbox']"
    );
  }

  if (selector.includes("data-")) {
    report.suggestions.push(
      "data-* attribute may be dynamically generated - use more stable selector"
    );
  }

  if (selector.includes("class=") || selector.match(/\.[a-z]+-[a-zA-Z0-9]+/)) {
    report.suggestions.push(
      "CSS class selectors are brittle - NotebookLM uses generated class names"
    );
    report.suggestions.push(
      "Prefer semantic selectors: role, aria-label, text content"
    );
  }

  // Write diagnostic report
  const reportPath = join(
    process.cwd(),
    `.msw/diagnostics/selector-${Date.now()}.json`
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.warn({ reportPath, selector }, "Selector diagnostic report created");

  return report;
}

export interface DiagnosticResult {
  healthy: boolean;
  issues: string[];
  fixes: string[];
  requiresManualIntervention: boolean;
}

export interface SelectorDiagnostic {
  timestamp: string;
  failedSelector: string;
  error: string;
  suggestions: string[];
  htmlSnapshot?: string;
}
```

### Pattern 5: Session Management Dashboard
**What:** Terminal UI dashboard showing active operations, progress, and cancellation controls.
**When to use:** During long-running operations (research, execution phases).
**Why:** Provides visibility into multi-step operations without flooding console.
**Example:**
```typescript
// src/session/dashboard.ts
import blessed from "blessed";
import contrib from "blessed-contrib";
import { createLogger } from "../logging/logger.js";

const log = createLogger("session-dashboard");

export interface SessionState {
  id: string;
  operation: string;
  progress: number;       // 0-100
  status: "running" | "paused" | "completed" | "failed" | "cancelled";
  startTime: Date;
  eta?: Date;
  messages: string[];
}

export class SessionDashboard {
  private screen: blessed.Widgets.Screen;
  private grid: contrib.grid;
  private progressGauge: contrib.Widgets.GaugeElement;
  private statusLog: contrib.Widgets.LogElement;
  private sessions: Map<string, SessionState> = new Map();

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "MSW Protocol - Session Dashboard",
    });

    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Progress gauge (top)
    this.progressGauge = this.grid.set(0, 0, 4, 12, contrib.gauge, {
      label: "Current Operation",
      stroke: "cyan",
      fill: "white",
      showLabel: true,
    });

    // Status log (bottom)
    this.statusLog = this.grid.set(4, 0, 8, 12, contrib.log, {
      fg: "green",
      selectedFg: "green",
      label: "Session Log",
    });

    // Key bindings
    this.screen.key(["escape", "q", "C-c"], () => {
      this.close();
      process.exit(0);
    });

    this.screen.key(["c"], () => {
      this.cancelCurrentSession();
    });
  }

  updateSession(state: SessionState): void {
    this.sessions.set(state.id, state);

    // Update gauge
    this.progressGauge.setPercent(state.progress);

    // Update log
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage) {
      this.statusLog.log(
        `[${state.operation}] ${lastMessage}`
      );
    }

    this.screen.render();
    log.debug({ sessionId: state.id, progress: state.progress }, "Session updated");
  }

  private cancelCurrentSession(): void {
    const current = Array.from(this.sessions.values()).find(
      (s) => s.status === "running"
    );
    if (current) {
      current.status = "cancelled";
      this.statusLog.log(`Cancellation requested for session ${current.id}`);
      this.screen.render();
      log.info({ sessionId: current.id }, "Session cancellation requested");
    }
  }

  close(): void {
    this.screen.destroy();
  }

  static isTerminal(): boolean {
    return process.stdout.isTTY === true;
  }
}
```

### Pattern 6: Performance Metrics Collection
**What:** Collect timing metrics using Node.js perf_hooks and export to JSON.
**When to use:** For performance analysis and optimization.
**Example:**
```typescript
// src/metrics/collector.ts
import {
  performance,
  PerformanceObserver,
  PerformanceEntry,
} from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logging/logger.js";

const log = createLogger("metrics");

interface MetricEntry {
  name: string;
  duration: number;
  startTime: number;
  timestamp: string;
}

export class MetricsCollector {
  private entries: MetricEntry[] = [];
  private observer: PerformanceObserver;

  constructor() {
    // Observe user timing marks and measures
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordEntry(entry);
      }
    });
    this.observer.observe({ entryTypes: ["measure"] });
  }

  private recordEntry(entry: PerformanceEntry): void {
    this.entries.push({
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start a timing measurement.
   */
  startMeasure(name: string): void {
    performance.mark(`${name}-start`);
  }

  /**
   * End a timing measurement and record the duration.
   */
  endMeasure(name: string): number {
    performance.mark(`${name}-end`);
    const measure = performance.measure(name, `${name}-start`, `${name}-end`);

    log.debug({ name, duration: measure.duration }, "Metric recorded");

    // Clean up marks
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);

    return measure.duration;
  }

  /**
   * Get statistics for a specific metric.
   */
  getStats(name: string): MetricStats | undefined {
    const matching = this.entries.filter((e) => e.name === name);
    if (matching.length === 0) return undefined;

    const durations = matching.map((e) => e.duration);
    return {
      name,
      count: matching.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    };
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Export all metrics to JSON file (HARD-05).
   */
  exportToJson(path?: string): string {
    const outputPath = path || join(process.cwd(), `.msw/metrics-${Date.now()}.json`);

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntries: this.entries.length,
      entries: this.entries,
      statistics: this.getAllStats(),
    };

    writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    log.info({ outputPath, entryCount: this.entries.length }, "Metrics exported");

    return outputPath;
  }

  private getAllStats(): Record<string, MetricStats> {
    const names = [...new Set(this.entries.map((e) => e.name))];
    const stats: Record<string, MetricStats> = {};

    for (const name of names) {
      const stat = this.getStats(name);
      if (stat) stats[name] = stat;
    }

    return stats;
  }

  close(): void {
    this.observer.disconnect();
  }
}

export interface MetricStats {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}
```

### Anti-Patterns to Avoid

- **Logging to stdout in MCP servers:** MCP uses stdio for JSON-RPC communication. ANY stdout output breaks the protocol. Always log to stderr (fd 2) or files.
- **Synchronous file operations in hot paths:** Use async I/O or worker threads for logging to avoid blocking the event loop.
- **Hard-coded rate limits:** Store limits in configuration to support enterprise accounts (500 queries/day).
- **Blocking health checks:** Run diagnostics asynchronously; don't block MCP tool responses waiting for diagnostics.
- **Storing secrets in logs:** Always use Pino's `redact` option to mask tokens, cookies, and passwords.
- **Relying solely on CSS class selectors:** NotebookLM uses generated class names that change. Use semantic selectors (role, aria-label).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Log rotation | Custom file rotation | pino-roll | Handles worker threads, size + time, atomic rotation |
| Interactive prompts | readline/raw stdin | inquirer | Validation, nested prompts, TypeScript types |
| Terminal dashboard | Custom ANSI codes | blessed-contrib | Cross-platform, widgets, event handling |
| Timing metrics | Date.now() diffs | perf_hooks | High-resolution, native, consistent with browser API |
| Lock file handling | fs.unlink + retry | Graceful detection patterns | Race conditions, platform differences |
| JSON pretty logging | Custom formatting | pino-pretty | Streaming, colorized, development-only |

**Key insight:** Production hardening is about reliability. Don't reinvent solutions for well-solved problems. Use battle-tested libraries that handle edge cases you haven't thought of.

## Common Pitfalls

### Pitfall 1: stdout Corruption in MCP Servers
**What goes wrong:** Logging to stdout breaks MCP JSON-RPC communication; client can't parse responses.
**Why it happens:** console.log() defaults to stdout; developers forget MCP uses stdio transport.
**How to avoid:**
- Configure Pino to log to stderr (fd 2) for console output
- Use pino-roll for file output (separate from stdio)
- Never use console.log in production MCP code
- Add ESLint rule to warn on console.log usage
**Warning signs:**
- MCP client shows "Invalid JSON" errors
- Tool responses truncated or corrupted
- Logs appearing in tool response content

### Pitfall 2: Rate Limit State Not Persisted
**What goes wrong:** Application restart loses track of daily quota; exceeds limit unexpectedly.
**Why it happens:** In-memory tracking only; no persistence across restarts.
**How to avoid:**
- Persist quota state to `.msw/quota.json`
- Check for date change on load (reset if new day)
- Record quota usage BEFORE making request (pessimistic)
- Include quota state in backup/restore flow
**Warning signs:**
- "Quota exhausted" errors after restart
- Multiple restarts burning through daily limit
- No quota file in .msw/ directory

### Pitfall 3: Chrome Profile Lock Not Cleared
**What goes wrong:** Browser fails to launch with "SingletonLock" error; requires manual cleanup.
**Why it happens:** Previous browser instance crashed without releasing lock files.
**How to avoid:**
- Check for lock files before browser launch
- Implement auto-clearing with proper error handling
- Verify no running Chrome processes before clearing
- Log all lock file operations for debugging
**Warning signs:**
- "LOCK: File exists" errors on browser launch
- Manual rm commands needed to fix
- Browser works in fresh profiles but not existing

### Pitfall 4: Selector Failures Without Diagnostics
**What goes wrong:** NotebookLM UI changes; tests/automation fails; no indication of what changed.
**Why it happens:** Generic "element not found" errors; no context about selector or page state.
**How to avoid:**
- Capture HTML snapshot on selector failure
- Analyze selector pattern and suggest alternatives
- Write diagnostic reports to `.msw/diagnostics/`
- Include timestamp and selector context
**Warning signs:**
- "Element not found" with no details
- Working one day, failing the next
- Same selectors work locally but fail in CI

### Pitfall 5: Dashboard Blocks Event Loop
**What goes wrong:** Terminal dashboard freezes application; MCP requests timeout.
**Why it happens:** Synchronous rendering; too-frequent updates; event loop starvation.
**How to avoid:**
- Throttle dashboard updates (max 10 FPS)
- Use blessed's built-in batching
- Don't show dashboard in non-TTY environments
- Provide headless-compatible progress (JSON to stderr)
**Warning signs:**
- MCP tool timeouts during long operations
- Sluggish terminal response
- High CPU during idle dashboard

### Pitfall 6: Metrics Collection Memory Leak
**What goes wrong:** Memory grows unbounded; OOM after long sessions.
**Why it happens:** Metrics stored in memory array without pruning; no export/clear cycle.
**How to avoid:**
- Set maximum entries limit (e.g., 10,000)
- Export and clear periodically
- Use circular buffer for recent entries
- Monitor memory usage in dashboard
**Warning signs:**
- Memory usage grows over time
- Slower performance after hours of operation
- Node.js heap warnings

## Code Examples

Verified patterns from official sources:

### Pino MCP-Safe Configuration
```typescript
// src/logging/mcp-safe-logger.ts
// Source: https://github.com/pinojs/pino/blob/main/docs/transports.md
import pino from "pino";

// CRITICAL: MCP servers must not write to stdout (fd 1)
// Use stderr (fd 2) and file transports only

const transport = pino.transport({
  targets: [
    // File output with rotation
    {
      target: "pino-roll",
      level: process.env.MSW_LOG_LEVEL || "info",
      options: {
        file: ".msw/logs/msw",
        frequency: "daily",
        size: "10m",
        limit: { count: 7 },
        mkdir: true,
        extension: ".log",
      },
    },
    // Stderr for development (doesn't break MCP stdio)
    ...(process.env.NODE_ENV !== "production"
      ? [
          {
            target: "pino-pretty",
            level: "debug",
            options: { destination: 2 }, // stderr
          },
        ]
      : []),
  ],
});

export const logger = pino(
  {
    level: process.env.MSW_LOG_LEVEL || "info",
    redact: ["password", "token", "cookie", "*.password", "*.token"],
  },
  transport
);
```

### Inquirer Setup Wizard with Validation
```typescript
// src/demo/prompts.ts
// Source: https://github.com/SBoudrias/Inquirer.js
import inquirer from "inquirer";

export const setupPrompts = [
  {
    type: "input",
    name: "notebookUrl",
    message: "NotebookLM notebook URL:",
    validate: (input: string) => {
      const urlPattern = /^https:\/\/notebooklm\.google\.com\/notebook\/[a-zA-Z0-9_-]+$/;
      if (!urlPattern.test(input)) {
        return "Invalid NotebookLM URL. Format: https://notebooklm.google.com/notebook/[id]";
      }
      return true;
    },
    filter: (input: string) => input.trim(),
  },
  {
    type: "list",
    name: "logLevel",
    message: "Log verbosity:",
    choices: ["error", "warn", "info", "debug"],
    default: "info",
  },
  {
    type: "number",
    name: "maxRetries",
    message: "Maximum retry attempts:",
    default: 3,
    validate: (input: number) => input >= 1 && input <= 10,
  },
];
```

### Circuit Breaker Pattern for Self-Healing
```typescript
// src/diagnostics/circuit-breaker.ts
// Source: https://www.geeksforgeeks.org/system-design/self-healing-systems-system-design/

type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailure?: Date;
  private readonly threshold: number;
  private readonly resetTimeout: number; // ms

  constructor(threshold = 5, resetTimeoutMs = 30000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      // Check if we should transition to half-open
      if (this.shouldAttemptReset()) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return true;
    return Date.now() - this.lastFailure.getTime() >= this.resetTimeout;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.threshold) {
      this.state = "open";
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Winston logging | Pino logging | 2020+ | 5-10x faster, lower memory |
| Synchronous file rotation | Worker thread transports | Pino 7.0 (2021) | Non-blocking I/O |
| Manual CLI prompts | Inquirer.js | 2015+ | Validation, TypeScript, plugins |
| Custom ANSI terminal UI | blessed/ink | 2015+ | Cross-platform, event handling |
| Date.now() timing | perf_hooks API | Node 8.5+ | High-resolution, consistent |
| Polling-based health checks | Event-driven diagnostics | 2024+ | Lower overhead, real-time |

**Deprecated/outdated:**
- **Winston**: Still works but 5-10x slower than Pino. Use Pino for new projects.
- **console.log for debugging**: Use structured logging even in development.
- **@vrbo/pino-rotating-file**: DEPRECATED. Use pino-roll instead.
- **blessed (original)**: Unmaintained. Use neo-blessed or blessed-contrib.

## Open Questions

1. **Should dashboard run in separate process?**
   - What we know: blessed-contrib runs in main process, can block event loop
   - What's unclear: Performance impact on MCP tool response times
   - Recommendation: Start in-process with throttling; extract to subprocess if issues arise. Provide `--no-dashboard` flag for headless CI.

2. **How to handle enterprise NotebookLM quotas?**
   - What we know: Enterprise accounts have higher limits (500+ queries/day)
   - What's unclear: How to detect enterprise tier automatically
   - Recommendation: Store quota limit in config (default: 50), document enterprise configuration. Do not attempt auto-detection.

3. **Should diagnostic reports be auto-submitted?**
   - What we know: Diagnostic reports contain page HTML (potentially sensitive)
   - What's unclear: User preference for telemetry
   - Recommendation: Never auto-submit. Store locally only. Document how to share reports for support. Implement `--telemetry` opt-in flag for future.

4. **What's the retention period for metrics files?**
   - What we know: Metrics can grow large over time
   - What's unclear: Balance between history and disk usage
   - Recommendation: Default to 7 days of metrics files, configurable via `MSW_METRICS_RETENTION_DAYS`. Auto-prune on startup.

## Sources

### Primary (HIGH confidence)

**Pino Logger:**
- [Pino GitHub Repository](https://github.com/pinojs/pino) - Official Pino source
- [Pino Transports Documentation](https://github.com/pinojs/pino/blob/main/docs/transports.md) - Worker thread transports
- [Pino Logger Guide 2026 - SigNoz](https://signoz.io/guides/pino-logger/) - Production configuration
- [Pino Complete Guide - Better Stack](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) - Best practices

**pino-roll:**
- [pino-roll npm](https://www.npmjs.com/package/pino-roll) - Official package
- [pino-roll GitHub](https://github.com/mcollina/pino-roll) - Source and documentation

**Inquirer.js:**
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js) - Official source
- [Inquirer.js Guide - Geshan](https://geshan.com.np/blog/2023/03/inquirer-js/) - Tutorial with examples

**Terminal UI:**
- [blessed-contrib GitHub](https://github.com/yaronn/blessed-contrib) - Dashboard widgets
- [Building Terminal Interfaces - OpenReplay](https://blog.openreplay.com/building-terminal-interfaces-nodejs/) - Architecture patterns

**Node.js Performance API:**
- [Node.js perf_hooks Documentation](https://nodejs.org/api/perf_hooks.html) - Official API reference
- [Node.js Performance API Guide - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/performance-apis/) - Usage patterns

### Secondary (MEDIUM confidence)

**Self-Healing Systems:**
- [Node.js Resiliency Concepts - AppSignal](https://blog.appsignal.com/2020/09/09/nodejs-resiliency-concepts-recovery-and-self-healing.html) - Recovery patterns
- [Self-Healing Systems - GeeksforGeeks](https://www.geeksforgeeks.org/system-design/self-healing-systems-system-design/) - Architecture patterns
- [Self-Healing AI Systems 2025 - Workwall](https://www.workwall.com/new-blog-posts/self-healing-ai-systems-building-machines-that-repair-themselves) - Modern approaches

**Rate Limiting:**
- [Rate Limiting in Express.js - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/) - Implementation patterns
- [API Rate Limiting at Scale - Gravitee](https://www.gravitee.io/blog/rate-limiting-apis-scale-patterns-strategies) - Distributed patterns

**Chrome Profile Issues:**
- [Playwright Profile Issues #36949](https://github.com/microsoft/playwright/issues/36949) - Lock file handling
- [Persistent Context Issues #35466](https://github.com/microsoft/playwright/issues/35466) - Profile corruption

### Tertiary (LOW confidence)

**CLI Best Practices:**
- [Create CLI Tool with Node.js - OneUptime](https://oneuptime.com/blog/post/2026-01-22-nodejs-create-cli-tool/view) - 2026 patterns
- [Interactive CLI - DigitalOcean](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts) - Inquirer tutorial

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pino and pino-roll are industry standard, well-documented
- Architecture: HIGH - Patterns verified from official docs and established practices
- Pitfalls: HIGH - Based on common MCP server issues and logging mistakes

**Research date:** 2026-02-03
**Valid until:** 2026-04-03 (60 days - stable domain, slow evolution)

**Notes:**
- Pino 9.x is the current stable version, widely adopted
- pino-roll is the recommended rotation solution (pino-rotating-file is deprecated)
- MCP servers MUST NOT log to stdout - this is critical for protocol compliance
- Self-healing patterns are well-established in system design literature
- Inquirer.js recently underwent major rewrite with improved TypeScript support
- blessed-contrib is stable but not actively developed; consider ink for React-based alternative
