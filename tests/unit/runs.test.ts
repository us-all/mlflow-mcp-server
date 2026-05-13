import { afterEach, describe, expect, it, vi } from "vitest";
import { getRun, searchRuns } from "../../src/tools/runs.js";

function mockJsonFetch(body: unknown): void {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch);
}

describe("run tools", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies extractFields to get-run", async () => {
    mockJsonFetch({
      run: {
        info: { run_id: "r1", experiment_id: "0", status: "FINISHED" },
        data: { metrics: [{ key: "acc", value: 0.9 }], params: [{ key: "lr", value: "0.1" }] },
      },
    });

    await expect(getRun({ runId: "r1", extractFields: "run.info.run_id" })).resolves.toEqual({
      run: { info: { run_id: "r1" } },
    });
  });

  it("applies extractFields to search-runs", async () => {
    mockJsonFetch({
      runs: [
        { info: { run_id: "r1", status: "FINISHED" }, data: { metrics: [{ key: "acc", value: 0.9 }] } },
        { info: { run_id: "r2", status: "FAILED" }, data: { metrics: [{ key: "acc", value: 0.2 }] } },
      ],
      next_page_token: "next",
    });

    await expect(searchRuns({
      experimentIds: ["0"],
      maxResults: 100,
      extractFields: "runs.*.info.run_id,next_page_token",
    })).resolves.toEqual({
      runs: [{ info: { run_id: "r1" } }, { info: { run_id: "r2" } }],
      next_page_token: "next",
    });
  });
});
