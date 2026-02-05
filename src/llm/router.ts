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
  webSearchWithGemini,
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
    // Use Ollama directly for LLM-based scoring
    try {
      const ollama = await import('ollama');
      const prompt = `You are a relevance scorer. Score this NotebookLM suggested topic for relevance.

Task goal: ${taskGoal}
${currentError ? `Current error: ${currentError}` : ''}
Previously explored topics: ${previousTopics.slice(0, 10).join(', ') || 'none'}

Candidate topic: "${candidateTopic}"

Score each dimension (be strict, most topics should score LOW):
- taskRelevance (0-40): How directly relevant to the task goal?
- errorRelevance (0-30): How likely to help resolve the current error? (0 if no error)
- implementationValue (0-20): How likely to provide concrete implementation details?
- novelty (0-10): How different from previously explored topics?

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"taskRelevance":0,"errorRelevance":0,"implementationValue":0,"novelty":0,"total":0,"reasoning":"one sentence"}`;

      logger.info({ candidateTopic }, 'Scoring relevance with Ollama');

      const response = await ollama.default.chat({
        model: 'qwen2.5:1.5b',
        messages: [{ role: 'user', content: prompt }],
      });

      // Parse JSON response
      const jsonMatch = response.message.content.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Ollama response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as RelevanceScore;

      // Validate and clamp values
      const score: RelevanceScore = {
        taskRelevance: Math.min(40, Math.max(0, parsed.taskRelevance || 0)),
        errorRelevance: Math.min(30, Math.max(0, parsed.errorRelevance || 0)),
        implementationValue: Math.min(20, Math.max(0, parsed.implementationValue || 0)),
        novelty: Math.min(10, Math.max(0, parsed.novelty || 0)),
        total: 0,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };

      score.total = score.taskRelevance + score.errorRelevance + score.implementationValue + score.novelty;

      logger.info({ candidateTopic, score: score.total }, 'Ollama relevance score');
      return score;
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

  // No providers available - use fast string-similarity fallback
  logger.info('No LLM providers available, using string-similarity fallback');
  try {
    const { RelevanceScorer } = await import('../auto-conversation/relevance-scorer.js');
    const scorer = new RelevanceScorer();
    const result = await scorer.score(candidateTopic, taskGoal, currentError, previousTopics);
    return {
      taskRelevance: result.dimensions?.taskRelevance ?? 0,
      errorRelevance: result.dimensions?.errorRelevance ?? 0,
      implementationValue: result.dimensions?.implementationValue ?? 0,
      novelty: result.dimensions?.novelty ?? 0,
      total: result.score,
      reasoning: result.reasoning + ' (string-similarity fallback)',
    };
  } catch {
    logger.error('All relevance scoring methods failed');
    return {
      taskRelevance: 0,
      errorRelevance: 0,
      implementationValue: 0,
      novelty: 0,
      total: 0,
      reasoning: 'All scoring methods failed',
    };
  }
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

/**
 * Web search for current documentation and libraries
 */
export async function webSearch(
  technologies: string[],
  goal: string
): Promise<{
  sources: Array<{ title: string; url: string; description: string }>;
  recommendations: string[];
  reasoning: string;
}> {
  const status = await checkProviders();

  // Prefer Gemini for web search (has grounding capability)
  if (status.gemini) {
    return await webSearchWithGemini(technologies, goal);
  }

  // Ollama fallback - no actual web search, just recommendations
  if (status.ollama) {
    try {
      const ollama = await import('ollama');
      const prompt = `Given these technologies: ${technologies.join(', ')}
And this goal: ${goal}

Suggest documentation sources to look up. Return JSON:
{
  "sources": [],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "reasoning": "explanation"
}`;

      const response = await ollama.default.chat({
        model: 'qwen2.5:1.5b',
        messages: [{ role: 'user', content: prompt }],
      });

      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sources: [],
          recommendations: parsed.recommendations || [],
          reasoning: parsed.reasoning + ' (Ollama - no web access)',
        };
      }
    } catch (err) {
      logger.warn({ error: err }, 'Ollama web search fallback failed');
    }
  }

  // No providers available
  return {
    sources: [],
    recommendations: [
      `Search for "${technologies.join(' ')} documentation" on Google`,
      `Check npm/PyPI for official package docs`,
      `Look for "awesome-${technologies[0]?.toLowerCase() || 'list'}" on GitHub`,
    ],
    reasoning: 'No LLM providers available for web search',
  };
}

export default {
  checkProviders,
  scoreRelevance,
  research,
  webSearch,
  getProviderStatus,
  clearProviderCache,
};
