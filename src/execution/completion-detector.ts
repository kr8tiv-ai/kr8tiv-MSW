/**
 * Completion detector for the Ralph loop.
 *
 * Checks if the agent has completed its task by scanning the transcript
 * for the completion promise string and optionally running verification commands.
 */

import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

export interface VerifyResult {
  command: string;
  passed: boolean;
}

export interface CompletionResult {
  complete: boolean;
  verifyResults: VerifyResult[];
}

export class CompletionDetector {
  private readonly completionPromise: string;

  constructor(completionPromise: string) {
    this.completionPromise = completionPromise;
  }

  /**
   * Check if the completion promise string appears in the transcript.
   * Returns false if the file does not exist or cannot be read.
   */
  checkTranscript(transcriptPath: string): boolean {
    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      return content.includes(this.completionPromise);
    } catch {
      return false;
    }
  }

  /**
   * Check transcript AND run verification commands.
   * Task is complete only if the promise is found AND all commands exit 0.
   */
  checkWithVerification(
    transcriptPath: string,
    verifyCommands: string[],
  ): CompletionResult {
    const promiseFound = this.checkTranscript(transcriptPath);
    const verifyResults: VerifyResult[] = [];

    for (const command of verifyCommands) {
      try {
        execSync(command, { stdio: 'pipe', timeout: 60_000 });
        verifyResults.push({ command, passed: true });
      } catch {
        verifyResults.push({ command, passed: false });
      }
    }

    const allPassed = verifyResults.every((r) => r.passed);

    return {
      complete: promiseFound && allPassed,
      verifyResults,
    };
  }
}
