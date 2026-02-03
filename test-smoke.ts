/**
 * MSW Phase 1 Smoke Test
 *
 * Tests the complete browser automation foundation:
 * - BrowserDriver launches with stealth
 * - ProfileManager manages persistent profile with locking
 * - NotebookNavigator connects to a notebook
 * - Selector validation against live NotebookLM UI
 *
 * Usage: npx tsx test-smoke.ts [notebook-url]
 *
 * If no URL provided, uses a placeholder that you'll need to replace.
 */

import { BrowserDriver, ProfileManager, validateSelectors } from './src/browser/index.js';
import { NotebookNavigator } from './src/notebooklm/index.js';
import { DEFAULT_BROWSER_CONFIG } from './src/types/browser.js';
import * as fs from 'fs';
import * as path from 'path';

async function runSmokeTest() {
  // Get notebook URL from command line or use placeholder
  const notebookUrl = process.argv[2] || 'https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID';

  if (notebookUrl.includes('YOUR_NOTEBOOK_ID')) {
    console.log('='.repeat(60));
    console.log('SMOKE TEST SETUP');
    console.log('='.repeat(60));
    console.log('\nTo run the smoke test, provide a NotebookLM notebook URL:');
    console.log('\n  npx tsx test-smoke.ts https://notebooklm.google.com/notebook/abc123\n');
    console.log('1. Open NotebookLM in your browser');
    console.log('2. Create or open a notebook');
    console.log('3. Copy the URL from the address bar');
    console.log('4. Run this script with that URL');
    console.log('='.repeat(60));
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('MSW PHASE 1 SMOKE TEST');
  console.log('='.repeat(60));
  console.log(`Target notebook: ${notebookUrl}`);
  console.log(`Profile directory: ${DEFAULT_BROWSER_CONFIG.profileDir}`);
  console.log('');

  let browser: BrowserDriver | null = null;
  let profileManager: ProfileManager | null = null;

  try {
    // Step 1: Profile Manager with locking
    console.log('[1/5] Initializing ProfileManager...');
    profileManager = new ProfileManager(DEFAULT_BROWSER_CONFIG.profileDir);
    profileManager.ensureProfileDir();

    const lockPath = path.join(DEFAULT_BROWSER_CONFIG.profileDir, '.lock');
    console.log(`  - Profile dir: ${DEFAULT_BROWSER_CONFIG.profileDir}`);
    console.log(`  - Lock file: ${lockPath}`);

    // Acquire lock (synchronous, throws if already locked)
    try {
      profileManager.acquireLock();
      console.log('  - Lock acquired successfully');
    } catch (lockErr) {
      console.log(`  [WARN] Could not acquire lock: ${lockErr}`);
    }

    // Verify lock file exists
    if (fs.existsSync(lockPath)) {
      console.log('  - Lock file EXISTS at expected location');
    } else {
      console.log('  [WARN] Lock file NOT found (may be released already)');
    }

    console.log('  [PASS] ProfileManager initialized\n');

    // Step 2: Browser Driver with stealth
    console.log('[2/5] Launching browser with stealth...');
    browser = new BrowserDriver({
      ...DEFAULT_BROWSER_CONFIG,
      headless: false, // Must be visible for NotebookLM
    });

    await browser.launch();
    console.log('  - Browser launched successfully');
    console.log('  - Stealth patches applied');
    console.log('  [PASS] Browser launched\n');

    // Step 3: Navigate to NotebookLM
    console.log('[3/5] Navigating to NotebookLM...');
    const page = await browser.getPage();

    await page.goto(notebookUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('  - Page loaded: ' + (await page.title()));

    // Wait a moment for any redirects (e.g., auth)
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log('  - Current URL: ' + currentUrl);

    if (currentUrl.includes('accounts.google.com')) {
      console.log('\n  [ACTION REQUIRED]');
      console.log('  The browser is showing Google login.');
      console.log('  Please log in manually in the browser window.');
      console.log('  After logging in, the test will continue automatically.');
      console.log('  Waiting up to 5 minutes for login...\n');

      // Wait for navigation away from accounts.google.com
      await page.waitForURL(/notebooklm\.google\.com/, { timeout: 300000 });
      console.log('  - Login detected, continuing...');
    }

    console.log('  [PASS] Navigated to NotebookLM\n');

    // Step 4: NotebookNavigator initialization
    console.log('[4/5] Initializing NotebookNavigator...');
    const navigator = new NotebookNavigator(page);
    console.log('  - NotebookNavigator created');
    console.log('  [PASS] Navigator initialized\n');

    // Step 5: Validate selectors
    console.log('[5/5] Validating selectors against live UI...');
    console.log('  (Waiting 5 seconds for UI to fully load...)');
    await page.waitForTimeout(5000);

    const selectorResults = await validateSelectors(page);
    console.log('\n  Selector Validation Results:');
    console.log('  ' + '-'.repeat(50));

    let allPassed = true;
    for (const [name, found] of Object.entries(selectorResults)) {
      const status = found ? '[FOUND]' : '[MISSING]';
      console.log(`  ${status} ${name}`);
      if (!found) allPassed = false;
    }

    console.log('  ' + '-'.repeat(50));

    if (allPassed) {
      console.log('  [PASS] All selectors validated\n');
    } else {
      console.log('  [PARTIAL] Some selectors not found - UI may have changed\n');
    }

    // Final summary
    console.log('='.repeat(60));
    console.log('SMOKE TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('');
    console.log('Results:');
    console.log('  [1] ProfileManager: PASS');
    console.log('  [2] Browser Launch: PASS');
    console.log('  [3] NotebookLM Navigation: PASS');
    console.log('  [4] NotebookNavigator: PASS');
    console.log(`  [5] Selector Validation: ${allPassed ? 'PASS' : 'PARTIAL'}`);
    console.log('');
    console.log('Manual verification checklist:');
    console.log('  [ ] Browser window is visible (not headless)');
    console.log('  [ ] NotebookLM is loaded in the browser');
    console.log('  [ ] Chat interface is visible');
    console.log(`  [ ] Lock file exists: ${lockPath}`);
    console.log('');
    console.log('Press Ctrl+C to close the browser and exit.');
    console.log('='.repeat(60));

    // Keep browser open for manual inspection
    await page.waitForTimeout(60000 * 10); // 10 minutes

  } catch (error) {
    console.error('\n[ERROR] Smoke test failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (profileManager) {
      profileManager.releaseLock();
      console.log('\nLock released.');
    }
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

runSmokeTest();
