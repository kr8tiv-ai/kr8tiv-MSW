/**
 * Humanized interaction utilities for browser automation.
 *
 * Adds randomized delays and realistic typing/clicking behaviour to prevent
 * bot detection when automating Google services.
 */

import type { Locator, Page } from 'playwright';

/**
 * Wait a random amount of time between minMs and maxMs.
 */
export async function randomDelay(minMs = 100, maxMs = 400): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Type text character-by-character with randomised per-key delay.
 *
 * Uses Playwright's `pressSequentially` under the hood. Adds a short pause
 * after the full string is typed.
 */
export async function humanType(
  locator: Locator,
  text: string,
  opts?: { minDelay?: number; maxDelay?: number },
): Promise<void> {
  const minDelay = opts?.minDelay ?? 50;
  const maxDelay = opts?.maxDelay ?? 200;
  const perCharDelay = Math.floor((minDelay + maxDelay) / 2);

  await locator.pressSequentially(text, { delay: perCharDelay });

  // Small pause after typing completes (200-500ms)
  await randomDelay(200, 500);
}

/**
 * Click a locator with optional pre- and post-click delays.
 */
export async function humanClick(
  locator: Locator,
  opts?: { preDelay?: boolean },
): Promise<void> {
  const preDelay = opts?.preDelay ?? true;

  if (preDelay) {
    await randomDelay();
  }

  await locator.click();
  await randomDelay();
}

/**
 * Scroll the page in a given direction with randomised distance.
 */
export async function humanScroll(
  page: Page,
  direction: 'up' | 'down',
  amount?: number,
): Promise<void> {
  const distance = amount ?? Math.floor(Math.random() * 201) + 100; // 100-300px
  const delta = direction === 'down' ? distance : -distance;

  await page.mouse.wheel(0, delta);
  await randomDelay(150, 350);
}
