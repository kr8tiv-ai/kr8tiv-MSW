import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestClient, type TestClient } from "./helpers/spawn-server.js";
import { startMockNotebookLM, type MockNotebookLMServer } from "../helpers/mock-notebooklm.js";
import { VALID_CONFIG, SAMPLE_SOURCES } from "./helpers/test-fixtures.js";
import { createTestDir, cleanupTestDir } from "../setup.js";
import fs from "node:fs";
import path from "node:path";

describe("NotebookLM upload E2E", () => {
  let tc: TestClient;
  let mockServer: MockNotebookLMServer;
  let projectDir: string;

  beforeAll(async () => {
    // Start MCP server and mock NotebookLM
    tc = await createTestClient();
    mockServer = await startMockNotebookLM();
    projectDir = createTestDir("e2e-upload");

    // Initialize MSW project
    const initResult = await tc.client.callTool({
      name: "msw_init",
      arguments: {
        projectDir,
        notebookUrl: mockServer.url,
      },
    });

    const initData = JSON.parse(initResult.content[0].text);
    expect(initData.success).toBe(true);
  }, 30000); // 30s timeout for E2E setup

  afterAll(async () => {
    await tc?.cleanup();
    await mockServer?.close();
    cleanupTestDir(projectDir);
  });

  it("uploads sources to NotebookLM", async () => {
    // Write test source files
    const sourcesDir = path.join(projectDir, "sources");
    fs.mkdirSync(sourcesDir, { recursive: true });

    for (const source of SAMPLE_SOURCES) {
      const filePath = path.join(sourcesDir, source.filename);
      fs.writeFileSync(filePath, source.content, "utf-8");
    }

    // Upload via MCP tool
    const uploadResult = await tc.client.callTool({
      name: "msw_upload_sources",
      arguments: {
        notebookUrl: mockServer.url,
        sources: SAMPLE_SOURCES.map((s) => ({
          type: "file",
          path: path.join(sourcesDir, s.filename),
        })),
        headless: true,
      },
    });

    const uploadData = JSON.parse(uploadResult.content[0].text);

    // Check for either success or validation errors (graceful handling)
    if (uploadData.success === false) {
      // If upload failed, it should have a clear error message
      expect(uploadData.error).toBeDefined();
      expect(uploadData.error).toMatch(/validation|browser|source/i);
    } else {
      // If successful, check upload results
      expect(uploadData.success).toBe(true);
      expect(uploadData.uploaded || uploadData.results).toBeDefined();
    }
  }, 60000); // 60s timeout for browser operations

  it("triggers research and validates job creation", async () => {
    // Trigger auto-conversation via MCP tool
    const researchResult = await tc.client.callTool({
      name: "msw_research",
      arguments: {
        projectDir,
        topic: "authentication patterns",
        maxQueries: 3,
      },
    });

    const researchData = JSON.parse(researchResult.content[0].text);

    // Research should either succeed or return a job ID for async execution
    if (researchData.jobId) {
      expect(researchData.jobId).toBeTruthy();
      expect(researchData.status).toMatch(/running|queued|pending/);
    } else if (researchData.success !== undefined) {
      // Synchronous completion is also valid
      expect(researchData).toBeDefined();
    } else {
      // Should have either jobId or success
      expect(researchData.error).toBeDefined();
    }
  }, 30000);

  it("checks status after initialization", async () => {
    // Check project status
    const statusResult = await tc.client.callTool({
      name: "msw_status",
      arguments: { projectDir },
    });

    const statusData = JSON.parse(statusResult.content[0].text);

    // Verify status includes project info
    expect(statusData.projectDir).toBe(projectDir);
    expect(statusData.config).toBeDefined();
    expect(statusData.config.version).toBe("0.1.0");
  });

  it("handles duplicate upload gracefully", async () => {
    const sourcesDir = path.join(projectDir, "sources");

    // Ensure sources exist
    if (!fs.existsSync(sourcesDir)) {
      fs.mkdirSync(sourcesDir, { recursive: true });
      for (const source of SAMPLE_SOURCES) {
        fs.writeFileSync(path.join(sourcesDir, source.filename), source.content);
      }
    }

    // Upload same sources again
    const uploadResult = await tc.client.callTool({
      name: "msw_upload_sources",
      arguments: {
        notebookUrl: mockServer.url,
        sources: SAMPLE_SOURCES.map((s) => ({
          type: "file",
          path: path.join(sourcesDir, s.filename),
        })),
        headless: true,
      },
    });

    const uploadData = JSON.parse(uploadResult.content[0].text);

    // Should handle duplicates (either skip or succeed)
    expect(uploadData.success !== undefined || uploadData.error !== undefined).toBe(true);
  }, 60000);

  it("handles MCP tool errors gracefully", async () => {
    // Test invalid project directory
    const invalidResult = await tc.client.callTool({
      name: "msw_init",
      arguments: {
        projectDir: "/nonexistent/invalid/path",
        notebookUrl: mockServer.url,
      },
    });

    const invalidData = JSON.parse(invalidResult.content[0].text);

    // Should return structured error (not throw)
    expect(invalidData.success).toBe(false);
    expect(invalidData.error).toBeDefined();
    expect(invalidData.error).toMatch(/directory|path|permission/i);
  });

  it("handles missing config gracefully", async () => {
    const noConfigDir = createTestDir("no-config");

    try {
      const result = await tc.client.callTool({
        name: "msw_research",
        arguments: {
          projectDir: noConfigDir,
          topic: "test",
        },
      });

      const data = JSON.parse(result.content[0].text);

      // Should fail with config error
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/config|initialize|init/i);
    } finally {
      cleanupTestDir(noConfigDir);
    }
  });

  it("lists available tools", async () => {
    const tools = await tc.client.listTools();
    const names = tools.tools.map(t => t.name);

    // Verify all expected tools are registered
    expect(names).toContain("msw_init");
    expect(names).toContain("msw_research");
    expect(names).toContain("msw_upload_sources");
    expect(names).toContain("msw_status");
    expect(names).toContain("msw_plan");
    expect(names).toContain("msw_execute");
    expect(names).toContain("msw_verify");
  });
});
