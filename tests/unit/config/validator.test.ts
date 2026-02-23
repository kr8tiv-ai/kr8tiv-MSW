// vitest globals enabled - no import needed
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateConfig, loadConfig } from "../../../src/config/validator.js";

describe("config validator", () => {
  it("accepts config without notebookUrl", () => {
    const result = validateConfig({
      version: "0.1.0",
      relevanceThreshold: 60,
      maxDepth: 3,
      maxQueriesPerDay: 20,
    });

    expect(result.success).toBe(true);
  });

  it("loads config file that omits notebookUrl", () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "msw-validator-"));
    try {
      const mswDir = path.join(projectDir, ".msw");
      fs.mkdirSync(mswDir, { recursive: true });
      fs.writeFileSync(
        path.join(mswDir, "config.json"),
        JSON.stringify(
          {
            version: "0.1.0",
            relevanceThreshold: 55,
            maxDepth: 4,
            maxQueriesPerDay: 30,
          },
          null,
          2,
        ),
        "utf-8",
      );

      const loaded = loadConfig(projectDir);
      expect(loaded.version).toBe("0.1.0");
      expect(loaded.notebookUrl).toBeUndefined();
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
