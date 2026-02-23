/**
 * NotebookNavigator -- connects to a NotebookLM notebook URL and verifies
 * the UI is ready for interaction.
 */

import type { Locator, Page } from 'playwright';
import type { NotebookConnection } from '../types/browser.js';
import { createLogger } from '../logging/index.js';
import { QuotaTracker } from '../rate-limiting/index.js';
import { getMetricsCollector } from '../metrics/index.js';

const logger = createLogger('notebook-navigator');
const quotaTracker = new QuotaTracker();
const metrics = getMetricsCollector();

export class NotebookNavigator {
  private page: Page;
  private static readonly READY_TIMEOUT_MS = 30000;

  constructor(page: Page) {
    this.page = page;
  }

  private isAuthUrl(url: string): boolean {
    const l = (url || '').toLowerCase();
    return (
      l.includes('accounts.google.com') ||
      l.includes('servicelogin') ||
      l.includes('/signin') ||
      l.includes('/challenge') ||
      l.includes('/auth')
    );
  }

  private getInputCandidates(): Locator[] {
    return [
      this.page.getByRole('textbox', { name: /ask|type|message|chat/i }).first(),
      this.page.locator('textarea[aria-label*="ask" i]').first(),
      this.page.locator('textarea[placeholder*="ask" i]').first(),
      this.page.locator('textarea[placeholder*="message" i]').first(),
      this.page.locator('textarea').first(),
      this.page.locator('[contenteditable="true"][role="textbox"]').first(),
      this.page.locator('[contenteditable="true"][aria-label*="ask" i]').first(),
      this.page.locator('[contenteditable="true"]').first(),
    ];
  }

  private getSendButtonCandidates(): Locator[] {
    return [
      this.page.getByRole('button', { name: /send|submit|ask/i }).first(),
      this.page.locator('button[aria-label*="send" i]').first(),
      this.page.locator('button:has-text("Send")').first(),
    ];
  }

  private async findVisible(candidates: Locator[], timeout = 1000): Promise<Locator | null> {
    for (const locator of candidates) {
      const visible = await locator.isVisible({ timeout }).catch(() => false);
      if (visible) {
        return locator;
      }
    }
    return null;
  }

  private async waitForReady(): Promise<Locator> {
    const deadline = Date.now() + NotebookNavigator.READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const url = this.page.url();
      if (this.isAuthUrl(url)) {
        throw new Error(
          'NotebookLM requires authentication. Please run MSW once with a visible browser to log in manually, then restart.',
        );
      }

      const explicitSignIn = await this.page
        .getByRole('button', { name: /sign in/i })
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (explicitSignIn) {
        throw new Error(
          'NotebookLM requires authentication. Please run MSW once with a visible browser to log in manually, then restart.',
        );
      }

      const input = await this.findVisible(this.getInputCandidates(), 750);
      if (input) {
        return input;
      }

      await this.page.waitForTimeout(750);
    }

    throw new Error('NotebookLM chat input not found within timeout');
  }

  /**
   * Navigate to a NotebookLM notebook URL, detect authentication status,
   * and wait for the chat interface to become ready.
   */
  async connect(notebookUrl: string): Promise<NotebookConnection> {
    logger.info({ notebookUrl }, 'Navigating to notebook');
    await this.page.goto(notebookUrl, { waitUntil: 'domcontentloaded' });

    // Wait for chat input to appear, indicating readiness
    logger.debug('Waiting for chat input to become ready');
    await this.waitForReady();

    logger.info('Successfully connected to notebook');
    return { connected: true, url: notebookUrl };
  }

  /**
   * Check whether the chat input textbox is currently visible.
   */
  async isReady(): Promise<boolean> {
    const input = await this.findVisible(this.getInputCandidates(), 500);
    return Boolean(input);
  }

  /**
   * Best-effort extraction of the notebook title from the page.
   */
  async getNotebookTitle(): Promise<string> {
    try {
      const title = await this.page.title();
      // NotebookLM titles typically follow "Title - NotebookLM"
      const match = title.match(/^(.+?)\s*[-–]\s*NotebookLM/);
      return match ? match[1].trim() : title || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Submit a query to NotebookLM with rate limiting enforcement and performance tracking.
   * Throws an error if quota is exceeded.
   */
  async submitQuery(query: string): Promise<void> {
    return metrics.measureAsync('notebooklm.query', async () => {
      // Check quota before submitting
      const quotaCheck = quotaTracker.canRequest();
      if (!quotaCheck.allowed) {
        logger.error({
          remaining: quotaCheck.usage.remaining,
          limit: quotaCheck.usage.limit
        }, 'Query quota exceeded');
        throw new Error(
          `Daily query quota exceeded (${quotaCheck.usage.used}/${quotaCheck.usage.limit}). ` +
          `Quota resets at midnight UTC. Current usage: ${quotaCheck.usage.percentUsed}%`,
        );
      }

      // Log warning if approaching quota
      if (quotaCheck.warning) {
        logger.warn({ remaining: quotaCheck.usage.remaining }, quotaCheck.warning);
      }

      logger.info({ query: query.substring(0, 100) }, 'Submitting query to NotebookLM');

      // Submit the query using the first visible input strategy.
      const inputBox = await this.findVisible(this.getInputCandidates(), 1000);
      if (!inputBox) {
        throw new Error('Notebook input unavailable');
      }

      try {
        await inputBox.fill(query);
      } catch {
        await inputBox.click();
        await this.page.keyboard.type(query);
      }

      const sendButton = await this.findVisible(this.getSendButtonCandidates(), 500);
      if (sendButton) {
        await sendButton.click();
      } else {
        await inputBox.press('Enter');
      }

      // Record successful query
      quotaTracker.recordRequest();
      logger.debug({ remaining: quotaCheck.usage.remaining - 1 }, 'Query submitted successfully');
    });
  }
}
