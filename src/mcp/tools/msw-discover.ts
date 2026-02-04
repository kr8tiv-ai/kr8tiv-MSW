import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createLogger } from "../../logging/index.js";
import { checkProviders, research } from "../../llm/router.js";

const logger = createLogger('msw-discover');

interface ProjectContext {
  name: string;
  technologies: string[];
  dependencies: string[];
  description: string;
}

interface DiscoveryResult {
  topics: string[];
  libraries: string[];
  suggestedSources: string[];
  reasoning: string;
}

interface NotebookLibraryEntry {
  id: string;
  url: string;
  name: string;
  description: string;
  topics: string[];
  use_cases: string[];
}

interface MswConfig {
  initialized: string;
  notebookUrl?: string;
  notebookUrls?: string[];
  discoveryComplete?: boolean;
  discoveredTopics?: string[];
  version: string;
}

/**
 * Check if user is authenticated (has Chrome profile with cookies)
 */
function checkAuthentication(projectDir: string): { authenticated: boolean; profilePath: string; reason?: string } {
  const profilePath = path.join(projectDir, ".msw", "chrome_profile");

  if (!fs.existsSync(profilePath)) {
    return {
      authenticated: false,
      profilePath,
      reason: "Chrome profile not found. Run msw_init first to authenticate.",
    };
  }

  // Check for cookie file (indicates successful login)
  const cookiesPath = path.join(profilePath, "Default", "Cookies");
  const localStatePath = path.join(profilePath, "Local State");

  if (!fs.existsSync(cookiesPath) && !fs.existsSync(localStatePath)) {
    return {
      authenticated: false,
      profilePath,
      reason: "No cookies found. Authentication may have failed.",
    };
  }

  return { authenticated: true, profilePath };
}

/**
 * Analyze project to understand context
 */
function analyzeProject(projectDir: string): ProjectContext {
  const context: ProjectContext = {
    name: path.basename(projectDir),
    technologies: [],
    dependencies: [],
    description: "",
  };

  // Check package.json
  const packagePath = path.join(projectDir, "package.json");
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      context.name = pkg.name || context.name;
      context.description = pkg.description || "";

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      context.dependencies = Object.keys(deps);

      // Detect technologies
      if (deps.react) context.technologies.push("React");
      if (deps.vue) context.technologies.push("Vue");
      if (deps.angular) context.technologies.push("Angular");
      if (deps.next) context.technologies.push("Next.js");
      if (deps.express) context.technologies.push("Express");
      if (deps.fastify) context.technologies.push("Fastify");
      if (deps.typescript) context.technologies.push("TypeScript");
      if (deps.prisma) context.technologies.push("Prisma");
      if (deps.mongoose) context.technologies.push("MongoDB");
      if (deps.playwright || deps.puppeteer) context.technologies.push("Browser Automation");
    } catch (err) {
      logger.warn({ error: err }, "Failed to parse package.json");
    }
  }

  // Check for Python
  const requirementsPath = path.join(projectDir, "requirements.txt");
  const pyprojectPath = path.join(projectDir, "pyproject.toml");
  if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath)) {
    context.technologies.push("Python");
  }

  // Check for Rust
  const cargoPath = path.join(projectDir, "Cargo.toml");
  if (fs.existsSync(cargoPath)) {
    context.technologies.push("Rust");
  }

  // Check for Go
  const goModPath = path.join(projectDir, "go.mod");
  if (fs.existsSync(goModPath)) {
    context.technologies.push("Go");
  }

  return context;
}

/**
 * Use LLM to discover relevant topics and libraries
 */
async function discoverTopicsAndLibraries(
  context: ProjectContext,
  userGoal: string
): Promise<DiscoveryResult> {
  const providers = await checkProviders();

  if (providers.preferred === 'none') {
    // Fallback: return basic topics based on technologies
    return {
      topics: context.technologies.map(t => `${t} best practices`),
      libraries: context.dependencies.slice(0, 10),
      suggestedSources: [
        "Official documentation for your main framework",
        "GitHub repositories with similar implementations",
        "Stack Overflow threads on common issues",
      ],
      reasoning: "No LLM available. Using basic technology-based discovery.",
    };
  }

  const prompt = `You are a technical research assistant. Given this project context, suggest:
1. Key topics to research for creating comprehensive documentation
2. Important libraries and tools to include
3. Suggested documentation sources to add to a NotebookLM notebook

Project: ${context.name}
Description: ${context.description || "No description"}
Technologies: ${context.technologies.join(", ") || "Unknown"}
Dependencies: ${context.dependencies.slice(0, 20).join(", ") || "None detected"}
User's Goal: ${userGoal}

Return JSON in this exact format (no markdown):
{
  "topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "libraries": ["lib1", "lib2", "lib3"],
  "suggestedSources": ["source URL or description 1", "source URL or description 2"],
  "reasoning": "Brief explanation of why these were chosen"
}`;

  try {
    const response = await research(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DiscoveryResult;
    }
  } catch (err) {
    logger.warn({ error: err }, "LLM discovery failed");
  }

  // Fallback if LLM fails
  return {
    topics: [
      `${context.name} architecture`,
      ...context.technologies.slice(0, 3).map(t => `${t} patterns`),
      userGoal,
    ],
    libraries: context.dependencies.slice(0, 5),
    suggestedSources: [
      "Official documentation",
      "GitHub examples",
      "Community tutorials",
    ],
    reasoning: "LLM discovery failed, using fallback suggestions.",
  };
}

