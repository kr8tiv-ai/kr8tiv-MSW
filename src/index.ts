// Browser automation
export * from './browser/index.js';

// NotebookLM interaction
export * from './notebooklm/index.js';

// Browser types
export * from './types/browser.js';

// Auto-conversation engine
export * from './auto-conversation/index.js';

// Bidirectional query/response
export * from './bidirectional/index.js';

// Knowledge management
export * from './knowledge/index.js';

// Planning
export * from './planning/index.js';

// Execution
export * from './execution/index.js';

// Configuration
export * from './config/index.js';

// Pipeline orchestration
export * from './pipeline/index.js';

// MCP server (public entry point only)
export { createServer } from './mcp/server.js';

// Logging infrastructure
export * from './logging/index.js';

// Rate limiting
export * from './rate-limiting/index.js';

// Demo mode and setup wizard
export * from './demo/index.js';

// Diagnostics and self-healing (selective exports to avoid conflicts)
export {
  detectChromeLock,
  clearChromeLock,
  isChromeRunning,
  getLockMessage,
  type LockDetectionResult,
  type LockClearResult,
  createSelectorReport,
  formatSelectorReport,
  type SelectorDiagnostic,
  AutoFixer,
  type FixResult,
  type FixType,
  type AutoFixerOptions,
  runHealthCheck,
  formatHealthCheck,
  type HealthCheckResult,
  type HealthStatus,
  type HealthCheckOptions,
} from './diagnostics/index.js';

// Performance metrics
export * from './metrics/index.js';

// Session management
export * from './session/index.js';
