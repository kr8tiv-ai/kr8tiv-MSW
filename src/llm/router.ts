/**
 * LLM Router for MSW
 *
 * Routes LLM requests to the best available provider:
 * 1. Ollama (local, fast, free) - preferred
 * 2. Gemini CLI (cloud, requires auth) - fallback
 *
 * @module llm/router
 */

import { createLogger } from '../logging/index.js';
import {
  isGeminiAvailable,
  scoreRelevanceWithGemini,
  researchWithGemini,
  type RelevanceScore,
} from './gemini-provider.js';

const logger = createLogger('llm-router');

export type LLMProvider = 'ollama' | 'gemini' | 'none';

interface ProviderStatus {
  ollama: boolean;
  gemini: boolean;
  preferred: LLMProvider;
}

let cachedStatus: ProviderStatus | null = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 60000; // 1 minute

/**
 * Check which LLM providers are available
 */
export async function checkProviders(): Promise<ProviderStatus> {
  const now = Date.now();

  // Return cached status if fresh
  if (cachedStatus && now - statusCacheTime < STATUS_CACHE_TTL) {
    return cachedStatus;
  }

  logger.info('Checking LLM provider availability');

  // Check Ollama
  let ollamaAvailable = false;
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    ollamaAvailable = response.ok;
  } catch {
    ollamaAvailable = false;
  }

  // Check Gemini
  const geminiAvailable = await isGeminiAvailable();

  // Determine preferred provider
  let preferred: LLMProvider = 'none';
  if (ollamaAvailable) {
    preferred = 'ollama';
  } else if (geminiAvailable) {
    preferred = 'gemini';
  }

  cachedStatus = {
    ollama: ollamaAvailable,
    gemini: geminiAvailable,
    preferred,
  };
  statusCacheTime = now;

  logger.info(
    { ollama: ollamaAvailable, gemini: geminiAvailable, preferred },
    'LLM providers checked'
  );

  return cachedStatus;
}

/**
 * Score topic relevance using best available provider
 */
export async function scoreRelevance(
  candidateTopic: string,
  taskGoal: string,
  currentError: string | null,
  previousTopics: string[]
): Promise<RelevanceScore> {
  const status = await checkProviders();

  if (status.preferred === 'ollama') {
    // Use Ollama via RelevanceScorer class
    try {
      const { RelevanceScorer } = await import(
        '../auto-conversation/relevance-scorer.js'
      );
      const scorer = new RelevanceScorer({ model: 'qwen2.5:1.5b', threshold: 30 });
      const result = await scorer.score(candidateTopic, taskGoal, currentError, previousTopics);
      return {
        taskRelevance: Math.round(result.score * 0.4),
        errorRelevance: currentError ? Math.round(result.score * 0.3) : 0,
        implementationValue: Math.round(result.score * 0.2),
        novelty: Math.round(result.score * 0.1),
        total: result.score,
        reasoning: result.reasoning,
      };
    } catch (err) {
      logger.warn({ error: err }, 'Ollama scoring failed, trying Gemini');
      // Fall through to Gemini
    }
  }

  if (status.gemini) {
    return await scoreRelevanceWithGemini(
      candidateTopic,
      taskGoal,
      currentError,
      previousTopics
    );
  }

  // No providers available
  logger.error('No LLM providers available for relevance scoring');
  return {
    taskRelevance: 0,
    errorRelevance: 0,
    implementationValue: 0,
    novelty: 0,
    total: 0,
    reasoning: 'No LLM providers available',
  };
}

/**
 * Research a topic using best available provider
 */
export async function research(query: string, context?: string): Promise<string> {
  const status = await checkProviders();

  if (status.preferred === 'gemini' || !status.ollama) {
    // Prefer Gemini for research (larger context, better reasoning)
    if (status.gemini) {
      return await researchWithGemini(query, context);
    }
  }

  if (status.ollama) {
    // Use Ollama for research
    try {
      const ollama = await import('ollama');
      const response = await ollama.default.chat({
        model: 'qwen2.5:1.5b',
        messages: [
          {
            role: 'user',
            content: context
              ? `Context: ${context}\n\nQuestion: ${query}\n\nProvide a concise, technical answer.`
              : query,
          },
        ],
      });
      return response.message.content;
    } catch (err) {
      logger.warn({ error: err }, 'Ollama research failed');
    }
  }

  return 'Error: No LLM providers available for research';
}

/**
 * Get current provider status (for diagnostics)
 */
export function getProviderStatus(): ProviderStatus | null {
  return cachedStatus;
}

/**
 * Clear provider cache (force re-check on next request)
 */
export function clearProviderCache(): void {
  cachedStatus = null;
  statusCacheTime = 0;
}

export default {
  checkProviders,
  scoreRelevance,
  research,
  getProviderStatus,
  clearProviderCache,
};
