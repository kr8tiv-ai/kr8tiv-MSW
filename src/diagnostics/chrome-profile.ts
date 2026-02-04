import { existsSync, unlinkSync, statSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * Chrome lock files that indicate a profile is in use.
 */
const CHROME_LOCK_FILES = [
  "SingletonLock",
  "SingletonSocket",
  "SingletonCookie",
];

/**
 * Database lock patterns that may persist after crashes.
 */
const DB_LOCK_PATTERNS = [
  "shared_proto_db/metadata/LOCK",
  "Local State.lock",
  "Cookies.lock",
  "History.lock",
];

export interface LockDetectionResult {
  profilePath: string;
  locksFound: string[];
  isLocked: boolean;
  lastModified?: Date;
}

export interface LockClearResult {
  cleared: string[];
  failed: string[];
  success: boolean;
}

/**
 * Detect Chrome profile lock files (HARD-13).
 */
export function detectChromeLock(profilePath: string): LockDetectionResult {
  const locksFound: string[] = [];
  let lastModified: Date | undefined;

  // Check main lock files
  for (const lockFile of CHROME_LOCK_FILES) {
    const lockPath = join(profilePath, lockFile);
    if (existsSync(lockPath)) {
      locksFound.push(lockFile);
      try {
        const stat = statSync(lockPath);
        if (!lastModified || stat.mtime > lastModified) {
          lastModified = stat.mtime;
        }
      } catch {
        // Ignore stat errors
      }
    }
  }

  // Check database lock patterns
  for (const pattern of DB_LOCK_PATTERNS) {
    const lockPath = join(profilePath, pattern);
    if (existsSync(lockPath)) {
      locksFound.push(pattern);
    }
  }

  return {
    profilePath,
    locksFound,
    isLocked: locksFound.length > 0,
    lastModified,
  };
}

/**
 * Clear Chrome profile lock files (HARD-13).
 * Only clears if the lock appears stale (no running Chrome process).
 */
export function clearChromeLock(profilePath: string): LockClearResult {
  const detection = detectChromeLock(profilePath);
  const cleared: string[] = [];
  const failed: string[] = [];

  if (!detection.isLocked) {
    return { cleared: [], failed: [], success: true };
  }

  // Attempt to clear each lock file
  for (const lockFile of detection.locksFound) {
    const lockPath = join(profilePath, lockFile);

    try {
      unlinkSync(lockPath);
      cleared.push(lockFile);
    } catch (error) {
      // File may be in use by running Chrome
      failed.push(lockFile);
    }
  }

  return {
    cleared,
    failed,
    success: failed.length === 0,
  };
}

/**
 * Check if Chrome is likely running by looking for recent lock file activity.
 */
export function isChromeRunning(profilePath: string): boolean {
  const detection = detectChromeLock(profilePath);

  if (!detection.isLocked || !detection.lastModified) {
    return false;
  }

  // If lock was modified in the last 5 seconds, Chrome is likely running
  const fiveSecondsAgo = new Date(Date.now() - 5000);
  return detection.lastModified > fiveSecondsAgo;
}

/**
 * Get safe message for lock state (for user display).
 */
export function getLockMessage(result: LockDetectionResult): string {
  if (!result.isLocked) {
    return "No lock files detected. Profile is available.";
  }

  const files = result.locksFound.join(", ");
  return `Lock files detected: ${files}. Chrome may be running or crashed.`;
}
