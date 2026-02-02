/**
 * Ralph loop execution types.
 */

import { z } from 'zod';

/** Context about what task Ralph is executing */
export interface TaskContext {
  phase: string;
  planId: string;
  description: string;
}

/** Persisted Ralph loop state */
export interface RalphState {
  active: boolean;
  prompt: string;
  completionPromise: string;
  iteration: number;
  maxIterations: number;
  startedAt: string;
  lastHeartbeat: string;
  lastError: string | null;
  notebookLmGuidance: string | null;
  queriedErrors: string[];
  taskContext: TaskContext;
}

/** Configuration to initialize a Ralph loop */
export interface RalphConfig {
  prompt: string;
  completionPromise: string;
  maxIterations?: number;
  notebookUrl?: string;
  taskContext: TaskContext;
}

/** Result of an iteration increment */
export type IterationResult = 'continue' | 'complete' | 'exceeded';

/** Default max iterations */
export const DEFAULT_MAX_ITERATIONS = 50;

/** Zod schema for validating persisted RalphState */
export const RalphStateSchema = z.object({
  active: z.boolean(),
  prompt: z.string(),
  completionPromise: z.string(),
  iteration: z.number(),
  maxIterations: z.number(),
  startedAt: z.string(),
  lastHeartbeat: z.string(),
  lastError: z.string().nullable(),
  notebookLmGuidance: z.string().nullable(),
  queriedErrors: z.array(z.string()),
  taskContext: z.object({
    phase: z.string(),
    planId: z.string(),
    description: z.string(),
  }),
});
