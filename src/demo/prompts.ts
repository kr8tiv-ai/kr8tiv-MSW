import type { QuestionCollection } from "inquirer";

/**
 * Validate NotebookLM URL format.
 * Expected: https://notebooklm.google.com/notebook/[id]
 */
export function validateNotebookUrl(input: string): true | string {
  const trimmed = input.trim();

  if (!trimmed) {
    return "URL is required";
  }

  // Accept both with and without /notebook/ path
  const urlPattern = /^https:\/\/notebooklm\.google\.com\/(notebook\/)?[a-zA-Z0-9_-]+$/;

  if (!urlPattern.test(trimmed)) {
    return "Invalid NotebookLM URL. Format: https://notebooklm.google.com/notebook/[id]";
  }

  return true;
}

export interface SetupAnswers {
  useDemo: boolean;
  notebookUrl: string;
  logLevel: "error" | "warn" | "info" | "debug";
  headless: boolean;
  quotaLimit: number;
}

/**
 * Inquirer prompts for setup wizard (HARD-12).
 */
export const setupPrompts: QuestionCollection<SetupAnswers> = [
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
    validate: validateNotebookUrl,
    filter: (input: string) => input.trim(),
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
    default: false, // Default to visible for first-time users
  },
  {
    type: "number",
    name: "quotaLimit",
    message: "Daily NotebookLM query limit (50 free, 500 enterprise):",
    default: 50,
    validate: (input: number) => {
      if (input < 1 || input > 1000) {
        return "Limit must be between 1 and 1000";
      }
      return true;
    },
  },
];
