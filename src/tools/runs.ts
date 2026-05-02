import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { applyExtractFields, assertWriteAllowed, resolveExperimentId } from "./utils.js";

const ef = z.string().optional().describe("Comma-separated dotted paths with `*` wildcard (e.g. 'runs.*.info.run_id'). Reduces response tokens.");

const tagSchema = z.object({ key: z.string(), value: z.string() });
const metricSchema = z.object({
  key: z.string(),
  value: z.number(),
  timestamp: z.number(),
  step: z.number().optional(),
});
const paramSchema = z.object({ key: z.string(), value: z.string() });

// --- create-run ---

export const createRunSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID (defaults to MLFLOW_EXPERIMENT_ID)"),
  startTime: z.number().optional().describe("Unix timestamp (ms) of run start"),
  runName: z.string().optional().describe("Optional run name"),
  tags: z.array(tagSchema).optional().describe("Initial tags"),
});

export async function createRun(params: z.infer<typeof createRunSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/create", {
    experiment_id: resolveExperimentId(params.experimentId),
    start_time: params.startTime ?? Date.now(),
    run_name: params.runName,
    tags: params.tags,
  });
}

// --- get-run ---

export const getRunSchema = z.object({
  runId: z.string().describe("Run ID"),
  extractFields: ef,
});

export async function getRun(params: z.infer<typeof getRunSchema>) {
  const data = await mlflowClient.get("/runs/get", { run_id: params.runId });
  if (params.extractFields) return data;
  return applyExtractFields(
    data,
    "run.info.run_id,run.info.experiment_id,run.info.status,run.info.start_time,run.info.end_time,run.data.metrics,run.data.params,run.data.tags",
  );
}

// --- search-runs ---

export const searchRunsSchema = z.object({
  experimentIds: z.array(z.string()).optional().describe("Experiment IDs (defaults to MLFLOW_EXPERIMENT_ID)"),
  filter: z.string().optional().describe("Filter expression, e.g. \"metrics.rmse < 1\""),
  runViewType: z.enum(["ACTIVE_ONLY", "DELETED_ONLY", "ALL"]).optional(),
  maxResults: z.coerce.number().optional().default(100).describe("Max results (default 100)"),
  orderBy: z.array(z.string()).optional().describe("Sort fields, e.g. ['metrics.rmse ASC']"),
  pageToken: z.string().optional(),
  extractFields: ef,
});

export async function searchRuns(params: z.infer<typeof searchRunsSchema>) {
  const ids = params.experimentIds && params.experimentIds.length > 0
    ? params.experimentIds
    : [resolveExperimentId()];
  return mlflowClient.post("/runs/search", {
    experiment_ids: ids,
    filter: params.filter,
    run_view_type: params.runViewType,
    max_results: params.maxResults,
    order_by: params.orderBy,
    page_token: params.pageToken,
  });
}

// --- update-run ---

export const updateRunSchema = z.object({
  runId: z.string().describe("Run ID"),
  status: z.enum(["RUNNING", "SCHEDULED", "FINISHED", "FAILED", "KILLED"]).optional(),
  endTime: z.number().optional().describe("Unix timestamp (ms) of run end"),
  runName: z.string().optional(),
});

export async function updateRun(params: z.infer<typeof updateRunSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/update", {
    run_id: params.runId,
    status: params.status,
    end_time: params.endTime,
    run_name: params.runName,
  });
}

// --- delete-run ---

export const deleteRunSchema = z.object({
  runId: z.string().describe("Run ID to delete"),
});

export async function deleteRun(params: z.infer<typeof deleteRunSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/delete", { run_id: params.runId });
}

// --- restore-run ---

export const restoreRunSchema = z.object({
  runId: z.string().describe("Run ID to restore"),
});

export async function restoreRun(params: z.infer<typeof restoreRunSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/restore", { run_id: params.runId });
}

// --- log-metric ---

export const logMetricSchema = z.object({
  runId: z.string(),
  key: z.string().describe("Metric name"),
  value: z.number().describe("Metric value"),
  timestamp: z.number().optional().describe("Unix timestamp ms (defaults to now)"),
  step: z.number().optional().describe("Step at which metric was recorded"),
});

