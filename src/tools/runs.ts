import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed, resolveExperimentId } from "./utils.js";

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
});

export async function getRun(params: z.infer<typeof getRunSchema>) {
  return mlflowClient.get("/runs/get", { run_id: params.runId });
}

// --- search-runs ---

export const searchRunsSchema = z.object({
  experimentIds: z.array(z.string()).optional().describe("Experiment IDs to search (defaults to MLFLOW_EXPERIMENT_ID if set)"),
  filter: z.string().optional().describe("Filter expression (e.g. \"metrics.rmse < 1 and params.lr = '0.1'\")"),
  runViewType: z.enum(["ACTIVE_ONLY", "DELETED_ONLY", "ALL"]).optional(),
  maxResults: z.coerce.number().optional().default(100).describe("Max results (default 100, max 50000)"),
  orderBy: z.array(z.string()).optional().describe("Sort fields (e.g. ['metrics.rmse ASC'])"),
  pageToken: z.string().optional(),
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
