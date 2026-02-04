// Log level configuration (HARD-08)
export const LOG_LEVELS = {
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

export function getLogLevel(): LogLevel {
  const envLevel = process.env.MSW_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return "info"; // Default
}