export async function logMetric(params: z.infer<typeof logMetricSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/log-metric", {
    run_id: params.runId,
    key: params.key,
    value: params.value,
    timestamp: params.timestamp ?? Date.now(),
    step: params.step,
  });
}

// --- log-param ---

export const logParamSchema = z.object({
  runId: z.string(),
  key: z.string().describe("Param name"),
  value: z.string().describe("Param value (string)"),
});

export async function logParam(params: z.infer<typeof logParamSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/log-parameter", {
    run_id: params.runId,
    key: params.key,
    value: params.value,
  });
}

// --- log-batch ---

export const logBatchSchema = z.object({
  runId: z.string(),
  metrics: z.array(metricSchema).optional(),
  params: z.array(paramSchema).optional(),
  tags: z.array(tagSchema).optional(),
});

export async function logBatch(params: z.infer<typeof logBatchSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/log-batch", {
    run_id: params.runId,
    metrics: params.metrics,
    params: params.params,
    tags: params.tags,
  });
}

// --- log-inputs ---

export const logInputsSchema = z.object({
  runId: z.string(),
  datasets: z.array(z.record(z.string(), z.any())).describe("Dataset input records"),
});

export async function logInputs(params: z.infer<typeof logInputsSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/log-inputs", {
    run_id: params.runId,
    datasets: params.datasets,
  });
}

// --- get-metric-history ---

export const getMetricHistorySchema = z.object({
  runId: z.string(),
  metricKey: z.string().describe("Metric name"),
  pageToken: z.string().optional(),
  maxResults: z.coerce.number().optional(),
});

export async function getMetricHistory(params: z.infer<typeof getMetricHistorySchema>) {
  return mlflowClient.get("/metrics/get-history", {
    run_id: params.runId,
    metric_key: params.metricKey,
    page_token: params.pageToken,
    max_results: params.maxResults,
  });
}

// --- set-run-tag ---

export const setRunTagSchema = z.object({
  runId: z.string(),
  key: z.string(),
  value: z.string(),
});

export async function setRunTag(params: z.infer<typeof setRunTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/set-tag", {
    run_id: params.runId,
    key: params.key,
    value: params.value,
  });
}

// --- delete-run-tag ---

export const deleteRunTagSchema = z.object({
  runId: z.string(),
  key: z.string(),
});

export async function deleteRunTag(params: z.infer<typeof deleteRunTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/runs/delete-tag", {
    run_id: params.runId,
    key: params.key,
  });
}

// --- list-artifacts ---

export const listArtifactsSchema = z.object({
  runId: z.string(),
  path: z.string().optional().describe("Optional sub-path within the run's artifact directory"),
  pageToken: z.string().optional(),
});

export async function listArtifacts(params: z.infer<typeof listArtifactsSchema>) {
  return mlflowClient.get("/artifacts/list", {
    run_id: params.runId,
    path: params.path,
    page_token: params.pageToken,
  });
}

// --- get-best-run (convenience) ---
//
// Searches an experiment for the run with the best value of a given metric.
// Higher = better unless `ascending` is true (e.g. minimizing loss).
//
// Composed of /runs/search; no extra MLflow endpoint.

export const getBestRunSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID (defaults to MLFLOW_EXPERIMENT_ID)"),
  metric: z.string().describe("Metric key to optimize on (e.g. 'accuracy', 'loss')"),
  ascending: z.boolean().optional().default(false).describe("True to minimize (e.g. loss); default maximizes"),
  filter: z.string().optional().describe("Additional filter on top of metric ordering"),
});

interface SearchRunsResponse {
  runs?: Array<{ info?: { run_id?: string }; data?: unknown }>;
}

export async function getBestRun(params: z.infer<typeof getBestRunSchema>) {
  const expId = resolveExperimentId(params.experimentId);
  const direction = params.ascending ? "ASC" : "DESC";
  const result = await mlflowClient.post<SearchRunsResponse>("/runs/search", {
    experiment_ids: [expId],
    filter: params.filter,
    max_results: 1,
    order_by: [`metrics.${params.metric} ${direction}`],
  });
  const top = result.runs?.[0];
  if (!top) {
    return { run: null, message: `No runs matched in experiment ${expId}` };
  }
  return { run: top, ranked_by: params.metric, direction };
}

