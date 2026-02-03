/**
 * Source Uploader - Automates NotebookLM source addition
 *
 * Features:
 * - Upload files (.md, .txt, .pdf, .docx)
 * - Add URLs
 * - Batch operations
 * - Progress tracking
 * - Error handling with retries
 */

import type { Page } from 'playwright';
import { BrowserDriver } from '../browser/driver.js';
import { globalDegradation } from '../common/degradation.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SourceUploadOptions {
  notebookUrl: string;
  profileDir?: string;
  headless?: boolean;
  timeout?: number;
}

export interface SourceItem {
  type: 'file' | 'url';
  path?: string; // For files
  url?: string; // For URLs
  title?: string; // Optional display title
}

export interface UploadResult {
  success: boolean;
  uploaded: number;
  failed: number;
  errors: Array<{ source: SourceItem; error: string }>;
}

const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx', '.doc'];
const UPLOAD_TIMEOUT = 30000; // 30s per file

export class SourceUploader {
  private options: Required<SourceUploadOptions>;
  private driver: BrowserDriver | null = null;

  constructor(options: SourceUploadOptions) {
    this.options = {
      profileDir: options.profileDir ?? path.join(process.env.HOME || process.env.USERPROFILE || '', '.msw', 'chrome_profile'),
      headless: options.headless ?? false,
      timeout: options.timeout ?? 120000,
      ...options,
    };
  }

  /**
   * Upload multiple sources to NotebookLM
   */
  async uploadSources(sources: SourceItem[]): Promise<UploadResult> {
    const errors: Array<{ source: SourceItem; error: string }> = [];
    let uploaded = 0;

    try {
      // Launch browser and navigate to notebook
      await this.initBrowser();
      const page = await this.driver!.getPage();

      for (const source of sources) {
        try {
          if (source.type === 'file') {
            await this.uploadFile(page, source);
          } else if (source.type === 'url') {
            await this.uploadUrl(page, source);
          }
          uploaded++;
          console.log(`[uploader] ✓ Uploaded: ${source.path || source.url}`);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          errors.push({ source, error });
          console.error(`[uploader] ✗ Failed: ${source.path || source.url} - ${error}`);
        }

        // Wait between uploads to avoid rate limiting
        await page.waitForTimeout(2000);
      }

      await this.driver!.close();

      return {
        success: errors.length === 0,
        uploaded,
        failed: errors.length,
        errors,
      };
    } catch (err) {
      if (this.driver) {
        await this.driver.close();
      }

      return {
        success: false,
        uploaded,
        failed: sources.length - uploaded,
        errors: [
          ...errors,
          {
            source: { type: 'file' }, // Placeholder
            error: `Upload session failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  }

  /**
   * Initialize browser and navigate to notebook
   */
  private async initBrowser(): Promise<void> {
    const { result: context, context: degradationContext } = await globalDegradation.withFallbacks(
      'browser-init-for-upload',
      [
        {
          name: 'headless-mode',
          fn: async () => {
            this.driver = new BrowserDriver({
              profileDir: this.options.profileDir,
              headless: this.options.headless,
              viewport: { width: 1280, height: 720 },
            });
            return await this.driver.launch();
          },
        },
        ...(this.options.headless
          ? [
              {
                name: 'fallback-visible-mode',
                fn: async () => {
                  console.log('[uploader] Headless failed, using visible browser');
                  this.driver = new BrowserDriver({
                    profileDir: this.options.profileDir,
                    headless: false,
                    viewport: { width: 1280, height: 720 },
                  });
                  return await this.driver.launch();
                },
              },
            ]
          : []),
      ],
    );

    if (!context) {
      throw new Error(`Browser init failed: ${degradationContext.userMessage}`);
    }

    const page = await this.driver!.getPage();

    // Navigate to notebook
    console.log(`[uploader] Opening notebook: ${this.options.notebookUrl}`);
    await page.goto(this.options.notebookUrl, {
      waitUntil: 'networkidle',
      timeout: this.options.timeout,
    });

    // Wait for notebook to load
    await page.waitForTimeout(3000);
  }

  /**
   * Upload a file to NotebookLM
   */
  private async uploadFile(page: Page, source: SourceItem): Promise<void> {
    if (!source.path) {
      throw new Error('File path is required');
    }

    const filePath = path.resolve(source.path);

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
    }

    // Find and click "Add source" button
    const addSourceButton = await page.$('button:has-text("Add source")').catch(() => null);
    if (!addSourceButton) {
      throw new Error('Could not find "Add source" button');
    }

    await addSourceButton.click();
    await page.waitForTimeout(1000);

    // Look for file upload input
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('Could not find file upload input');
    }

    // Upload file
    await fileInput.setInputFiles(filePath);

    // Wait for upload to complete
    await page.waitForTimeout(UPLOAD_TIMEOUT);

    // Check for errors
    const errorElement = await page.$('[role="alert"]').catch(() => null);
    if (errorElement) {
      const errorText = await errorElement.textContent();
      throw new Error(`Upload failed: ${errorText}`);
    }
  }

  /**
   * Add a URL source to NotebookLM
   */
  private async uploadUrl(page: Page, source: SourceItem): Promise<void> {
    if (!source.url) {
      throw new Error('URL is required');
    }

    // Validate URL format
    try {
      new URL(source.url);
    } catch {
      throw new Error(`Invalid URL: ${source.url}`);
    }

    // Find and click "Add source" button
    const addSourceButton = await page.$('button:has-text("Add source")').catch(() => null);
    if (!addSourceButton) {
      throw new Error('Could not find "Add source" button');
    }

    await addSourceButton.click();
    await page.waitForTimeout(1000);

    // Look for URL input or tab
    const urlTab = await page.$('button:has-text("Link")').catch(() => null);
    if (urlTab) {
      await urlTab.click();
      await page.waitForTimeout(500);
    }

    const urlInput = await page.$('input[placeholder*="URL"], input[placeholder*="link"]');
    if (!urlInput) {
      throw new Error('Could not find URL input field');
    }

    // Enter URL and submit
    await urlInput.fill(source.url);
    await page.waitForTimeout(500);

    const submitButton = await page.$('button:has-text("Add")');
    if (submitButton) {
      await submitButton.click();
    } else {
      // Try pressing Enter
      await urlInput.press('Enter');
    }

    // Wait for processing
    await page.waitForTimeout(UPLOAD_TIMEOUT);

    // Check for errors
    const errorElement = await page.$('[role="alert"]').catch(() => null);
    if (errorElement) {
      const errorText = await errorElement.textContent();
      throw new Error(`URL add failed: ${errorText}`);
    }
  }

  /**
   * Validate sources before upload
   */
  static validateSources(sources: SourceItem[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [index, source] of sources.entries()) {
      if (source.type === 'file') {
        if (!source.path) {
          errors.push(`Source ${index}: File path is required`);
        } else if (!fs.existsSync(source.path)) {
          errors.push(`Source ${index}: File not found: ${source.path}`);
        } else {
          const ext = path.extname(source.path).toLowerCase();
          if (!SUPPORTED_EXTENSIONS.includes(ext)) {
            errors.push(`Source ${index}: Unsupported file type: ${ext}`);
          }
        }
      } else if (source.type === 'url') {
        if (!source.url) {
          errors.push(`Source ${index}: URL is required`);
        } else {
          try {
            new URL(source.url);
          } catch {
            errors.push(`Source ${index}: Invalid URL: ${source.url}`);
          }
        }
      } else {
        errors.push(`Source ${index}: Invalid type: ${source.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
