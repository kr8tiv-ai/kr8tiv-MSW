/**
 * Sample notebook URL for demo mode (HARD-11).
 * This is a public, read-only notebook for testing MSW functionality.
 */
export const SAMPLE_NOTEBOOK_URL = "https://notebooklm.google.com/notebook/msw-demo-sample";

/**
 * Demo mode configuration.
 */
export interface DemoConfig {
  notebookUrl: string;
  isDemo: true;
  readOnly: true;
  features: string[];
}

/**
 * Get sample notebook configuration for demo mode.
 */
export function getSampleNotebookConfig(): DemoConfig {
  return {
    notebookUrl: SAMPLE_NOTEBOOK_URL,
    isDemo: true,
    readOnly: true,
    features: [
      "Topic detection and extraction",
      "Response parsing and formatting",
      "Rate limiting dashboard",
      "Structured logging",
    ],
  };
}

/**
 * Check if running in demo mode based on config.
 */
export function isDemoMode(notebookUrl: string): boolean {
  return notebookUrl === SAMPLE_NOTEBOOK_URL;
}
