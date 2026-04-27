import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_URI = process.env.MLFLOW_TRACKING_URI;

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.MLFLOW_TRACKING_URI = ORIGINAL_URI;
    delete process.env.MLFLOW_ALLOW_WRITE;
  });

  it("validateConfig throws when MLFLOW_TRACKING_URI is empty", async () => {
    process.env.MLFLOW_TRACKING_URI = "";
    const { validateConfig } = await import("../../src/config.js");
    expect(() => validateConfig()).toThrow(/MLFLOW_TRACKING_URI/);
  });

  it("validateConfig passes when MLFLOW_TRACKING_URI is set", async () => {
    process.env.MLFLOW_TRACKING_URI = "http://example.com:5000";
    const { validateConfig } = await import("../../src/config.js");
    expect(() => validateConfig()).not.toThrow();
  });

  it("config.trackingUri strips trailing slashes", async () => {
    process.env.MLFLOW_TRACKING_URI = "http://example.com:5000///";
    const { config } = await import("../../src/config.js");
    expect(config.trackingUri).toBe("http://example.com:5000");
  });

  it("config.allowWrite defaults to false", async () => {
    process.env.MLFLOW_TRACKING_URI = "http://example.com";
    delete process.env.MLFLOW_ALLOW_WRITE;
    const { config } = await import("../../src/config.js");
    expect(config.allowWrite).toBe(false);
  });

  it("config.allowWrite is true only when MLFLOW_ALLOW_WRITE === 'true'", async () => {
    process.env.MLFLOW_TRACKING_URI = "http://example.com";

    process.env.MLFLOW_ALLOW_WRITE = "false";
    const m1 = await import("../../src/config.js");
    expect(m1.config.allowWrite).toBe(false);

    vi.resetModules();
    process.env.MLFLOW_ALLOW_WRITE = "1";
    const m2 = await import("../../src/config.js");
    expect(m2.config.allowWrite).toBe(false); // strict comparison

    vi.resetModules();
    process.env.MLFLOW_ALLOW_WRITE = "true";
    const m3 = await import("../../src/config.js");
    expect(m3.config.allowWrite).toBe(true);
  });
});
