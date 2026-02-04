import pino from "pino";
import { getLogLevel } from "./levels.js";
import { createTransport } from "./transports.js";

// Create the base logger instance
export const logger = pino(
  {
    level: getLogLevel(),
    // Structured logging base fields
    base: {
      service: "msw-protocol",
      version: process.env.npm_package_version || "0.0.0",
    },
    // ISO timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive fields (security best practice)
    redact: {
      paths: [
        "password",
        "token",
        "cookie",
        "secret",
        "authorization",
        "*.password",
        "*.token",
        "*.cookie",
        "*.secret",
        "headers.authorization",
        "headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  },
  createTransport()
);

/**
 * Create a child logger for a specific component.
 * Adds `component` field to all log entries.
 *
 * @example
 * const log = createLogger("browser-driver");
 * log.info({ url }, "Navigating to page");
 */
export function createLogger(component: string) {
  return logger.child({ component });
}
