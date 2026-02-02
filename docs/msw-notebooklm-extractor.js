# MSW Protocol: NotebookLM Topic Extraction Workflow

## Overview

After connecting to NotebookLM and adding sources, the system should:

1. **Navigate to the notebook chat**
2. **Identify suggested topics** (the clickable topic pills NotebookLM generates)
3. **Click each topic** to expand and get detailed information
4. **Compile all expanded content** into a structured markdown report
5. **Commit the report** as a `.md` file to the repo
6. **Continue the MSW process** with this grounded research

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NOTEBOOKLM TOPIC EXTRACTION                          │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │ 1. ADD SOURCES   │  Upload docs, URLs, files to notebook
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 2. WAIT FOR      │  NotebookLM processes sources and generates
    │    PROCESSING    │  suggested topics (usually 30-60 seconds)
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 3. SCRAPE TOPIC  │  Find all topic pills/buttons in the UI
    │    SUGGESTIONS   │  (e.g., "Key Concepts", "Implementation", etc.)
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 4. CLICK EACH    │  For each topic:
    │    TOPIC         │  - Click the topic pill
    │                  │  - Wait for response
    │                  │  - Extract the expanded content
    │                  │  - Store with topic name
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 5. COMPILE       │  Structure all topics into markdown:
    │    REPORT        │  - Title from notebook name
    │                  │  - Section per topic
    │                  │  - Summary synthesis
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 6. COMMIT FILE   │  git add && git commit the .md file
    │                  │  to .msw/research/NOTEBOOK_FINDINGS.md
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 7. CONTINUE MSW  │  Process continues with grounded research
    └──────────────────┘
```

---

## Browser Automation Implementation

### Using Playwright (recommended for notebooklm-mcp)

```javascript
// msw-notebooklm-extractor.js

const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');

class NotebookLMTopicExtractor {
  constructor(config) {
    this.browser = null;
    this.page = null;
    this.profilePath = config.profilePath || './chrome_profile_notebooklm';
    this.outputDir = config.outputDir || './.msw/research';
  }

  async init() {
    this.browser = await chromium.launchPersistentContext(this.profilePath, {
      headless: false, // NotebookLM requires visible browser
      args: ['--disable-blink-features=AutomationControlled'],
      viewport: { width: 1280, height: 900 }
    });
    this.page = await this.browser.newPage();
  }

  /**
   * Add sources to a notebook and extract all topic information
   */
  async extractTopics(notebookUrl, sources = []) {
    await this.page.goto(notebookUrl);
    await this.waitForNotebookLoad();

    // Step 1: Add sources if provided
    if (sources.length > 0) {
      await this.addSources(sources);
      await this.waitForProcessing();
    }

    // Step 2: Find all suggested topic pills
    const topics = await this.findTopicSuggestions();
    console.log(`Found ${topics.length} suggested topics`);

    // Step 3: Click each topic and extract expanded content
    const expandedTopics = [];
    for (const topic of topics) {
      console.log(`Expanding topic: ${topic.name}`);
      const content = await this.expandTopic(topic);
      expandedTopics.push({
        name: topic.name,
        content: content,
        timestamp: new Date().toISOString()
      });
      
      // Small delay to avoid rate limiting
      await this.page.waitForTimeout(1500);
    }

    // Step 4: Compile into markdown report
    const report = this.compileReport(notebookUrl, expandedTopics);

    // Step 5: Save and commit
    const filename = await this.saveAndCommit(report, notebookUrl);

    return {
      filename,
      topicCount: expandedTopics.length,
      topics: expandedTopics.map(t => t.name)
    };
  }

