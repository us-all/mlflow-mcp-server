import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { applyExtractFields, assertWriteAllowed, resolveExperimentId } from "./utils.js";

// --- search-traces ---

export const searchTracesSchema = z.object({
  experimentIds: z.array(z.string()).optional().describe("Experiment IDs (defaults to MLFLOW_EXPERIMENT_ID)"),
  filter: z.string().optional().describe("Filter expression, e.g. \"tags.user = 'alice'\""),
  maxResults: z.coerce.number().optional().default(100).describe("Max results (default 100)"),
  orderBy: z.array(z.string()).optional(),
  pageToken: z.string().optional(),
  extractFields: z.string().optional().describe(
    "Comma-separated dotted paths with `*` wildcard, e.g. \"traces.*.trace_id\".",
  ),
});

export async function searchTraces(params: z.infer<typeof searchTracesSchema>) {
  const ids = params.experimentIds && params.experimentIds.length > 0
    ? params.experimentIds
    : [resolveExperimentId()];
  const result = await mlflowClient.post("/api/3.0/mlflow/traces/search", {
    locations: ids.map((experiment_id) => ({
      type: "MLFLOW_EXPERIMENT",
      mlflow_experiment: { experiment_id },
    })),
    filter: params.filter,
    max_results: params.maxResults,
    order_by: params.orderBy,
    page_token: params.pageToken,
  });
  if (params.extractFields) return applyExtractFields(result, params.extractFields);
  // Default projection: keep core trace identifiers/timing/status. Covers both
  // flat (v3) and nested `trace_info.*` shapes; missing paths are silently ignored.
  return applyExtractFields(
    result,
    "traces.*.trace_id,traces.*.experiment_id,traces.*.timestamp_ms,traces.*.execution_time_ms,traces.*.status,traces.*.trace_location,traces.*.request_time,traces.*.execution_duration,traces.*.state,traces.*.trace_info.trace_id,traces.*.trace_info.experiment_id,traces.*.trace_info.timestamp_ms,traces.*.trace_info.execution_time_ms,traces.*.trace_info.status,next_page_token",
  );
}

// --- get-trace ---

export const getTraceSchema = z.object({
  traceId: z.string().describe("Trace ID"),
  extractFields: z.string().optional().describe(
    "Comma-separated dotted paths with `*` wildcard, e.g. \"trace.data.spans.*.name\".",
  ),
});

export async function getTrace(params: z.infer<typeof getTraceSchema>) {
  const result = await mlflowClient.get(
    `/api/3.0/mlflow/traces/${encodeURIComponent(params.traceId)}`,
  );
  return applyExtractFields(result, params.extractFields);
}

// --- get-trace-info ---

export const getTraceInfoSchema = z.object({
  traceId: z.string().describe("Trace ID"),
});

export async function getTraceInfo(params: z.infer<typeof getTraceInfoSchema>) {
  return mlflowClient.get(`/api/2.0/mlflow/traces/${encodeURIComponent(params.traceId)}/info`);
}

// --- delete-traces ---

export const deleteTracesSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID (defaults to MLFLOW_EXPERIMENT_ID)"),
  traceIds: z.array(z.string()).optional().describe("Specific trace IDs to delete"),
  maxTimestampMillis: z.number().optional().describe("Delete traces older than this timestamp (ms)"),
  maxTraces: z.number().optional().describe("Maximum number of traces to delete"),
});

export async function deleteTraces(params: z.infer<typeof deleteTracesSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/api/2.0/mlflow/traces/delete-traces", {
    experiment_id: resolveExperimentId(params.experimentId),
    request_ids: params.traceIds,
    max_timestamp_millis: params.maxTimestampMillis,
    max_traces: params.maxTraces,
  });
}

// --- set-trace-tag ---

export const setTraceTagSchema = z.object({
  traceId: z.string(),
  key: z.string().describe("Tag key"),
  value: z.string().describe("Tag value"),
});

export async function setTraceTag(params: z.infer<typeof setTraceTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.patch(
    `/api/2.0/mlflow/traces/${encodeURIComponent(params.traceId)}/tags`,
    { key: params.key, value: params.value },
  );
}

// --- delete-trace-tag ---

export const deleteTraceTagSchema = z.object({
  traceId: z.string(),
  key: z.string().describe("Tag key to remove"),
});

export async function deleteTraceTag(params: z.infer<typeof deleteTraceTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete(
    `/api/2.0/mlflow/traces/${encodeURIComponent(params.traceId)}/tags`,
    { key: params.key },
  );
}

// --- list-trace-attachments (MLflow 3.9+) ---
//
// Read-only. The endpoint and response shape are not formally documented in the
// public MLflow REST reference at the time of writing — we pass through whatever
// the server returns. Callers will get a 404 from older MLflow versions.

export const listTraceAttachmentsSchema = z.object({
  traceId: z.string().describe("Trace ID"),
});

export async function listTraceAttachments(params: z.infer<typeof listTraceAttachmentsSchema>) {
  return mlflowClient.get(
    `/api/3.0/mlflow/traces/${encodeURIComponent(params.traceId)}/attachments`,
  );
}

// --- get-trace-attachment (MLflow 3.9+) ---

export const getTraceAttachmentSchema = z.object({
  traceId: z.string().describe("Trace ID"),
  attachmentId: z.string().describe("Attachment ID"),
});

export async function getTraceAttachment(params: z.infer<typeof getTraceAttachmentSchema>) {
  return mlflowClient.get(
    `/api/3.0/mlflow/traces/${encodeURIComponent(params.traceId)}/attachments/${encodeURIComponent(params.attachmentId)}`,
  );
}
