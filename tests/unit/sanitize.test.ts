import { describe, it, expect } from "vitest";
import { wrapToolHandler } from "../../src/tools/utils.js";

// `sanitize` is internal — exercise it via wrapToolHandler error path.

describe("error sanitization via wrapToolHandler", () => {
  it("redacts Bearer tokens in error messages", async () => {
    const fn = async () => {
      throw new Error("Request failed: Bearer abc123def456");
    };
    const handler = wrapToolHandler(fn);
    const result = await handler({});
    const text = (result.content?.[0] as { text: string }).text;
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("abc123def456");
  });

  it("redacts Basic auth headers", async () => {
    const fn = async () => {
      throw new Error("auth failure: Basic dXNlcjpwYXNz");
    };
    const handler = wrapToolHandler(fn);
    const result = await handler({});
    const text = (result.content?.[0] as { text: string }).text;
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("dXNlcjpwYXNz");
  });

  it("redacts MLFLOW_TRACKING_TOKEN mention", async () => {
    const fn = async () => {
      throw new Error("MLFLOW_TRACKING_TOKEN was not accepted by server");
    };
    const handler = wrapToolHandler(fn);
    const result = await handler({});
    const text = (result.content?.[0] as { text: string }).text;
    expect(text).toContain("[REDACTED]");
  });

  it("returns isError:true on tool failure", async () => {
    const fn = async () => { throw new Error("boom"); };
    const handler = wrapToolHandler(fn);
    const result = await handler({});
    expect(result.isError).toBe(true);
  });

  it("returns successful result wrapped in MCP content", async () => {
    const fn = async () => ({ run_id: "abc", status: "FINISHED" });
    const handler = wrapToolHandler(fn);
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const text = (result.content?.[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.run_id).toBe("abc");
  });
});
