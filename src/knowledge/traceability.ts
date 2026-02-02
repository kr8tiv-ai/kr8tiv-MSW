/**
 * Traceability linker: maps research sessions to git commits.
 *
 * Maintains bidirectional session-to-commit relationships (KNOW-04).
 */

/**
 * Links research session IDs to their associated git commits.
 */
export class TraceabilityLinker {
  private sessionToCommits = new Map<string, string[]>();
  private commitToSession = new Map<string, string>();

  /** Record that a commit belongs to a session. */
  linkCommit(sessionId: string, commitHash: string): void {
    const existing = this.sessionToCommits.get(sessionId) ?? [];
    existing.push(commitHash);
    this.sessionToCommits.set(sessionId, existing);
    this.commitToSession.set(commitHash, sessionId);
  }

  /** Get all commit hashes for a session. */
  getCommitsForSession(sessionId: string): string[] {
    return this.sessionToCommits.get(sessionId) ?? [];
  }

  /** Get the session that produced a commit. */
  getSessionForCommit(commitHash: string): string | undefined {
    return this.commitToSession.get(commitHash);
  }

  /** Generate a traceability comment for code or commit messages. */
  generateTraceabilityComment(sessionId: string): string {
    const commits = this.getCommitsForSession(sessionId);
    return `MSW Research: session-${sessionId} (${commits.length} commits)`;
  }

  /** Serialize session-to-commits map. */
  toJSON(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, value] of this.sessionToCommits) {
      result[key] = [...value];
    }
    return result;
  }

  /** Restore from serialized form. */
  fromJSON(data: Record<string, string[]>): void {
    this.sessionToCommits.clear();
    this.commitToSession.clear();
    for (const [sessionId, commits] of Object.entries(data)) {
      this.sessionToCommits.set(sessionId, [...commits]);
      for (const hash of commits) {
        this.commitToSession.set(hash, sessionId);
      }
    }
  }
}
