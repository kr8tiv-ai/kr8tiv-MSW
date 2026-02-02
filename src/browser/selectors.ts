/**
 * Semantic selector registry for NotebookLM UI elements.
 *
 * All selectors use Playwright semantic locators (getByRole, getByText) as
 * primary strategies to survive UI deploys that change CSS class names.
 *
 * NOTE: These selectors are best guesses based on research. The actual
 * NotebookLM accessibility labels need live inspection and may require
 * adjustment after the first manual test run.
 */

import type { Locator, Page } from 'playwright';

/**
 * Registry of factory functions that take a Playwright Page and return a Locator.
 * Single source of truth for all NotebookLM UI element lookups.
 */
export const Selectors = {
  chatInput: (page: Page): Locator =>
    page.getByRole('textbox', { name: /ask|type/i }),

  sendButton: (page: Page): Locator =>
    page.getByRole('button', { name: /send|submit/i }),

  topicPills: (page: Page): Locator =>
    page.getByRole('button').filter({ hasText: /.{4,80}/ }),

  responseContainer: (page: Page): Locator =>
    page.locator('[data-message-author="assistant"]'),

  signInButton: (page: Page): Locator =>
    page.getByRole('button', { name: /sign in/i }),
} as const;

export type SelectorName = keyof typeof Selectors;

/**
 * Helper to retrieve a locator by name from the registry.
 */
export function getSelector(name: SelectorName, page: Page): Locator {
  return Selectors[name](page);
}

/** Selectors that must be visible for the page to be considered ready. */
const CRITICAL_SELECTORS: SelectorName[] = ['chatInput', 'sendButton'];

/** Selectors that are logged as warnings but do not fail validation. */
const NON_CRITICAL_SELECTORS: SelectorName[] = ['topicPills', 'responseContainer'];

/**
 * Validate that critical selectors are visible on the current page.
 *
 * Critical selectors (chatInput, sendButton) must be visible within 5 seconds
 * or they are reported as failures. Non-critical selectors are checked but
 * only logged as warnings.
 */
export async function validateSelectors(
  page: Page,
): Promise<{ valid: boolean; failures: string[] }> {
  const failures: string[] = [];
  const TIMEOUT = 5_000;

  for (const name of CRITICAL_SELECTORS) {
    try {
      await Selectors[name](page).waitFor({ state: 'visible', timeout: TIMEOUT });
    } catch {
      failures.push(name);
    }
  }

  for (const name of NON_CRITICAL_SELECTORS) {
    try {
      await Selectors[name](page).waitFor({ state: 'visible', timeout: TIMEOUT });
    } catch {
      // Non-critical: log warning but don't add to failures
      console.warn(`[selectors] Non-critical selector "${name}" not visible`);
    }
  }

  return { valid: failures.length === 0, failures };
}