  async waitForNotebookLoad() {
    // Wait for the chat interface to be ready
    await this.page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Ask"]', {
      timeout: 30000
    });
  }

  async addSources(sources) {
    // Click "Add source" button
    const addButton = await this.page.waitForSelector(
      'button:has-text("Add source"), [aria-label="Add source"]'
    );
    await addButton.click();

    for (const source of sources) {
      if (source.type === 'url') {
        await this.addUrlSource(source.value);
      } else if (source.type === 'file') {
        await this.addFileSource(source.value);
      } else if (source.type === 'text') {
        await this.addTextSource(source.value, source.title);
      }
    }
  }

  async addUrlSource(url) {
    // Click URL/Link option
    await this.page.click('button:has-text("Website"), button:has-text("Link")');
    await this.page.fill('input[placeholder*="URL"], input[type="url"]', url);
    await this.page.click('button:has-text("Add"), button:has-text("Insert")');
    await this.page.waitForTimeout(2000);
  }

  async waitForProcessing() {
    // Wait for NotebookLM to finish processing sources
    // Look for processing indicators to disappear
    console.log('Waiting for NotebookLM to process sources...');
    
    try {
      // Wait for any loading spinners to appear and then disappear
      await this.page.waitForSelector('[class*="loading"], [class*="spinner"]', { 
        timeout: 5000 
      }).catch(() => {});
      
      await this.page.waitForSelector('[class*="loading"], [class*="spinner"]', {
        state: 'hidden',
        timeout: 120000 // 2 minutes max for processing
      }).catch(() => {});
    } catch (e) {
      // Processing might already be done
    }

    // Additional wait for topic suggestions to appear
    await this.page.waitForTimeout(3000);
  }

  async findTopicSuggestions() {
    // NotebookLM shows suggested topics as clickable pills/chips
    // These are usually in a container near the chat input
    
    const topicSelectors = [
      // Try various selectors for topic suggestions
      '[data-testid="suggested-topic"]',
      '[class*="suggestion"] button',
      '[class*="topic"] button',
      '[class*="chip"]:not([class*="source"])',
      'button[class*="prompt"]',
      // Fallback: any small buttons near chat that look like suggestions
      '.chat-suggestions button',
      '[role="listbox"] [role="option"]'
    ];

    let topics = [];
    
    for (const selector of topicSelectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          for (const el of elements) {
            const text = await el.textContent();
            if (text && text.length > 3 && text.length < 100) {
              topics.push({
                name: text.trim(),
                element: el
              });
            }
          }
          if (topics.length > 0) break;
        }
      } catch (e) {
        continue;
      }
    }

    // Deduplicate by name
    const seen = new Set();
    topics = topics.filter(t => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });

    return topics;
  }

  async expandTopic(topic) {
    // Click the topic pill
    await topic.element.click();

    // Wait for response to appear
    await this.page.waitForSelector('[class*="response"], [class*="message"]:last-child', {
      timeout: 60000
    });

    // Wait for streaming to complete (response stops changing)
    await this.waitForStreamingComplete();

    // Extract the response content
    const responseElements = await this.page.$$('[class*="response"], [class*="assistant-message"]');
    const lastResponse = responseElements[responseElements.length - 1];
    
    if (lastResponse) {
      const content = await lastResponse.textContent();
      return content.trim();
    }

    return '';
  }

  async waitForStreamingComplete() {
    // Wait for the response to stop streaming
    let previousContent = '';
    let stableCount = 0;
    
    while (stableCount < 3) {
      await this.page.waitForTimeout(1000);
      
      const responses = await this.page.$$('[class*="response"], [class*="assistant-message"]');
      const lastResponse = responses[responses.length - 1];
      const currentContent = lastResponse ? await lastResponse.textContent() : '';
      
      if (currentContent === previousContent) {
        stableCount++;
      } else {
        stableCount = 0;
        previousContent = currentContent;
      }
    }
  }

  compileReport(notebookUrl, expandedTopics) {
    const notebookName = this.extractNotebookName(notebookUrl);
    const timestamp = new Date().toISOString();

    let markdown = `# NotebookLM Research: ${notebookName}

**Source:** ${notebookUrl}  
**Extracted:** ${timestamp}  
**Topics Found:** ${expandedTopics.length}

---

## Summary

This document contains automatically extracted topic expansions from NotebookLM.
Each section below represents a suggested topic that was clicked and expanded.

---

`;

    // Add each topic as a section
    for (let i = 0; i < expandedTopics.length; i++) {
      const topic = expandedTopics[i];
      markdown += `## ${i + 1}. ${topic.name}

${topic.content}

---

`;
    }

    // Add synthesis section
    markdown += `## Key Takeaways

Based on the ${expandedTopics.length} topics explored above, the main themes are:

${expandedTopics.map((t, i) => `${i + 1}. **${t.name}**`).join('\n')}

---

*This document was auto-generated by MSW Protocol's NotebookLM Topic Extractor.*
`;

    return markdown;
  }

  extractNotebookName(url) {
    // Extract notebook ID or name from URL
    const match = url.match(/notebook\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : 'notebook';
  }

  async saveAndCommit(report, notebookUrl) {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Generate filename
    const notebookName = this.extractNotebookName(notebookUrl);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${this.outputDir}/${notebookName}-${timestamp}-FINDINGS.md`;

    // Write the file
    fs.writeFileSync(filename, report);
    console.log(`Saved report to: ${filename}`);

    // Git commit
    try {
      execSync(`git add "${filename}"`, { stdio: 'inherit' });
      execSync(`git commit -m "research: extract NotebookLM topics from ${notebookName}"`, {
        stdio: 'inherit'
      });
      console.log('Committed research findings to git');
    } catch (e) {
      console.log('Git commit skipped (not in repo or no changes)');
    }

    return filename;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node msw-notebooklm-extractor.js <notebook-url> [--sources file1.pdf,url1,...]');
    process.exit(1);
  }

  const notebookUrl = args[0];
  let sources = [];

  const sourcesIdx = args.indexOf('--sources');
  if (sourcesIdx !== -1 && args[sourcesIdx + 1]) {
    sources = args[sourcesIdx + 1].split(',').map(s => {
      if (s.startsWith('http')) {
        return { type: 'url', value: s };
      } else {
        return { type: 'file', value: s };
      }
    });
  }

  const extractor = new NotebookLMTopicExtractor({
    outputDir: './.msw/research'
  });

  try {
    await extractor.init();
    const result = await extractor.extractTopics(notebookUrl, sources);
    console.log('\n✓ Topic extraction complete!');
    console.log(`  File: ${result.filename}`);
    console.log(`  Topics: ${result.topics.join(', ')}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await extractor.close();
  }
}

module.exports = { NotebookLMTopicExtractor };

if (require.main === module) {
  main();
}
