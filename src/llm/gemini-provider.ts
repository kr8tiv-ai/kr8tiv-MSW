/**
 * Gemini CLI Integration for MSW
 *
 * Provides an alternative LLM provider using Google's Gemini CLI.
 * Used for relevance scoring when Ollama is unavailable.
 *
 * @module llm/gemini-provider
 */

import { spawn } from 'child_process';
import { createLogger } from '../logging/index.js';

const logger = createLogger('gemini-provider');

export interface GeminiResponse {
  content: string;
  model: string;
  success: boolean;
  error?: string;
}

export interface RelevanceScore {
  taskRelevance: number;
  errorRelevance: number;
  implementationValue: number;
  novelty: number;
  total: number;
  reasoning: string;
}

/**
 * Check if Gemini CLI is available
 */
export async function isGeminiAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('gemini', ['--version'], { shell: true });
    process.on('close', (code) => resolve(code === 0));
    process.on('error', () => resolve(false));
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Execute a prompt using Gemini CLI in headless mode
 */
export async function executeGeminiPrompt(
  prompt: string,
  options: {
    model?: string;
    outputFormat?: 'text' | 'json';
    timeout?: number;
  } = {}
): Promise<GeminiResponse> {
  const { model, outputFormat = 'text', timeout = 30000 } = options;

  return new Promise((resolve) => {
    const args = ['-p', prompt];

    if (model) {
      args.push('-m', model);
    }

    if (outputFormat === 'json') {
      args.push('-o', 'json');
    }

    logger.debug({ args }, 'Executing Gemini CLI');

    const process = spawn('gemini', args, { shell: true });
    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      process.kill();
      resolve({
        content: '',
        model: model || 'default',
        success: false,
        error: 'Timeout exceeded',
      });
    }, timeout);

    process.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        resolve({
          content: stdout.trim(),
          model: model || 'default',
          success: true,
        });
      } else {
        resolve({
          content: stdout.trim(),
          model: model || 'default',
          success: false,
          error: stderr || `Process exited with code ${code}`,
        });
      }
    });

    process.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        content: '',
        model: model || 'default',
        success: false,
        error: err.message,
      });
    });
  });
}

/**
 * Score topic relevance using Gemini
 * Fallback when Ollama is unavailable
 */
export async function scoreRelevanceWithGemini(
  candidateTopic: string,
  taskGoal: string,
  currentError: string | null,
  previousTopics: string[]
): Promise<RelevanceScore> {
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

  logger.info({ candidateTopic }, 'Scoring relevance with Gemini');

  const response = await executeGeminiPrompt(prompt, {
    outputFormat: 'text',
    timeout: 15000,
  });

  if (!response.success) {
    logger.error({ error: response.error }, 'Gemini scoring failed');
    // Return conservative default score
    return {
      taskRelevance: 0,
      errorRelevance: 0,
      implementationValue: 0,
      novelty: 0,
      total: 0,
      reasoning: 'Gemini scoring failed, returning zero score',
    };
  }

  try {
    // Extract JSON from response (may have extra text)
    const jsonMatch = response.content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
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

    logger.info({ candidateTopic, score: score.total }, 'Gemini relevance score');
    return score;
  } catch (err) {
    logger.error({ error: err, response: response.content }, 'Failed to parse Gemini response');
    return {
      taskRelevance: 0,
      errorRelevance: 0,
      implementationValue: 0,
      novelty: 0,
      total: 0,
      reasoning: 'Failed to parse Gemini response',
    };
  }
}

/**
 * Research a topic using Gemini's knowledge
 * Useful as fallback when NotebookLM is unavailable
 */
export async function researchWithGemini(
  query: string,
  context?: string
): Promise<string> {
  const prompt = context
    ? `Context: ${context}\n\nQuestion: ${query}\n\nProvide a concise, technical answer.`
    : `Question: ${query}\n\nProvide a concise, technical answer.`;

  logger.info({ query }, 'Researching with Gemini');

  const response = await executeGeminiPrompt(prompt, {
    timeout: 60000,
  });

  if (!response.success) {
    logger.error({ error: response.error }, 'Gemini research failed');
    return `Error: ${response.error}`;
  }

  return response.content;
}

/**
 * Search the web for current documentation and libraries using Gemini's grounding
 * Returns structured results with URLs
 */
export async function webSearchWithGemini(
  technologies: string[],
  goal: string
): Promise<{
  sources: Array<{ title: string; url: string; description: string }>;
  recommendations: string[];
  reasoning: string;
}> {
  const techList = technologies.join(', ') || 'general programming';
  const prompt = `Search the web for the most up-to-date documentation and best practices for this project.

Technologies: ${techList}
Goal: ${goal}

Find:
1. Official documentation URLs for the main libraries/frameworks
2. Best practice guides from 2024-2026
3. GitHub repositories with good examples

Return ONLY valid JSON (no markdown, no explanation):
{
  "sources": [
    {"title": "Source title", "url": "https://...", "description": "What this source covers"}
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "reasoning": "Why these sources are relevant"
}`;

  logger.info({ technologies, goal }, 'Web searching with Gemini');

  // Use grounding flag for web search
  const response = await executeGeminiPrompt(prompt, {
    timeout: 45000,
  });

  if (!response.success) {
    logger.warn({ error: response.error }, 'Gemini web search failed');
    return {
      sources: [],
      recommendations: [`Search for "${techList} documentation" manually`],
      reasoning: 'Web search failed, manual search recommended',
    };
  }

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    }
  } catch (err) {
    logger.warn({ error: err }, 'Failed to parse web search response');
  }

  return {
    sources: [],
    recommendations: [`Search for "${techList} documentation" manually`],
    reasoning: 'Failed to parse web search results',
  };
}

export default {
  isGeminiAvailable,
  executeGeminiPrompt,
  scoreRelevanceWithGemini,
  researchWithGemini,
  webSearchWithGemini,
};
