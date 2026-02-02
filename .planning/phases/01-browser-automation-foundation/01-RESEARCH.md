# Phase 1: Browser Automation Foundation - Research

**Researched:** 2026-02-02
**Domain:** Browser automation, Playwright, Chrome persistence, stealth, NotebookLM interaction
**Confidence:** HIGH

## Summary

Phase 1 establishes reliable, stealthy browser automation that connects to NotebookLM and maintains authentication across restarts. The standard approach uses Playwright's `launchPersistentContext` with a dedicated Chrome user data directory (not the user's real Chrome profile), `playwright-extra` with the stealth plugin for bot detection mitigation, and Playwright's built-in semantic locators (`getByRole`, `getByText`, `getByLabel`) for resilient element selection.

The reference implementation (`msw-notebooklm-extractor(1).js`) already demonstrates the core flow: persistent context launch, page navigation, topic pill discovery, click-and-wait extraction, and streaming completion detection via content-stability polling. This phase productionizes that pattern.

**Primary recommendation:** Use `playwright-extra` + `puppeteer-extra-plugin-stealth` with `launchPersistentContext` on a dedicated (not default) Chrome profile directory. Use semantic locators as primary selectors with `data-testid`-style fallbacks. Detect streaming completion via `waitForFunction` content-stability checks.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [playwright-extra](https://www.npmjs.com/package/playwright-extra) | latest | Browser automation with plugin support | Wraps Playwright, enables stealth plugin |
| [puppeteer-extra-plugin-stealth](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth) | latest | Bot detection evasion | Removes `navigator.webdriver`, patches headless fingerprints |
| [playwright](https://playwright.dev/) | 1.58+ | Core browser automation (peer dep) | Project decision: Playwright for browser automation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright (bundled Chromium) | 1.58+ | Browser binary | Always use bundled Chromium, not system Chrome |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| playwright-extra + stealth | Raw Playwright + manual patches | Stealth plugin handles 20+ evasion techniques; manual is fragile |
| Bundled Chromium | System Chrome | System Chrome blocks `--load-extension` and side-loading; bundled Chromium works |

**Installation:**
```bash
npm install playwright-extra puppeteer-extra-plugin-stealth playwright
npx playwright install chromium
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── browser/
│   ├── driver.ts          # BrowserDriver class - launch, connect, close
│   ├── stealth.ts         # Stealth configuration and plugin setup
│   ├── profile.ts         # Chrome profile directory management
│   ├── selectors.ts       # Semantic selector registry for NotebookLM
│   └── wait.ts            # Streaming completion and wait utilities
├── notebooklm/
│   ├── navigator.ts       # Navigate to notebook, verify connection
│   └── extractor.ts       # Response extraction and parsing
└── types/
    └── browser.ts         # Browser-related type definitions
```

### Pattern 1: Persistent Context with Dedicated Profile
**What:** Use `launchPersistentContext` with a project-owned `userDataDir`, never the user's real Chrome profile.
**When to use:** Always. This is the only way to persist cookies/auth across sessions.
**Key constraint:** Only ONE browser instance can use a given `userDataDir` at a time.
**Example:**
```typescript
// Source: https://playwright.dev/docs/api/class-browsertype
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const PROFILE_DIR = path.join(os.homedir(), '.msw', 'chrome-profile');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,  // NotebookLM requires visible browser
  channel: undefined, // Use bundled Chromium, NOT system Chrome
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  viewport: { width: 1280, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

const page = context.pages()[0] || await context.newPage();
```

### Pattern 2: Semantic Selector Registry
**What:** Define all NotebookLM UI selectors in a single registry using Playwright's semantic locators. Fall back to accessibility tree queries, then to CSS only as last resort.
**When to use:** Every UI interaction with NotebookLM.
**Example:**
```typescript
// Source: https://playwright.dev/docs/locators
// Selector registry - update when NotebookLM UI changes
const SELECTORS = {
  chatInput: (page) => page.getByRole('textbox', { name: /ask|type/i }),
  sendButton: (page) => page.getByRole('button', { name: /send|submit/i }),
  topicPills: (page) => page.getByRole('button').filter({ hasText: /.{4,80}/ }),
  responseMessages: (page) => page.locator('[data-message-author="assistant"]'),
  // Fallback CSS selectors (last resort)
  chatInputFallback: 'textarea[placeholder*="Ask"], textarea[placeholder*="Type"]',
};
```

### Pattern 3: Streaming Completion Detection
**What:** Wait for NotebookLM's streaming response to finish by polling content stability.
**When to use:** After every question/topic click, before extracting response.
**Example:**
```typescript
// Source: reference implementation + https://playwright.dev/docs/api/class-page#page-wait-for-function
async function waitForStreamingComplete(page: Page, selector: string, opts = { pollMs: 1000, stableCount: 3, timeoutMs: 60000 }) {
  await page.waitForFunction(
    ({ sel, stableNeeded }) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const current = el.textContent || '';
      if (!window.__mswLastContent) window.__mswLastContent = '';
      if (!window.__mswStableCount) window.__mswStableCount = 0;
      if (current === window.__mswLastContent && current.length > 0) {
        window.__mswStableCount++;
      } else {
        window.__mswStableCount = 0;
        window.__mswLastContent = current;
      }
      return window.__mswStableCount >= stableNeeded;
    },
    { sel: selector, stableNeeded: opts.stableCount },
    { polling: opts.pollMs, timeout: opts.timeoutMs }
  );
}
```

### Pattern 4: Humanized Interaction Delays
**What:** Add randomized delays between actions to mimic human behavior.
**When to use:** Before every click, type, and navigation action.
**Example:**
```typescript
function randomDelay(minMs = 100, maxMs = 400): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function humanType(page: Page, selector: string, text: string) {
  const el = page.locator(selector);
  for (const char of text) {
    await el.pressSequentially(char, { delay: 50 + Math.random() * 150 });
  }
}
```

### Anti-Patterns to Avoid
- **Using system Chrome profile:** Playwright cannot reliably automate the default Chrome user data directory. Always create a dedicated profile directory.
- **Hardcoded CSS class selectors:** NotebookLM uses minified/hashed class names that change on every deploy. Use semantic/role locators.
- **`page.waitForTimeout()` for streaming:** Hard timeouts are flaky. Use content-stability polling instead.
- **Headless mode with NotebookLM:** Google services detect headless browsers aggressively. Run headful (visible browser).
- **Multiple instances with same profile:** Only one browser can use a `userDataDir` at a time. Implement a lock file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bot detection evasion | Custom `navigator.webdriver` patches | `puppeteer-extra-plugin-stealth` | 20+ evasion techniques maintained by community |
| Browser fingerprint spoofing | Manual UA/WebGL/Canvas patches | `playwright-extra` stealth plugin | Cat-and-mouse game; let specialists maintain it |
| Chrome profile management | Custom cookie export/import | `launchPersistentContext` with `userDataDir` | Playwright handles all persistent storage natively |
| Element waiting | Custom `setInterval` polling | `page.waitForFunction()` / `page.waitForSelector()` | Built-in auto-retry, timeout handling, better error messages |

**Key insight:** Browser automation stealth is an arms race. The stealth plugin community tracks and patches detection vectors continuously. Hand-rolling evasions means falling behind immediately.

## Common Pitfalls

### Pitfall 1: Chrome Profile Directory Conflicts
**What goes wrong:** Pointing `userDataDir` at Chrome's real "User Data" directory causes pages not to load or the browser to crash.
**Why it happens:** Recent Chrome policy changes prevent automation of the default profile. Also, if Chrome is already open with that profile, Playwright cannot acquire the lock.
**How to avoid:** Always create a dedicated, MSW-owned directory (e.g., `~/.msw/chrome-profile/`). Never share it with the user's Chrome.
**Warning signs:** "Failed to launch browser" or blank pages on launch.

### Pitfall 2: Stealth + Persistent Context Interaction
**What goes wrong:** `playwright-stealth` v2.0.1 has a known issue with User-Agent sniffing when using `launchPersistentContext`.
**Why it happens:** Stealth tries to detect and override the UA, but persistent context launches differently than regular launches.
**How to avoid:** Explicitly set `userAgent` in the context options rather than relying on stealth to patch it. Apply stealth BEFORE launching the persistent context.
**Warning signs:** Bot detection triggering despite stealth being enabled.

### Pitfall 3: NotebookLM CSS Class Instability
**What goes wrong:** Selectors like `[class*="response"]` or `[class*="suggestion"]` break when Google deploys updates.
**Why it happens:** NotebookLM uses minified/hashed CSS classes (e.g., `c-wiz`, `VfPpkd-*`) that change across deploys.
**How to avoid:** Use Playwright's semantic locators (`getByRole`, `getByText`) as primary. Maintain a selector registry that can be updated in one place. Add a health-check that validates selectors on connection.
**Warning signs:** `TimeoutError` on previously working selectors.

### Pitfall 4: Google Account Bot Detection
**What goes wrong:** Google flags the automation account and requires CAPTCHA/phone verification.
**Why it happens:** Google detects automated behavior patterns (fast navigation, consistent timing, headless fingerprints).
**How to avoid:** Use a dedicated Google account for automation (not a personal account). Run headful. Add humanized delays. Use stealth plugin. Consider warming up the account with manual usage first.
**Warning signs:** "Unusual activity" warnings, CAPTCHA challenges, account suspension.

### Pitfall 5: Premature Response Extraction
**What goes wrong:** Extracting text before NotebookLM finishes streaming yields partial/truncated content.
**Why it happens:** NotebookLM streams responses token-by-token; the DOM updates continuously for 5-30 seconds.
**How to avoid:** Use content-stability polling (check content 3 times at 1-second intervals; if unchanged, streaming is done).
**Warning signs:** Responses cut off mid-sentence, missing citations.

## Code Examples

### Complete Browser Initialization
```typescript
// Source: playwright-extra npm docs + Playwright official docs
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import os from 'os';
import fs from 'fs';

const PROFILE_DIR = path.join(os.homedir(), '.msw', 'chrome-profile');

export async function launchBrowser() {
  // Ensure profile directory exists
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  // Apply stealth BEFORE launching
  chromium.use(StealthPlugin());

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = context.pages()[0] || await context.newPage();
  return { context, page };
}
```

### Navigate to NotebookLM Notebook
```typescript
export async function connectToNotebook(page: Page, notebookUrl: string) {
  await page.goto(notebookUrl, { waitUntil: 'domcontentloaded' });

  // Check if we need to authenticate
  const isLoginPage = await page.getByRole('button', { name: /sign in/i }).isVisible({ timeout: 3000 }).catch(() => false);

  if (isLoginPage) {
    throw new Error('NotebookLM requires authentication. Please log in manually once, then restart.');
  }

  // Wait for chat interface to be ready
  const chatInput = page.getByRole('textbox', { name: /ask|type/i });
  await chatInput.waitFor({ state: 'visible', timeout: 30000 });

  return true;
}
```

### Selector Health Check
```typescript
export async function validateSelectors(page: Page): Promise<{ valid: boolean; failures: string[] }> {
  const failures: string[] = [];

  const checks = [
    { name: 'chatInput', locator: page.getByRole('textbox', { name: /ask|type/i }) },
    { name: 'sendButton', locator: page.getByRole('button', { name: /send|submit/i }) },
  ];

  for (const check of checks) {
    const visible = await check.locator.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) failures.push(check.name);
  }

  return { valid: failures.length === 0, failures };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `puppeteer` with stealth | `playwright-extra` with stealth plugin | 2024+ | Playwright is now dominant; stealth plugin ported |
| CSS class selectors | Semantic locators (`getByRole`, `getByText`) | Playwright 1.27+ | Far more resilient to UI changes |
| `page.waitForTimeout()` | `page.waitForFunction()` content polling | Best practice since Playwright 1.0 | Eliminates flaky hard-coded waits |
| System Chrome automation | Bundled Chromium + dedicated profile | Chrome policy change 2024 | System Chrome blocks automation flags |

**Deprecated/outdated:**
- `puppeteer-extra` alone (without Playwright): Puppeteer still works but Playwright has better multi-browser and auto-waiting support
- `page.waitForNavigation()`: Replaced by `page.waitForURL()` in modern Playwright
- `elementHandle.click()`: Use `locator.click()` for auto-waiting

## Open Questions

1. **NotebookLM Selector Stability**
   - What we know: NotebookLM uses React with minified classes that change on deploys
   - What's unclear: Exact accessibility roles/labels for chat input, topic pills, and response containers - these need live inspection
   - Recommendation: Build a selector health-check that runs on connection and reports failures. First manual session should map all accessible roles using Playwright Inspector (`npx playwright codegen`)

2. **Google Bot Detection Aggressiveness for NotebookLM**
   - What we know: Google has sophisticated bot detection across its services
   - What's unclear: How aggressively NotebookLM specifically detects automation vs. general Google Workspace detection
   - Recommendation: Start with stealth + dedicated account + humanized delays. Monitor for detection. The dedicated automation account strategy (BROW-04) is the key mitigation.

3. **playwright-extra + launchPersistentContext UA Issue**
   - What we know: playwright-stealth v2.0.1 (Jan 2026) has a known issue sniffing UA with persistent contexts
   - What's unclear: Whether this is fully resolved or requires workaround
   - Recommendation: Explicitly set `userAgent` in context options as documented above. Test stealth effectiveness using `https://bot.sannysoft.com/` or `https://abrahamjuliot.github.io/creepjs/`

## Sources

### Primary (HIGH confidence)
- [Playwright BrowserType docs](https://playwright.dev/docs/api/class-browsertype) - `launchPersistentContext` API
- [Playwright Locators docs](https://playwright.dev/docs/locators) - Semantic selector best practices
- [Playwright Network docs](https://playwright.dev/docs/network) - Response waiting patterns
- [playwright-extra npm](https://www.npmjs.com/package/playwright-extra) - Plugin framework usage
- Reference implementation: `msw-notebooklm-extractor(1).js` in project root

### Secondary (MEDIUM confidence)
- [BrowserStack Playwright selectors best practices 2026](https://www.browserstack.com/guide/playwright-selectors-best-practices) - Locator hierarchy
- [ZenRows Playwright Extra tutorial 2026](https://www.zenrows.com/blog/playwright-extra) - Stealth plugin patterns
- [BrowserStack bot detection guide](https://www.browserstack.com/guide/playwright-bot-detection) - Detection vectors and mitigations
- [ScrapeOps Playwright undetectable guide](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/) - Evasion techniques

### Tertiary (LOW confidence)
- [playwright-stealth v2.0.1 PyPI](https://pypi.org/project/playwright-stealth/) - Python version; UA sniffing issue may differ in Node.js stealth plugin

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright + stealth is well-documented, project already decided on this
- Architecture: HIGH - Patterns from reference implementation + official Playwright docs
- Pitfalls: HIGH - Well-documented in community; profile conflicts, stealth+persistent issues verified across multiple sources
- Selectors: MEDIUM - Semantic locator approach is solid, but exact NotebookLM accessibility labels need live inspection

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stack is stable, NotebookLM UI may change)