// --- compare-runs (convenience) ---
//
// Fetches multiple runs and produces a side-by-side summary of their metrics
// and parameters. Diff/identical helpers are calculated client-side.

export const compareRunsSchema = z.object({
  runIds: z.array(z.string()).min(2).describe("Run IDs to compare (>= 2)"),
  metricKeys: z.array(z.string()).optional().describe("Restrict to specific metric keys"),
  paramKeys: z.array(z.string()).optional().describe("Restrict to specific parameter keys"),
});

interface RunResponse {
  run?: {
    info?: Record<string, unknown>;
    data?: {
      metrics?: Array<{ key: string; value: number; step?: number }>;
      params?: Array<{ key: string; value: string }>;
      tags?: Array<{ key: string; value: string }>;
    };
  };
}

export async function compareRuns(params: z.infer<typeof compareRunsSchema>) {
  const fetched = await Promise.all(
    params.runIds.map((runId) => mlflowClient.get<RunResponse>("/runs/get", { run_id: runId })),
  );

  const metrics: Record<string, Record<string, number | null>> = {};
  const paramsTable: Record<string, Record<string, string | null>> = {};
  const summary: Array<{ run_id: string; status?: unknown; run_name?: unknown; start_time?: unknown }> = [];

  for (let i = 0; i < params.runIds.length; i++) {
    const runId = params.runIds[i];
    const r = fetched[i].run;
    summary.push({
      run_id: runId,
      run_name: r?.info?.run_name,
      status: r?.info?.status,
      start_time: r?.info?.start_time,
    });
    for (const m of r?.data?.metrics ?? []) {
      if (params.metricKeys && !params.metricKeys.includes(m.key)) continue;
      metrics[m.key] = metrics[m.key] ?? {};
      metrics[m.key][runId] = m.value;
    }
    for (const p of r?.data?.params ?? []) {
      if (params.paramKeys && !params.paramKeys.includes(p.key)) continue;
      paramsTable[p.key] = paramsTable[p.key] ?? {};
      paramsTable[p.key][runId] = p.value;
    }
  }

  // Fill missing entries with null so each row has every run column.
  for (const runId of params.runIds) {
    for (const m of Object.keys(metrics)) if (!(runId in metrics[m])) metrics[m][runId] = null;
    for (const p of Object.keys(paramsTable)) if (!(runId in paramsTable[p])) paramsTable[p][runId] = null;
  }

  // Identify params that differ across runs — useful diff signal.
  const differingParams = Object.entries(paramsTable)
    .filter(([, row]) => new Set(Object.values(row)).size > 1)
    .map(([k]) => k);

  return {
    runs: summary,
    metrics,
    params: paramsTable,
    differing_params: differingParams,
  };
}

// --- search-runs-by-tags (convenience) ---
//
// Composes a `tags.<key> = "<value>"` filter from a key/value object.

export const searchRunsByTagsSchema = z.object({
  experimentIds: z.array(z.string()).optional().describe("Experiment IDs (defaults to MLFLOW_EXPERIMENT_ID)"),
  tags: z.record(z.string(), z.string()).describe("Tag key/value pairs to AND together"),
  maxResults: z.coerce.number().optional().default(100),
  orderBy: z.array(z.string()).optional(),
});

export async function searchRunsByTags(params: z.infer<typeof searchRunsByTagsSchema>) {
  const ids = params.experimentIds && params.experimentIds.length > 0
    ? params.experimentIds
    : [resolveExperimentId()];
  const filter = Object.entries(params.tags)
    .map(([k, v]) => `tags.\`${k}\` = "${v.replace(/"/g, '\\"')}"`)
    .join(" and ");
  return mlflowClient.post("/runs/search", {
    experiment_ids: ids,
    filter,
    max_results: params.maxResults,
    order_by: params.orderBy,
  });
}
