/**
 * Type definitions for GSD workflow state persistence.
 */

/** Result of a single plan execution iteration. */
export interface IterationRecord {
  iteration: number;
  timestamp: string;
  phase: string;
  planId: string;
  result: 'success' | 'failure';
  error?: string;
}

/** Top-level GSD state stored in .planning/STATE.md frontmatter. */
export interface GsdState {
  currentPhase: string;
  status: 'init' | 'research' | 'plan' | 'execute' | 'verify' | 'complete';
  lastUpdated: string;
  decisions: Record<string, string>;
  blockers: string[];
  iterationHistory: IterationRecord[];
}

/** A single plan within a roadmap phase. */
export interface RoadmapPlan {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'done' | 'skipped';
}

/** A phase entry in the roadmap. */
export interface RoadmapPhase {
  name: string;
  goal: string;
  status: 'pending' | 'in-progress' | 'done';
  plans: RoadmapPlan[];
}

/** Structure of .planning/ROADMAP.md frontmatter. */
export interface GsdRoadmap {
  phases: RoadmapPhase[];
}

/** Structure of .planning/PROJECT.md frontmatter. */
export interface GsdProject {
  name: string;
  description: string;
  constraints: string[];
  decisions: Record<string, string>;
}
