// vitest globals enabled - no import needed
import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import { NotebookNavigator } from "../../../src/notebooklm/navigator.js";
import { startMockNotebookLM, type MockNotebookLMServer } from "../../helpers/mock-notebooklm.js";

const describeWithBrowser = fs.existsSync(chromium.executablePath()) ? describe : describe.skip;

describeWithBrowser("NotebookNavigator", () => {
  let browser: Browser;
  let page: Page;
  let mockServer: MockNotebookLMServer;

  beforeAll(async () => {
    mockServer = await startMockNotebookLM();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 15000);

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await mockServer?.close();
  });

  it("connects to the standard notebook mock UI", async () => {
    const navigator = new NotebookNavigator(page);
    const result = await navigator.connect(mockServer.url);

    expect(result.connected).toBe(true);
    expect(result.url).toContain("/notebook/");
  });

  it("connects when chat input uses placeholder fallback selectors", async () => {
    const html = `
      <html>
        <body>
          <h1>NotebookLM</h1>
          <textarea placeholder="Message NotebookLM"></textarea>
          <button aria-label="Send message">Send</button>
        </body>
      </html>
    `;
    const dataUrl = `data:text/html,${encodeURIComponent(html)}`;

    const navigator = new NotebookNavigator(page);
    const result = await navigator.connect(dataUrl);

    expect(result.connected).toBe(true);
  });
});
