import { existsSync } from "node:fs";
import { join } from "node:path";

// Barrel export for demo module
export { runSetupWizard, type SetupConfig } from "./wizard.js";
export { setupPrompts, validateNotebookUrl, type SetupAnswers } from "./prompts.js";
export {
  SAMPLE_NOTEBOOK_URL,
  getSampleNotebookConfig,
  isDemoMode,
  type DemoConfig,
} from "./sample-notebook.js";

/**
 * Check if this is the first run (no config exists).
 */
export function isFirstRun(basePath: string = process.cwd()): boolean {
  const configPath = join(basePath, ".msw/config.yaml");
  return !existsSync(configPath);
}

/**
 * Check if MSW is configured and ready.
 */
export function isConfigured(basePath: string = process.cwd()): boolean {
  return !isFirstRun(basePath);
}