/**
 * Find existing notebooks that match project topics
 */
function findMatchingNotebooks(
  topics: string[],
  libraryPath: string
): NotebookLibraryEntry[] {
  if (!fs.existsSync(libraryPath)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(libraryPath, "utf-8"));
    if (!data.notebooks || !Array.isArray(data.notebooks)) {
      return [];
    }

    const topicsLower = topics.map(t => t.toLowerCase());

    return data.notebooks.filter((notebook: NotebookLibraryEntry) => {
      const notebookTopics = notebook.topics.map(t => t.toLowerCase());
      const notebookDesc = notebook.description.toLowerCase();

      return topics.some(topic => {
        const topicLower = topic.toLowerCase();
        return notebookTopics.some(nt => nt.includes(topicLower) || topicLower.includes(nt)) ||
               notebookDesc.includes(topicLower);
      });
    });
  } catch (err) {
    logger.warn({ error: err, path: libraryPath }, "Failed to read notebook library");
    return [];
  }
}

/**
 * Get the NotebookLM library path
 */
function getNotebookLibraryPath(): string {
  const possiblePaths = [
    path.join(os.homedir(), 'AppData', 'Local', 'notebooklm-mcp', 'Data', 'library.json'),
    path.join(os.homedir(), '.local', 'share', 'notebooklm-mcp', 'library.json'),
    path.join(os.homedir(), 'Library', 'Application Support', 'notebooklm-mcp', 'library.json'),
    path.join(os.homedir(), '.notebooklm-mcp', 'library.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return possiblePaths[0]; // Return default even if not found
}

export function registerMswDiscover(server: McpServer): void {
  server.tool(
    "msw_discover",
    "Intelligent discovery workflow: analyze project, search for relevant docs/libraries, find/create notebooks. REQUIRED before msw_research.",
    {
      projectDir: z.string().describe("Absolute path to the project directory"),
      goal: z.string().describe("What are you trying to build or accomplish?"),
      skipAuthCheck: z.boolean().optional().default(false).describe("Skip authentication check (testing only)"),
    },
    async ({ projectDir, goal, skipAuthCheck }) => {
      try {
        const mswDir = path.join(projectDir, ".msw");
        const configPath = path.join(mswDir, "config.json");

        // 1. Check if initialized
        if (!fs.existsSync(configPath)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "Project not initialized",
                action: "Run msw_init first to set up authentication and create config.",
                command: `msw_init projectDir="${projectDir}"`,
              }),
            }],
            isError: true,
          };
        }

        // 2. Check authentication
        if (!skipAuthCheck) {
          const authStatus = checkAuthentication(projectDir);
          if (!authStatus.authenticated) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: "Authentication required",
                  reason: authStatus.reason,
                  action: "Run msw_init to complete Google authentication for NotebookLM access.",
                  profilePath: authStatus.profilePath,
                }),
              }],
              isError: true,
            };
          }
          logger.info({ profilePath: authStatus.profilePath }, "Authentication verified");
        }

        // 3. Analyze project
        console.log("[msw] Analyzing project context...");
        const context = analyzeProject(projectDir);
        logger.info({ context }, "Project context analyzed");

        // 4. Discover topics and libraries using LLM
        console.log("[msw] Discovering relevant topics and libraries...");
        const discovery = await discoverTopicsAndLibraries(context, goal);
        logger.info({ discovery }, "Discovery complete");

        // 5. Find matching notebooks in library
        const libraryPath = getNotebookLibraryPath();
        const matchingNotebooks = findMatchingNotebooks(discovery.topics, libraryPath);
        logger.info({ count: matchingNotebooks.length }, "Found matching notebooks");

        // 6. Update config with discovery results
        const existingConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as MswConfig;
        const updatedConfig: MswConfig = {
          ...existingConfig,
          discoveryComplete: true,
          discoveredTopics: discovery.topics,
          notebookUrls: matchingNotebooks.length > 0
            ? [...new Set([...existingConfig.notebookUrls || [], ...matchingNotebooks.map(n => n.url)])]
            : existingConfig.notebookUrls,
        };

        fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
        logger.info({ configPath }, "Config updated with discovery results");

        // 7. Return comprehensive result
        const result = {
          success: true,
          projectContext: {
            name: context.name,
            technologies: context.technologies,
            dependencyCount: context.dependencies.length,
          },
          discovery: {
            topics: discovery.topics,
            libraries: discovery.libraries,
            suggestedSources: discovery.suggestedSources,
            reasoning: discovery.reasoning,
          },
          notebooks: {
            found: matchingNotebooks.length,
            entries: matchingNotebooks.map(n => ({
              id: n.id,
              name: n.name,
              topics: n.topics,
            })),
            libraryPath,
          },
          nextSteps: matchingNotebooks.length > 0
            ? [
                "Discovery complete! You can now run msw_research.",
                `Found ${matchingNotebooks.length} relevant notebook(s) already in your library.`,
              ]
            : [
                "No matching notebooks found.",
                "Create a new notebook at https://notebooklm.google.com with these sources:",
                ...discovery.suggestedSources.slice(0, 3),
                "Then add it with: msw_notebook_add",
              ],
          readyForResearch: matchingNotebooks.length > 0,
        };

        console.log(`[msw] Discovery complete: ${discovery.topics.length} topics, ${matchingNotebooks.length} notebooks`);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ error: message }, "Discovery failed");
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}
