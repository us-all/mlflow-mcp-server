import { z } from "zod/v4";
import { applyExtractFields } from "@us-all/mcp-toolkit";
import { mlflowClient } from "../client.js";

// Default projection for summarize-experiment topRuns: drop per-metric
// step+timestamp noise (these belong on get-metric-history, not on a
// snapshot view). params/tags pass through (already minimal {key,value}).
const SUMMARIZE_EXPERIMENT_DEFAULT_FIELDS = [
  "experiment",
  "topRuns.*.run_id",
  "topRuns.*.status",
  "topRuns.*.start_time",
  "topRuns.*.end_time",
  "topRuns.*.metrics.*.key",
  "topRuns.*.metrics.*.value",
  "topRuns.*.params",
  "topRuns.*.tags",
  "metricStats",
  "totalRunsApprox",
  "caveats",
].join(",");

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
          const r = await mlflowClient.get<{ metrics?: Array<Record<string, unknown>> }>("/metrics/get-history", {
            run_id: params.runId,
            metric_key: key,
            // MLflow 3.x requires max_results — without it the API returns only
            // next_page_token (no `metrics` field), which silently produces an
            // empty history. 25000 is the documented per-page maximum.
            max_results: 25000,
          }).catch(() => null);
          // Drop redundant `key` from each point — it's already on the wrapper.
          // For a 4k-point series this trims ~100KB of noise.
          const history = (r?.metrics ?? []).map(({ key: _k, ...rest }) => rest);
          return { key, history };
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
      // `artifacts` may be `{ error: "..." }` when the MLflow tracking server
      // can't list (e.g. GCS-backed without proxy creds). Reflect actual fetch
      // success, not just whether the include flag was set.
      artifactsIncluded: !!artifacts && !(artifacts as { error?: unknown }).error,
    },
  };
}

/**
 * `summarize-experiment` — one call returns experiment overview + top runs +
 * metric stats. Replaces 3-5 sequential calls (get-experiment → search-runs →
 * get-best-run × N → metric history) when an LLM is exploring an experiment.
 */

export const summarizeExperimentSchema = z.object({
  experimentId: z.string().describe("Experiment ID"),
  topN: z.coerce.number().int().min(1).max(20).optional().describe("Number of top runs to return (default 5, max 20)"),
  metric: z.string().optional().describe("Metric key to sort topN by; if omitted, sorts by start_time DESC"),
  ascending: z.string().optional().describe("'true' or 'false' (default 'false'). Only meaningful when metric is set."),
  extractFields: ef,
});

interface ExperimentResponse {
  experiment?: {
    experiment_id?: string;
    name?: string;
    lifecycle_stage?: string;
    artifact_location?: string;
    tags?: Array<{ key: string; value: string }>;
  };
}

interface SearchRunsAggResponse {
  runs?: Array<{
    info?: {
      run_id?: string;
      status?: string;
      start_time?: number;
      end_time?: number;
    };
    data?: {
      metrics?: Array<{ key: string; value: number; step?: number; timestamp?: number }>;
      params?: Array<{ key: string; value: string }>;
      tags?: Array<{ key: string; value: string }>;
    };
  }>;
  next_page_token?: string;
}

export async function summarizeExperiment(params: z.infer<typeof summarizeExperimentSchema>) {
  const topN = params.topN ?? 5;
  const ascending = params.ascending === "true";
  const orderBy = params.metric
    ? [`metrics.${params.metric} ${ascending ? "ASC" : "DESC"}`]
    : ["attributes.start_time DESC"];

  const caveats: string[] = [];

  const [expResult, runsResult] = await Promise.allSettled([
    mlflowClient.get<ExperimentResponse>("/experiments/get", { experiment_id: params.experimentId }),
    mlflowClient.post<SearchRunsAggResponse>("/runs/search", {
      experiment_ids: [params.experimentId],
      max_results: topN,
      order_by: orderBy,
    }),
  ]);

  let experiment: {
    experimentId?: string;
    name?: string;
    lifecycleStage?: string;
    artifactLocation?: string;
    tags?: Array<{ key: string; value: string }>;
  } | null = null;
  if (expResult.status === "fulfilled") {
    const e = expResult.value.experiment;
    experiment = {
      experimentId: e?.experiment_id,
      name: e?.name,
      lifecycleStage: e?.lifecycle_stage,
      artifactLocation: e?.artifact_location,
      tags: e?.tags,
    };
  } else {
    caveats.push(`get-experiment failed: ${(expResult.reason as Error)?.message ?? "unknown error"}`);
  }

  let topRuns: Array<{
    run_id?: string;
    status?: string;
    start_time?: number;
    end_time?: number;
    metrics?: Array<{ key: string; value: number; step?: number; timestamp?: number }>;
    params?: Array<{ key: string; value: string }>;
    tags?: Array<{ key: string; value: string }>;
  }> = [];
  let totalRunsApprox: number | null = null;
  if (runsResult.status === "fulfilled") {
    const runs = runsResult.value.runs ?? [];
    topRuns = runs.map((r) => ({
      run_id: r.info?.run_id,
      status: r.info?.status,
      start_time: r.info?.start_time,
      end_time: r.info?.end_time,
      metrics: r.data?.metrics,
      params: r.data?.params,
      tags: r.data?.tags,
    }));
    // If a next_page_token exists, more runs are available than topN — can't
    // determine total cheaply without paging.
    totalRunsApprox = runsResult.value.next_page_token ? null : topRuns.length;
  } else {
    caveats.push(`search-runs failed: ${(runsResult.reason as Error)?.message ?? "unknown error"}`);
  }

  // Compute metric stats only when a metric is provided. Skipped entirely
  // otherwise — no cheap way to pick a "default" metric across heterogeneous
  // runs, and computing on every metric would explode the response.
  let metricStats: { metric: string; min: number; max: number; mean: number; count: number } | null = null;
  if (params.metric) {
    const values: number[] = [];
    for (const r of topRuns) {
      const m = r.metrics?.find((x) => x.key === params.metric);
      if (m && typeof m.value === "number") values.push(m.value);
    }
    if (values.length > 0) {
      const sum = values.reduce((acc, v) => acc + v, 0);
      metricStats = {
        metric: params.metric,
        min: Math.min(...values),
        max: Math.max(...values),
        mean: sum / values.length,
        count: values.length,
      };
    } else {
      caveats.push(`metric '${params.metric}' not found on any of the topN runs`);
    }
  }

  if (totalRunsApprox === null && runsResult.status === "fulfilled") {
    caveats.push(`More than ${topN} runs exist in this experiment; totalRunsApprox is unavailable without paging`);
  }

  const result = {
    experiment,
    topRuns,
    metricStats,
    totalRunsApprox,
    caveats,
  };
  // If caller supplied extractFields, return raw — wrapToolHandler projects.
  // Otherwise apply default projection to drop metric step+timestamp noise.
  if (params.extractFields) return result;
  return applyExtractFields(result, SUMMARIZE_EXPERIMENT_DEFAULT_FIELDS);
}
