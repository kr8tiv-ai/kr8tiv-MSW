/**
 * Query injection into NotebookLM chat interface.
 *
 * Types a question into the chat input, submits it, waits for the streamed
 * response to stabilize, then extracts the answer as a QAPair.
 */

import type { Page } from 'playwright';
import { Selectors } from '../browser/selectors.js';
import { humanType, humanClick } from '../browser/humanize.js';
import { waitForStreamingComplete } from '../browser/wait.js';
import { ResponseExtractor } from '../notebooklm/extractor.js';
import type { QAPair } from '../types/bidirectional.js';

export class QueryInjector {
  private page: Page;
  private extractor: ResponseExtractor;

  constructor(page: Page) {
    this.page = page;
    this.extractor = new ResponseExtractor(page);
  }

  /**
   * Inject a query into the NotebookLM chat and return the response.
   *
   * 1. Clicks and clears the chat input
   * 2. Types the query with humanized delays
   * 3. Clicks the send button
   * 4. Waits for streaming to complete
   * 5. Extracts the latest response
   *
   * @throws Error if chat input or send button is not found
   */
  async inject(query: string): Promise<QAPair> {
    const chatInput = Selectors.chatInput(this.page);
    const sendButton = Selectors.sendButton(this.page);

    // Ensure chat input is visible
    try {
      await chatInput.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      throw new Error(
        'QueryInjector: chat input not found or not visible within 10s',
      );
    }

    // Clear existing text and type the query
    await chatInput.fill('');
    await humanType(chatInput, query);

    // Submit the query
    try {
      await sendButton.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      throw new Error(
        'QueryInjector: send button not found or not visible within 5s',
      );
    }
    await humanClick(sendButton);

    // Wait for the streamed response to stabilize
    try {
      await waitForStreamingComplete(
        this.page,
        '[data-message-author="assistant"]:last-of-type',
      );
    } catch {
      console.warn(
        '[query-injector] Streaming detection timed out, extracting available content',
      );
    }

    // Extract the response
    const answer = await this.extractor.extractLatestResponse();

    return {
      question: query,
      answer,
      timestamp: new Date(),
      source: 'manual',
    };
  }
}
