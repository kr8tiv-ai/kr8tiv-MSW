/**
 * Error-to-query bridge for the bidirectional communication pipeline.
 */

import { AgentError, ErrorQueryOptions } from '../types/bidirectional.js';
import { formatErrorQuery } from './error-templates.js';

export interface QueryPayload {
  query: string;
  source: 'error-bridge';
  error: AgentError;
}

export class ErrorBridge {
  private readonly options: ErrorQueryOptions;
  private readonly errorLog: AgentError[] = [];

  constructor(options?: ErrorQueryOptions) {
    this.options = options ?? {};
  }

  formatQuery(error: AgentError, taskGoal: string): string {
    return formatErrorQuery(error, taskGoal, this.options);
  }

  createQueryPayload(error: AgentError, taskGoal: string): QueryPayload {
    this.errorLog.push(error);
    return {
      query: this.formatQuery(error, taskGoal),
      source: 'error-bridge',
      error,
    };
  }

  getErrorLog(): AgentError[] {
    return [...this.errorLog];
  }
}
