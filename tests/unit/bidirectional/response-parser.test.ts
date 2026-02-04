// vitest globals enabled - no imports needed for describe/it/expect
import { parseCitations } from "../../../src/bidirectional/response-parser.js";

describe("parseCitations snapshots", () => {
  it("parses simple response with numeric citations", () => {
    const responseText = `
      Authentication uses OAuth 2.0 tokens for secure access [1].
      The system maintains session cookies across browser restarts [2].
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    // Also validate key behavior
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
    expect(result).toHaveLength(2);
  });

  it("parses response with named source citations", () => {
    const responseText = `
      MSW Protocol bridges NotebookLM and coding agents [Source: overview.md].
      The system uses browser automation with Playwright for stealth [Source: browser.md].
      Auto-conversation explores topics up to 5 levels deep [Source: auto-conversation.md].
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result).toContain("[Source: overview.md]");
    expect(result).toContain("[Source: browser.md]");
    expect(result).toContain("[Source: auto-conversation.md]");
    expect(result).toHaveLength(3);
  });

  it("parses response with 'according to' phrases", () => {
    const responseText = `
      According to the documentation, the system uses persistent Chrome profiles.
      Based on auth.md, session cookies are maintained automatically.
      As stated in browser.md, Playwright provides stealth capabilities.
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result.length).toBeGreaterThan(0);
  });

  it("parses complex response with mixed citation formats", () => {
    const responseText = `
      The MSW Protocol provides automated research capabilities [1] [2].
      According to the architecture docs, it uses three-tier testing [Testing Guide].
      Browser automation is handled by Playwright [Source: browser.md].
      As noted in config.md, settings are validated with Zod schemas [12].
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result.length).toBeGreaterThan(3);
  });

  it("handles response with code blocks and preserves citations", () => {
    const responseText = `
      Example TypeScript interface [1]:

      interface Config {
        version: string;
        notebookUrl: string;
      }

      This defines the configuration structure according to config.md.
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result).toContain("[1]");
  });

  it("handles response with lists and multiple citations", () => {
    const responseText = `
      Key features [Source: features.md]:
      - Browser automation with Playwright [1]
      - Auto-conversation engine [2]
      - Bidirectional communication [3]

      Based on the roadmap, testing is complete [Source: roadmap.md].
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result.length).toBeGreaterThan(3);
  });

  it("handles response with no citations", () => {
    const responseText = `
      This is a general response without specific sources.
      It contains useful information but no citations.
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result).toHaveLength(0);
  });

  it("deduplicates repeated citations", () => {
    const responseText = `
      The system uses OAuth tokens [1].
      Session management is critical [1].
      Authentication persists across sessions [1].
      According to auth.md, cookies are stored securely.
      Based on auth.md, the profile directory is persistent.
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    // Should deduplicate [1] and [auth.md]
    const count1 = result.filter((c) => c === "[1]").length;
    expect(count1).toBe(1);
  });

  it("handles empty input", () => {
    const result = parseCitations("");

    expect(result).toMatchSnapshot();
    expect(result).toHaveLength(0);
  });

  it("handles malformed citations gracefully", () => {
    const responseText = `
      Unclosed bracket citation [source
      Multiple opens [[nested]]
      Empty brackets []
      Very long citation [This is an extremely long citation that should probably be filtered out because it exceeds reasonable length limits for a source reference]
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    // Should extract [[nested]] but handle others gracefully
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("extracts citations from real NotebookLM-style responses", () => {
    const responseText = `
      MSW Protocol is an autonomous coding system that bridges NotebookLM and coding agents [1].

      The system has three main components:
      1. Browser automation layer using Playwright [Source: Browser Module]
      2. Auto-conversation engine for topic exploration [2]
      3. Bidirectional communication with MCP tools [Source: MCP Integration]

      According to the architecture docs, testing is done at three levels: unit, integration, and E2E [3].

      As stated in testing.md, coverage thresholds are enforced at 80%+ for critical paths.
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
    expect(result).toContain("[3]");
    expect(result).toContain("[Source: Browser Module]");
    expect(result).toContain("[Source: MCP Integration]");
  });

  it("handles unicode and special characters in citations", () => {
    const responseText = `
      The documentation mentions café settings [Source: config-café.md].
      According to 文档.md, internationalization is supported.
      Performance metrics are tracked [Source: metrics™.md].
    `;

    const result = parseCitations(responseText);

    expect(result).toMatchSnapshot();
    expect(result.length).toBeGreaterThan(0);
  });
});
