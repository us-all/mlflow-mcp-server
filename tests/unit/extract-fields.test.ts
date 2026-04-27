import { describe, it, expect } from "vitest";
import { applyExtractFields } from "../../src/tools/utils.js";

describe("applyExtractFields", () => {
  const data = {
    info: { trace_id: "tr-1", state: "OK", tags: { user: "alice", env: "prod" } },
    data: {
      spans: [
        { name: "respond", type: "AGENT", attrs: { latency_ms: 120 } },
        { name: "retrieve", type: "TOOL", attrs: { latency_ms: 30 } },
      ],
    },
    next_page_token: "abc",
  };

  it("returns input unchanged when expr is empty", () => {
    expect(applyExtractFields(data, "")).toBe(data);
    expect(applyExtractFields(data, undefined)).toBe(data);
  });

  it("selects a single dotted path", () => {
    const out = applyExtractFields(data, "info.trace_id") as any;
    expect(out).toEqual({ info: { trace_id: "tr-1" } });
  });

  it("selects multiple paths with comma", () => {
    const out = applyExtractFields(data, "info.trace_id,info.state") as any;
    expect(out).toEqual({ info: { trace_id: "tr-1", state: "OK" } });
  });

  it("expands wildcard over array elements", () => {
    const out = applyExtractFields(data, "data.spans.*.name") as any;
    expect(out).toEqual({ data: { spans: [{ name: "respond" }, { name: "retrieve" }] } });
  });

  it("merges multiple paths under same wildcard", () => {
    const out = applyExtractFields(data, "data.spans.*.name,data.spans.*.type") as any;
    expect(out).toEqual({
      data: {
        spans: [
          { name: "respond", type: "AGENT" },
          { name: "retrieve", type: "TOOL" },
        ],
      },
    });
  });

  it("expands wildcard over object values", () => {
    const out = applyExtractFields(data, "info.tags.*") as any;
    expect(out).toEqual({ info: { tags: { user: "alice", env: "prod" } } });
  });

  it("handles backticks for keys with dots", () => {
    const dotted = { info: { tags: { "mlflow.runName": "x", env: "prod" } } };
    const out = applyExtractFields(dotted, "info.tags.`mlflow.runName`") as any;
    expect(out).toEqual({ info: { tags: { "mlflow.runName": "x" } } });
  });

  it("ignores non-existent paths silently", () => {
    const out = applyExtractFields(data, "info.does_not_exist,info.trace_id") as any;
    expect(out).toEqual({ info: { trace_id: "tr-1" } });
  });

  it("returns scalar input unchanged", () => {
    expect(applyExtractFields("hello", "anything")).toBe("hello");
    expect(applyExtractFields(42, "anything")).toBe(42);
    expect(applyExtractFields(null, "anything")).toBe(null);
  });

  it("preserves nested wildcard", () => {
    const nested = { items: [{ tags: [{ k: "a" }, { k: "b" }] }, { tags: [{ k: "c" }] }] };
    const out = applyExtractFields(nested, "items.*.tags.*.k") as any;
    expect(out).toEqual({
      items: [
        { tags: [{ k: "a" }, { k: "b" }] },
        { tags: [{ k: "c" }] },
      ],
    });
  });
});
