import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "../../src/tool-registry.js";

describe("ToolRegistry", () => {
  let r: ToolRegistry;

  beforeEach(() => {
    r = new ToolRegistry();
    r.register("create-experiment", "Create a new MLflow experiment", "experiments");
    r.register("search-runs", "Search runs with filter", "runs");
    r.register("create-run", "Create a new run", "runs");
    r.register("create-registered-model", "Register a model", "registry");
    r.register("search-traces", "Search traces", "traces");
    r.register("create-webhook", "Register a webhook", "webhooks");
  });

  it("matches by tool name token", () => {
    expect(r.search("run").map((m) => m.name)).toContain("search-runs");
    expect(r.search("run").map((m) => m.name)).toContain("create-run");
  });

  it("respects category filter", () => {
    const matches = r.search("create", "registry");
    expect(matches.map((m) => m.name)).toEqual(["create-registered-model"]);
  });

  it("ranks name matches higher than description", () => {
    const matches = r.search("run");
    expect(matches[0].name).toMatch(/run/);
  });

  it("summary breakdown", () => {
    const s = r.summary();
    expect(s.total).toBe(6);
    expect(s.categoryBreakdown.runs).toBe(2);
  });
});
