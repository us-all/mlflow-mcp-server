import { z } from "zod/v4";
import { mlflowClient } from "../client.js";

/**
 * Aggregation tools — fetch run + metrics history + artifacts in a single call.
 *
 * Without aggregation, an LLM exploring a run typically needs 3-4 round-trips:
 *   1. get-run                  → run info + flat metrics + params
 *   2. get-metric-history       → time-series for each metric (N calls if many metrics)
 *   3. list-artifacts           → artifacts file list
 *   4. (optional) search-traces → linked traces
 *
 * `summarize-run` consolidates these into one response.
 */

const ef = z.string().optional().describe("Comma-separated dotted paths to project from response. Use `*` as wildcard.");

export const summarizeRunSchema = z.object({
  runId: z.string().describe("Run ID"),
  includeMetricHistory: z.boolean().optional().default(false).describe("Include time-series metric history (default false — set true for plot-ready data)"),
  metricKeys: z.array(z.string()).optional().describe("Specific metric keys to fetch history for (default: all metrics on the run)"),
  includeArtifacts: z.boolean().optional().default(true).describe("Include artifacts file list (default true)"),
  artifactPath: z.string().optional().describe("Optional sub-path within artifacts to list"),
  extractFields: ef,
});

interface RunData {
  run?: {
    info?: { run_id?: string };
    data?: { metrics?: Array<{ key: string; value: number; step?: number; timestamp?: number }>; params?: Array<{ key: string; value: string }>; tags?: Array<{ key: string; value: string }> };
  };
}

export async function summarizeRun(params: z.infer<typeof summarizeRunSchema>) {
  const runResp = await mlflowClient.get<RunData>("/runs/get", { run_id: params.runId });
  const run = runResp.run;

  const metricKeysToFetch = params.includeMetricHistory
    ? (params.metricKeys ?? run?.data?.metrics?.map((m) => m.key) ?? [])
    : [];

  const [history, artifacts] = await Promise.all([
    metricKeysToFetch.length > 0
      ? Promise.all(metricKeysToFetch.map(async (key) => {
          const r = await mlflowClient.get<{ metrics?: unknown[] }>("/metrics/get-history", {
            run_id: params.runId,
            metric_key: key,
          }).catch(() => null);
          return { key, history: r?.metrics ?? [] };
        }))
      : Promise.resolve(null),
    params.includeArtifacts
      ? mlflowClient.get("/artifacts/list", {
          run_id: params.runId,
          path: params.artifactPath,
        }).catch(() => ({ error: "artifacts unavailable" }))
      : Promise.resolve(null),
  ]);

  return {
    run,
    metricHistory: history,
    artifacts,
    summary: {
      paramsCount: run?.data?.params?.length ?? 0,
      metricsCount: run?.data?.metrics?.length ?? 0,
      tagsCount: run?.data?.tags?.length ?? 0,
      historyIncluded: !!history,
      artifactsIncluded: !!artifacts,
    },
  };
}
