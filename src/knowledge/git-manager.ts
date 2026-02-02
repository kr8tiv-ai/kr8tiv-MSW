/**
 * Git manager: commits research artifacts to .msw/research/ with structured messages.
 *
 * Handles non-git directories gracefully (KNOW-02).
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Manages git persistence for MSW research artifacts.
 */
export class GitManager {
  private git: SimpleGit;
  private researchDir: string;

  constructor(projectRoot: string) {
    this.git = simpleGit(projectRoot);
    this.researchDir = join(projectRoot, '.msw', 'research');
  }

  /** Check if the project root is inside a git repository. */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  /** Ensure the research directory exists. */
  async ensureResearchDir(): Promise<void> {
    if (!existsSync(this.researchDir)) {
      mkdirSync(this.researchDir, { recursive: true });
    }
  }

  /**
   * Stage and commit research files.
   * Returns the commit hash, or null if not in a git repo or on error.
   */
  async commitResearch(
    files: string[],
    sessionId: string,
  ): Promise<string | null> {
    try {
      if (!(await this.isGitRepo())) {
        console.warn('[GitManager] Not inside a git repository, skipping commit.');
        return null;
      }

      await this.git.add(files);
      const result = await this.git.commit(
        `research(msw): session ${sessionId}\n\nAuto-committed by MSW Protocol`,
      );
      return result.commit || null;
    } catch (error) {
      console.warn('[GitManager] Commit failed:', error);
      return null;
    }
  }

  /** Get the research directory path. */
  getResearchDir(): string {
    return this.researchDir;
  }

  /** Check if there are uncommitted changes in .msw/research/. */
  async hasUncommittedResearch(): Promise<boolean> {
    try {
      if (!(await this.isGitRepo())) {
        return false;
      }
      const status = await this.git.status();
      const researchPrefix = '.msw/research/';
      return (
        status.modified.some((f) => f.startsWith(researchPrefix)) ||
        status.not_added.some((f) => f.startsWith(researchPrefix)) ||
        status.created.some((f) => f.startsWith(researchPrefix))
      );
    } catch {
      return false;
    }
  }
}
