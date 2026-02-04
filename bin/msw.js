#!/usr/bin/env node
import { isFirstRun, runSetupWizard } from '../dist/demo/index.js';

async function main() {
  if (isFirstRun()) {
    console.log('🚀 Welcome to MSW! Running first-time setup...\n');
    await runSetupWizard();
  } else {
    console.log('✅ MSW is already configured. Run "npx msw config" to reconfigure.');
  }
}

main().catch(console.error);
