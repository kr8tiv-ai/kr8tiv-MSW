/**
 * Behavioral verifier -- runs actual test commands and validates real functionality.
 * Never throws; always returns structured results.
 */

import { execSync } from 'node:child_process';

/** Specification for what to verify */
export interface VerificationSpec {
  /** Commands to run */
  commands: string[];
  /** Optional: command -> regex pattern to match against stdout */
  expectedOutputPatterns?: Record<string, string>;
  /** Timeout per command in ms (default 30000) */
  timeoutMs?: number;
}

/** Result for a single command execution */
export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  passed: boolean;
  reason?: string;
}

/** Aggregated verification result */
export interface VerificationResult {
  passed: boolean;
  results: CommandResult[];
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class BehavioralVerifier {
  /**
   * Run all commands in spec and return structured pass/fail results.
   * Never throws -- errors are captured as failed results.
   */
  verify(spec: VerificationSpec): VerificationResult {
    const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const results: CommandResult[] = [];

    for (const command of spec.commands) {
      results.push(this.runCommand(command, timeoutMs, spec.expectedOutputPatterns));
    }

    return {
      passed: results.every((r) => r.passed),
      results,
    };
  }

  private runCommand(
    command: string,
    timeoutMs: number,
    patterns?: Record<string, string>,
  ): CommandResult {
    let stdout = '';
    let exitCode = 0;

    try {
      const output = execSync(command, {
        timeout: timeoutMs,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      stdout = output ?? '';
    } catch (err: unknown) {
      // Handle timeout
      if (err && typeof err === 'object' && 'killed' in err && (err as { killed: boolean }).killed) {
        return { command, exitCode: 1, stdout: '', passed: false, reason: 'timeout' };
      }

      // Handle non-zero exit
      if (err && typeof err === 'object' && 'status' in err) {
        const execErr = err as { status: number | null; stdout?: string };
        exitCode = execErr.status ?? 1;
        stdout = typeof execErr.stdout === 'string' ? execErr.stdout : '';
        return {
          command,
          exitCode,
          stdout,
          passed: false,
          reason: `exit code ${exitCode}`,
        };
      }

      // Command not found or other OS error
      const message = err instanceof Error ? err.message : String(err);
      return { command, exitCode: 127, stdout: '', passed: false, reason: message };
    }

    // Check expected output pattern if provided
    if (patterns && patterns[command]) {
      const regex = new RegExp(patterns[command]);
      if (!regex.test(stdout)) {
        return {
          command,
          exitCode: 0,
          stdout,
          passed: false,
          reason: `stdout did not match pattern: ${patterns[command]}`,
        };
      }
    }

    return { command, exitCode: 0, stdout, passed: true };
  }
}
