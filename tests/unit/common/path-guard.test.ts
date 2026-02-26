import path from "node:path";

import { resolvePathWithinBase } from "../../../src/common/path-guard.js";

describe("resolvePathWithinBase", () => {
  it("resolves a relative path inside the base directory", () => {
    const baseDir = path.resolve("/tmp/msw-project");
    const resolved = resolvePathWithinBase(baseDir, ".msw/PRD.md");

    expect(resolved).toBe(path.resolve(baseDir, ".msw/PRD.md"));
  });

  it("rejects parent traversal outside the base directory", () => {
    const baseDir = path.resolve("/tmp/msw-project");
    const resolved = resolvePathWithinBase(baseDir, "../escape.md");

    expect(resolved).toBeNull();
  });

  it("rejects absolute paths outside the base directory", () => {
    const baseDir = path.resolve("/tmp/msw-project");
    const resolved = resolvePathWithinBase(baseDir, path.resolve("/tmp/other/escape.md"));

    expect(resolved).toBeNull();
  });

  it("rejects paths with null bytes", () => {
    const baseDir = path.resolve("/tmp/msw-project");
    const resolved = resolvePathWithinBase(baseDir, ".msw/\x00bad.md");

    expect(resolved).toBeNull();
  });
});
