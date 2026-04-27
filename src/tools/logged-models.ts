import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed, resolveExperimentId } from "./utils.js";

const tagSchema = z.object({ key: z.string(), value: z.string() });
const paramSchema = z.object({ key: z.string(), value: z.string() });

const base = "/api/2.0/mlflow/logged-models";
const byId = (id: string) => `${base}/${encodeURIComponent(id)}`;

// --- create-logged-model ---

export const createLoggedModelSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID (defaults to MLFLOW_EXPERIMENT_ID)"),
  name: z.string().optional().describe("Model name (auto-generated if omitted)"),
  modelType: z.string().optional().describe("Framework / type, e.g. 'sklearn', 'transformers'"),
  sourceRunId: z.string().optional().describe("Run ID this model was produced by"),
  params: z.array(paramSchema).optional(),
  tags: z.array(tagSchema).optional(),
});

export async function createLoggedModel(params: z.infer<typeof createLoggedModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.post(base, {
    experiment_id: resolveExperimentId(params.experimentId),
    name: params.name,
    model_type: params.modelType,
    source_run_id: params.sourceRunId,
    params: params.params,
    tags: params.tags,
  });
}

// --- search-logged-models ---

export const searchLoggedModelsSchema = z.object({
  experimentIds: z.array(z.string()).optional().describe("Experiment IDs (defaults to MLFLOW_EXPERIMENT_ID)"),
  filter: z.string().optional().describe("Filter expression"),
  maxResults: z.coerce.number().optional().default(100),
  orderBy: z.array(z.object({
    field_name: z.string(),
    ascending: z.boolean().optional(),
  })).optional().describe("Sort spec, e.g. [{field_name: 'creation_timestamp', ascending: false}]"),
  pageToken: z.string().optional(),
});

export async function searchLoggedModels(params: z.infer<typeof searchLoggedModelsSchema>) {
  const ids = params.experimentIds && params.experimentIds.length > 0
    ? params.experimentIds
    : [resolveExperimentId()];
  return mlflowClient.post(`${base}/search`, {
    experiment_ids: ids,
    filter: params.filter,
    max_results: params.maxResults,
    order_by: params.orderBy,
    page_token: params.pageToken,
  });
}

// --- get-logged-model ---

export const getLoggedModelSchema = z.object({
  modelId: z.string().describe("Logged model ID (e.g. 'm-...')"),
  allowDeleted: z.boolean().optional().describe("Include soft-deleted models"),
});

export async function getLoggedModel(params: z.infer<typeof getLoggedModelSchema>) {
  return mlflowClient.get(byId(params.modelId), {
    allow_deleted: params.allowDeleted,
  });
}

// --- finalize-logged-model ---

const LOGGED_MODEL_STATUS = {
  PENDING: 1,
  READY: 2,
  FAILED: 3,
  UPLOAD_FAILED: 4,
} as const;

export const finalizeLoggedModelSchema = z.object({
  modelId: z.string(),
  status: z.enum(["PENDING", "READY", "FAILED", "UPLOAD_FAILED"]).describe("Terminal status to set on the logged model"),
});

export async function finalizeLoggedModel(params: z.infer<typeof finalizeLoggedModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.patch(byId(params.modelId), {
    model_id: params.modelId,
    status: LOGGED_MODEL_STATUS[params.status],
  });
}

// --- delete-logged-model ---

export const deleteLoggedModelSchema = z.object({
  modelId: z.string(),
});

export async function deleteLoggedModel(params: z.infer<typeof deleteLoggedModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete(byId(params.modelId));
}

// --- set-logged-model-tags ---

export const setLoggedModelTagsSchema = z.object({
  modelId: z.string(),
  tags: z.array(tagSchema).describe("Tags to set/upsert"),
});

export async function setLoggedModelTags(params: z.infer<typeof setLoggedModelTagsSchema>) {
  assertWriteAllowed();
  return mlflowClient.patch(`${byId(params.modelId)}/tags`, { tags: params.tags });
}

// --- delete-logged-model-tag ---

export const deleteLoggedModelTagSchema = z.object({
  modelId: z.string(),
  key: z.string().describe("Tag key to delete"),
});

export async function deleteLoggedModelTag(params: z.infer<typeof deleteLoggedModelTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete(`${byId(params.modelId)}/tags/${encodeURIComponent(params.key)}`);
}

// --- log-logged-model-params ---

export const logLoggedModelParamsSchema = z.object({
  modelId: z.string(),
  params: z.array(paramSchema).describe("Params to log on the model"),
});

export async function logLoggedModelParams(params: z.infer<typeof logLoggedModelParamsSchema>) {
  assertWriteAllowed();
  return mlflowClient.post(`${byId(params.modelId)}/params`, {
    model_id: params.modelId,
    params: params.params,
  });
}
