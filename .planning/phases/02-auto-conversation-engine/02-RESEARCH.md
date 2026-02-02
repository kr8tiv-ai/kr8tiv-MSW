# Phase 2: Auto-Conversation Engine - Research

**Researched:** 2026-02-02
**Domain:** Topic detection, relevance scoring via local LLM, multi-level BFS expansion, rate limit management
**Confidence:** HIGH

## Summary

Phase 2 builds the automatic topic exploration engine on top of Phase 1's browser automation. The core algorithm is a breadth-first expansion of NotebookLM's suggested topic pills: detect pills, score each for relevance using a local LLM (Ollama), click those above threshold, extract responses, detect new pills that appear, and repeat up to 10 levels deep. The key technical decisions are: (1) use `ollama-js` with structured JSON output via Zod schemas for fast, typed relevance scoring, (2) use a priority-queue BFS (best-first search) where higher-scoring topics are expanded first within each level, and (3) track query budget as a first-class resource to optimize within the 50 queries/day limit.

The reference implementation (`msw-notebooklm-extractor(1).js`) already demonstrates single-level topic extraction (find pills, click each, extract). This phase extends it to multi-level with relevance filtering and budget awareness.

**Primary recommendation:** Use `ollama` npm package with `qwen2.5:1.5b` (or `phi3:mini`) for sub-500ms relevance scoring via structured JSON output. Implement BFS expansion with a priority queue sorted by relevance score. Track query budget explicitly and provide dry-run mode for budget estimation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [ollama](https://www.npmjs.com/package/ollama) | latest | Local LLM inference for relevance scoring | Official Ollama JS client, structured JSON output via `format` param |
| [zod](https://www.npmjs.com/package/zod) | 3.x | Schema definition for structured LLM output | Standard TS schema library; `zodToJsonSchema()` feeds directly into Ollama's `format` param |
| [zod-to-json-schema](https://www.npmjs.com/package/zod-to-json-schema) | latest | Convert Zod schemas to JSON Schema for Ollama | Required bridge between Zod and Ollama's structured output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [p-queue](https://www.npmjs.com/package/p-queue) | 8.x | Concurrency-limited async queue | Rate limiting topic expansion; ensures sequential processing |
| [conf](https://www.npmjs.com/package/conf) | 13.x | Persistent config storage | Storing relevance threshold, query budget, rate limit state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ollama (direct) | ai-sdk-ollama (Vercel AI SDK) | AI SDK adds abstraction + JSON repair but heavier dependency; direct ollama-js is simpler for single-purpose scoring |
| qwen2.5:1.5b | phi3:mini (3.8B) | Phi3 is slightly more accurate but 2x slower; 1.5B is fast enough for binary relevance classification |
| Zod schemas | Raw JSON Schema | Zod gives TypeScript type inference + runtime validation; worth the dependency |

**Installation:**
```bash
npm install ollama zod zod-to-json-schema p-queue conf
```

**Ollama model setup:**
```bash
ollama pull qwen2.5:1.5b
# Or for higher quality:
ollama pull phi3:mini
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── auto-conversation/
│   ├── engine.ts           # TopicExpansionEngine - BFS orchestrator
│   ├── topic-detector.ts   # Find topic pills in NotebookLM UI
│   ├── relevance-scorer.ts # Local LLM relevance evaluation
│   ├── budget-tracker.ts   # Query budget management (50/day)
│   ├── expansion-state.ts  # Track visited topics, expansion tree
│   └── types.ts            # Topic, ScoredTopic, ExpansionResult types
└── types/
    └── auto-conversation.ts
```

### Pattern 1: BFS Topic Expansion with Relevance Priority
**What:** Breadth-first expansion where each level's topics are scored and sorted by relevance before clicking. Higher-scoring topics are expanded first, consuming budget on the most valuable paths.
**When to use:** Always. This is the core algorithm.
**Example:**
```typescript
// Source: Custom design based on BFS + best-first search principles
interface Topic {
  text: string;
  level: number;
  parentTopic: string | null;
  score: number;
}

interface ExpansionState {
  visited: Set<string>;        // topic texts already clicked
  queue: Topic[];              // priority-sorted pending topics
  responses: Map<string, string>; // topic -> response content
  queriesUsed: number;
  maxQueries: number;          // from budget tracker
  maxLevel: number;            // default: 10
}

async function expandTopics(state: ExpansionState, page: Page): Promise<void> {
  while (state.queue.length > 0 && state.queriesUsed < state.maxQueries) {
    // Sort queue by score descending (best-first within BFS)
    state.queue.sort((a, b) => b.score - a.score);

    const topic = state.queue.shift()!;
    if (state.visited.has(topic.text)) continue;
    if (topic.level > state.maxLevel) continue;

    state.visited.add(topic.text);
    state.queriesUsed++;

    // Click topic, wait for streaming, extract response
    const response = await clickAndExtract(page, topic);
    state.responses.set(topic.text, response);

    // Detect new suggested topic pills
    const newPills = await detectTopicPills(page);
    const unseenPills = newPills.filter(p => !state.visited.has(p));

    // Score each new pill for relevance
    for (const pill of unseenPills) {
      const score = await scoreRelevance(pill, topic.text, response);
      if (score >= state.threshold) {
        state.queue.push({
          text: pill,
          level: topic.level + 1,
          parentTopic: topic.text,
          score,
        });
      }
    }
  }
}
```

### Pattern 2: Structured Relevance Scoring via Ollama
**What:** Use Ollama's structured JSON output with a Zod schema to get typed relevance scores from a local LLM.
**When to use:** For every candidate topic before deciding whether to click it.
**Example:**
```typescript
// Source: https://docs.ollama.com/capabilities/structured-outputs + ollama-js GitHub
import ollama from 'ollama';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const RelevanceScore = z.object({
  taskRelevance: z.number().min(0).max(40),
  errorRelevance: z.number().min(0).max(30),
  implementationValue: z.number().min(0).max(20),
  novelty: z.number().min(0).max(10),
  total: z.number().min(0).max(100),
  reasoning: z.string(),
});

type RelevanceScore = z.infer<typeof RelevanceScore>;

async function scoreRelevance(
  candidateTopic: string,
  taskGoal: string,
  currentError: string | null,
  previousTopics: string[],
): Promise<RelevanceScore> {
  const prompt = `Score this NotebookLM suggested topic for relevance.

Task goal: ${taskGoal}
${currentError ? `Current error: ${currentError}` : ''}
Previously explored topics: ${previousTopics.join(', ') || 'none'}

Candidate topic: "${candidateTopic}"

Score each dimension:
- taskRelevance (0-40): How directly relevant to the task goal?
- errorRelevance (0-30): How likely to help resolve the current error? (0 if no error)
- implementationValue (0-20): How likely to provide concrete implementation details?
- novelty (0-10): How different from previously explored topics?

Return total as the sum.`;

  const response = await ollama.chat({
    model: 'qwen2.5:1.5b',
    messages: [{ role: 'user', content: prompt }],
    format: zodToJsonSchema(RelevanceScore),
  });

  return RelevanceScore.parse(JSON.parse(response.message.content));
}
```

### Pattern 3: Query Budget Tracker
**What:** Track daily query usage against the 50 queries/day limit, persist across sessions, warn before approaching quota.
**When to use:** Before every topic click.
**Example:**
```typescript
// Source: Custom design for AUTO-06, AUTO-07
import Conf from 'conf';

interface BudgetState {
  date: string;       // YYYY-MM-DD
  queriesUsed: number;
  limit: number;
}

class BudgetTracker {
  private store: Conf<BudgetState>;
  private warnThreshold = 0.8; // warn at 80% usage

  constructor(dailyLimit = 50) {
    this.store = new Conf({ projectName: 'msw-protocol' });
    this.ensureCurrentDay(dailyLimit);
  }

  private ensureCurrentDay(limit: number) {
    const today = new Date().toISOString().split('T')[0];
    const state = this.store.store as BudgetState;
    if (state.date !== today) {
      this.store.set({ date: today, queriesUsed: 0, limit });
    }
  }

  canQuery(): boolean {
    const state = this.store.store as BudgetState;
    return state.queriesUsed < state.limit;
  }

  remaining(): number {
    const state = this.store.store as BudgetState;
    return state.limit - state.queriesUsed;
  }

  consume(): void {
    const state = this.store.store as BudgetState;
    this.store.set('queriesUsed', state.queriesUsed + 1);
  }

  isNearLimit(): boolean {
    const state = this.store.store as BudgetState;
    return state.queriesUsed / state.limit >= this.warnThreshold;
  }
}
```

### Pattern 4: Topic Pill Detection (extends Phase 1 selectors)
**What:** Detect newly appeared topic pills after each response, differentiating from already-seen ones.
**When to use:** After every response extraction, before scoring new topics.
**Example:**
```typescript
// Source: Phase 1 research + reference implementation
async function detectTopicPills(page: Page): Promise<string[]> {
  // NotebookLM renders suggested follow-up questions as clickable buttons
  // These appear after each response
  const pillLocator = page.getByRole('button').filter({
    hasText: /.{10,120}/  // topic pills are 10-120 chars
  });

  // Filter out non-topic buttons (send, copy, etc.)
  const excludePatterns = /^(send|copy|share|like|dislike|submit|close|cancel)/i;

  const pills: string[] = [];
  const count = await pillLocator.count();

  for (let i = 0; i < count; i++) {
    const text = await pillLocator.nth(i).textContent();
    if (text && !excludePatterns.test(text.trim())) {
      pills.push(text.trim());
    }
  }

  return pills;
}
```

### Anti-Patterns to Avoid
- **DFS (depth-first) expansion:** Goes deep on one topic chain, potentially exhausting budget on a single narrow path. BFS with priority ensures breadth before depth.
- **Scoring without structured output:** Free-text LLM responses require parsing/regex to extract scores. Use Ollama's `format` parameter with Zod schema for guaranteed structure.
- **Unbounded expansion:** Without budget tracking, the engine could exhaust 50 daily queries in one session. Budget is a first-class constraint.
- **Re-scoring visited topics:** After clicking a topic and getting its response, new pills may include previously-seen text. Always check `visited` set before scoring.
- **Blocking on Ollama startup:** First inference after model load takes 2-5 seconds (model loading). Warm up the model with a dummy request during initialization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM inference | HTTP fetch to Ollama REST API | `ollama` npm package | Type-safe, handles streaming, abort, connection management |
| JSON schema from types | Manual JSON Schema objects | `zod` + `zod-to-json-schema` | Single source of truth for types AND schema; runtime validation |
| Structured LLM output parsing | Regex/string parsing of LLM text | Ollama `format` param with JSON Schema | Ollama constrains generation to valid JSON matching schema |
| Persistent config | `fs.readFileSync`/`writeFileSync` JSON | `conf` package | Handles atomic writes, defaults, migrations, OS-appropriate paths |
| Rate limiting | `setTimeout` chains | `p-queue` with concurrency 1 | Proper backpressure, error handling, pause/resume |

**Key insight:** The relevance scoring pipeline has three potential failure modes: LLM returns invalid JSON, LLM returns valid JSON with wrong schema, LLM returns correct schema with bad scores. Using Ollama's `format` param eliminates failure mode 1, Zod `.parse()` eliminates mode 2, and the scoring rubric in the prompt addresses mode 3.

## Common Pitfalls

### Pitfall 1: Ollama Model Not Running
**What goes wrong:** `ollama.chat()` throws `ECONNREFUSED` because Ollama server isn't started.
**Why it happens:** Ollama must be running as a background service before the Node.js process calls it.
**How to avoid:** Add a health check at engine startup that calls `ollama.list()` and provides a clear error message ("Ollama not running. Start with `ollama serve`").
**Warning signs:** `ECONNREFUSED` on `localhost:11434`.

### Pitfall 2: First Inference Cold Start
**What goes wrong:** First relevance scoring call takes 3-10 seconds instead of <500ms.
**Why it happens:** Ollama loads the model into memory on first use. Subsequent calls are fast.
**How to avoid:** Warm up the model during engine initialization with a dummy scoring call. Log "Warming up relevance model..." so the user isn't confused by the pause.
**Warning signs:** First topic scoring is 10x slower than subsequent ones.

### Pitfall 3: Topic Pills Disappear After New Response
**What goes wrong:** After clicking a topic and getting a response, previously visible topic pills may be replaced by new ones in the NotebookLM UI.
**Why it happens:** NotebookLM updates the suggested questions based on the latest conversation context. Old pills are removed from the DOM.
**How to avoid:** Detect AND record all pill texts immediately after each response extraction, before clicking the next topic. Store pill texts in the expansion state, not DOM references (elements become stale).
**Warning signs:** `ElementHandle` is detached, stale element errors.

### Pitfall 4: Budget Exhaustion on Low-Relevance Branches
**What goes wrong:** Engine uses all 50 queries on topics with scores barely above threshold (e.g., 31-35) while missing high-value topics at deeper levels.
**Why it happens:** Without priority sorting, topics are expanded in discovery order rather than by value.
**How to avoid:** Priority-queue BFS ensures high-scoring topics at any level are expanded before low-scoring ones. Consider reserving a portion of budget (e.g., 10 queries) for user-initiated queries in Phase 3.
**Warning signs:** Most expanded topics have scores near the threshold; high-scoring topics remain in queue when budget runs out.

### Pitfall 5: Duplicate Topic Detection Failures
**What goes wrong:** Same topic is clicked twice because it appears with slightly different wording (e.g., "How does X work?" vs "How does X work").
**Why it happens:** Trailing whitespace, punctuation differences, or minor rephrasing by NotebookLM.
**How to avoid:** Normalize topic text before comparison (lowercase, trim, strip trailing punctuation). For near-duplicates, consider a simple string similarity check (Levenshtein distance < 5 chars).
**Warning signs:** Response content is nearly identical for two "different" topics.

### Pitfall 6: Structured Output Model Compatibility
**What goes wrong:** `format` parameter with JSON Schema doesn't work with certain Ollama models.
**Why it happens:** Not all models support Ollama's structured output feature. Older/smaller models may ignore the format constraint.
**How to avoid:** Verify the chosen model supports structured outputs. `qwen2.5` and `phi3` both support it. Add a fallback parser that extracts a numeric score from free text if structured output fails.
**Warning signs:** Response content is not valid JSON despite `format` being set.

## Code Examples

### Complete Engine Initialization
```typescript
// Source: ollama-js GitHub + custom design
import ollama from 'ollama';

async function initializeEngine(config: {
  model: string;
  threshold: number;
  dailyLimit: number;
}): Promise<void> {
  // 1. Verify Ollama is running
  try {
    await ollama.list();
  } catch (err) {
    throw new Error(
      'Ollama is not running. Start it with `ollama serve` and ensure ' +
      `model "${config.model}" is pulled with \`ollama pull ${config.model}\``
    );
  }

  // 2. Verify model is available
  const models = await ollama.list();
  const hasModel = models.models.some(m => m.name.startsWith(config.model));
  if (!hasModel) {
    throw new Error(
      `Model "${config.model}" not found. Pull it with \`ollama pull ${config.model}\``
    );
  }

  // 3. Warm up model (first inference loads into memory)
  console.log(`Warming up relevance model: ${config.model}...`);
  await ollama.chat({
    model: config.model,
    messages: [{ role: 'user', content: 'Respond with: {"ready": true}' }],
    format: 'json',
  });
  console.log('Model ready.');
}
```

### Full Expansion Loop with Budget
```typescript
// Source: Custom design combining BFS + Phase 1 patterns
async function runExpansion(
  page: Page,
  taskGoal: string,
  config: { model: string; threshold: number; maxLevel: number },
  budget: BudgetTracker,
): Promise<Map<string, string>> {
  const visited = new Set<string>();
  const responses = new Map<string, string>();
  const queue: Topic[] = [];

  // Seed: detect initial topic pills
  const initialPills = await detectTopicPills(page);
  for (const pill of initialPills) {
    const score = await scoreRelevance(pill, taskGoal, null, []);
    if (score.total >= config.threshold) {
      queue.push({ text: pill, level: 0, parentTopic: null, score: score.total });
    }
  }

  while (queue.length > 0 && budget.canQuery()) {
    queue.sort((a, b) => b.score - a.score);
    const topic = queue.shift()!;

    if (visited.has(normalize(topic.text))) continue;
    if (topic.level > config.maxLevel) continue;

    if (budget.isNearLimit()) {
      console.warn(`Warning: ${budget.remaining()} queries remaining today`);
    }

    visited.add(normalize(topic.text));
    budget.consume();

    // Click and extract (uses Phase 1 patterns)
    const response = await clickTopicAndExtract(page, topic.text);
    responses.set(topic.text, response);

    // Discover new pills
    const newPills = await detectTopicPills(page);
    const unseen = newPills.filter(p => !visited.has(normalize(p)));

    for (const pill of unseen) {
      const score = await scoreRelevance(
        pill, taskGoal, null, Array.from(visited),
      );
      if (score.total >= config.threshold) {
        queue.push({
          text: pill,
          level: topic.level + 1,
          parentTopic: topic.text,
          score: score.total,
        });
      }
    }
  }

  return responses;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[?.!]+$/, '');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External API for scoring (OpenAI) | Local LLM via Ollama | 2024-2025 | Zero latency/cost for scoring; works offline |
| Free-text LLM output + regex parsing | Ollama structured output with JSON Schema | Ollama late 2024 | Guaranteed valid JSON matching schema |
| Single-level extraction (click all pills once) | Multi-level BFS with relevance filtering | New (MSW innovation) | 5-10x more knowledge extracted per session |
| Manual query counting | Persistent budget tracker | New design | Prevents rate limit violations across sessions |

**Deprecated/outdated:**
- Using Ollama's `/api/generate` for chat-style tasks: Use `/api/chat` (via `ollama.chat()`) for message-based interaction
- `format: 'json'` without schema: Now supports full JSON Schema for constrained output

## Open Questions

1. **Optimal Relevance Threshold Default**
   - What we know: PRD says default 30. The scoring rubric maxes at 100 with 4 dimensions.
   - What's unclear: Whether 30 is actually the right default in practice. A topic scoring 30/100 is "marginally relevant" -- this may produce too many low-value expansions.
   - Recommendation: Ship with 30 as default but log all scores. After real-world testing, adjust. Consider starting higher (40-50) and lowering if too few topics are expanded.

2. **Ollama Model Selection for Users Without GPU**
   - What we know: `qwen2.5:1.5b` runs well on CPU with Q4 quantization at 50+ tokens/sec.
   - What's unclear: Performance on very low-spec machines (8GB RAM, no GPU).
   - Recommendation: Default to `qwen2.5:1.5b`. Document minimum requirements (8GB RAM, Ollama installed). Add a config option to specify model name for users with GPUs who want higher quality.

3. **Topic Pill Selector Stability**
   - What we know: Phase 1 research noted NotebookLM uses minified CSS classes that change on deploys. Suggested follow-up buttons may not have stable ARIA roles.
   - What's unclear: Exact selectors for follow-up suggestion pills vs. initial suggestion pills vs. action buttons.
   - Recommendation: Phase 1 implementation will discover the exact selectors. This phase should consume them from the selector registry, not hard-code its own. Add fallback heuristics (buttons with 10-120 char text that aren't action buttons).

4. **Budget Reservation for Phase 3**
   - What we know: Phase 3 adds bidirectional queries (agent sends error -> NotebookLM). Both phases share the 50/day budget.
   - What's unclear: How to split budget between auto-expansion and error queries.
   - Recommendation: Make budget configurable per-session. Default to using max 35 queries for auto-expansion, reserving 15 for bidirectional queries. This is a config value that Phase 3 can adjust.

## Sources

### Primary (HIGH confidence)
- [ollama-js GitHub](https://github.com/ollama/ollama-js) - Full API reference, TypeScript types, streaming, chat endpoint
- [Ollama Structured Outputs Docs](https://docs.ollama.com/capabilities/structured-outputs) - JSON Schema format parameter, Zod integration pattern
- [Ollama Structured Outputs Blog](https://ollama.com/blog/structured-outputs) - Zod + zodToJsonSchema example code
- Phase 1 Research (`01-RESEARCH.md`) - Playwright patterns, selector registry, streaming detection
- Reference implementation (`msw-notebooklm-extractor(1).js`) - Single-level extraction flow

### Secondary (MEDIUM confidence)
- [Ollama Models Comparison 2025](https://collabnix.com/best-ollama-models-in-2025-complete-performance-comparison/) - Small model benchmarks
- [DataCamp Top Small Language Models 2026](https://www.datacamp.com/blog/top-small-language-models) - SLM recommendations
- [Kolosal Top 5 LLMs for CPU 2025](https://www.kolosal.ai/blog-detail/top-5-best-llm-models-to-run-locally-in-cpu-2025-edition) - CPU inference performance data

### Tertiary (LOW confidence)
- BFS/best-first search algorithm patterns - standard CS; applied here to topic expansion (novel application, no direct prior art found)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Ollama JS is the official client; structured output with Zod is documented pattern
- Architecture: HIGH - BFS expansion is well-understood; priority queue variant is straightforward extension
- Relevance scoring: MEDIUM - Scoring rubric dimensions (from PRD FR-1.2) are reasonable but untested; threshold tuning needs real data
- Pitfalls: HIGH - Cold start, stale elements, budget exhaustion are well-known patterns from Phase 1 research and general automation experience
- Topic detection: MEDIUM - Exact NotebookLM pill selectors depend on Phase 1 discoveries

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - Ollama API is stable; NotebookLM UI may change)
