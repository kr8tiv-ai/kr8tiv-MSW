/**
 * Detects suggested topic pills from NotebookLM's UI.
 *
 * Finds follow-up suggestion buttons, filters out non-topic UI buttons,
 * and normalises text for deduplication.
 */

import type { Page } from 'playwright';
import { randomDelay } from '../browser/humanize.js';
/** Buttons whose text starts with these words are not topic suggestions. */
const EXCLUDE_PATTERN =
  /^(send|copy|share|like|dislike|submit|close|cancel|thumbs|menu|more|delete|edit|pin|save|download|upload|retry|regenerate|stop)/i;

/**
 * Normalise a topic string for deduplication.
 *
 * - Trims whitespace
 * - Lowercases
 * - Strips trailing punctuation
 * - Collapses multiple spaces
 */
export function normalizeTopic(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Finds suggested topic pills on a NotebookLM page.
 */
export class TopicDetector {
  constructor(private readonly page: Page) {}

  /**
   * Detect all visible topic pill texts on the current page.
   *
   * Finds buttons with text length 10-120 characters, then filters out
   * known non-topic buttons (send, copy, share, etc.).
   */
  async detectPills(): Promise<string[]> {
    await randomDelay(300, 700);

    const buttons = this.page.getByRole('button');
    const count = await buttons.count();
    const pills: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = (await buttons.nth(i).innerText()).trim();
      if (text.length < 10 || text.length > 120) continue;
      if (EXCLUDE_PATTERN.test(text)) continue;
      pills.push(text);
    }

    return pills;
  }

  /**
   * Detect only pills not already in the visited set.
   */
  async detectNewPills(visited: Set<string>): Promise<string[]> {
    const pills = await this.detectPills();
    return pills.filter((pill) => !visited.has(normalizeTopic(pill)));
  }
}
