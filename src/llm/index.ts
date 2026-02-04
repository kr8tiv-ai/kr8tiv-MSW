/**
 * LLM Module - Multi-provider LLM integration
 *
 * Provides routing between:
 * - Ollama (local, fast, free)
 * - Gemini CLI (cloud, requires auth)
 *
 * @module llm
 */

export {
  isGeminiAvailable,
  executeGeminiPrompt,
  scoreRelevanceWithGemini,
  researchWithGemini,
  type GeminiResponse,
  type RelevanceScore,
} from './gemini-provider.js';

export {
  checkProviders,
  scoreRelevance,
  research,
  getProviderStatus,
  clearProviderCache,
  type LLMProvider,
} from './router.js';
