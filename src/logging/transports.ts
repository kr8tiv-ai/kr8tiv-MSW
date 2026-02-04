import pino from "pino";
import { join } from "node:path";
import { getLogLevel } from "./levels.js";

// CRITICAL: MCP servers must NOT write to stdout (fd 1)
// stdout is reserved for JSON-RPC communication
// Use stderr (fd 2) and files ONLY

export function createTransport() {
  const level = getLogLevel();
  const logDir = join(process.cwd(), ".msw/logs");

  return pino.transport({
    targets: [
      // File transport with rotation (HARD-07)
      {
        target: "pino-roll",
        level,
        options: {
          file: join(logDir, "msw"),
          frequency: "daily", // Rotate daily
          size: "10m", // Or when file reaches 10MB
          limit: { count: 7 }, // Keep 7 rotated files + current
          dateFormat: "yyyy-MM-dd",
          mkdir: true, // Create directory if missing
          extension: ".log",
        },
      },
      // Stderr for development visibility (MCP-safe)
      {
        target: "pino/file",
        level,
        options: { destination: 2 }, // fd 2 = stderr
      },
    ],
  });
}
