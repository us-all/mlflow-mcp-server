import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed, resolveExperimentId } from "./utils.js";

const ef = z.string().optional().describe("Comma-separated dotted paths to project from response (e.g. 'experiments.*.experiment_id,experiments.*.name'). Use `*` as wildcard. Reduces response tokens.");

const tagSchema = z.object({
  key: z.string(),
  value: z.string(),
});

// --- create-experiment ---

export const createExperimentSchema = z.object({
  name: z.string().describe("Experiment name (must be unique)"),
  artifactLocation: z.string().optional().describe("Artifact storage location URI"),
  tags: z.array(tagSchema).optional().describe("Tags to set on the experiment"),
});

export async function createExperiment(params: z.infer<typeof createExperimentSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/experiments/create", {
    name: params.name,
    artifact_location: params.artifactLocation,
    tags: params.tags,
  });
}

// --- search-experiments ---

export const searchExperimentsSchema = z.object({
  filter: z.string().optional().describe("Filter expression (e.g. \"name LIKE '%demo%'\")"),
  maxResults: z.coerce.number().optional().default(100).describe("Max results (default 100, max 50000)"),
  orderBy: z.array(z.string()).optional().describe("Sort fields (e.g. ['name ASC', 'last_update_time DESC'])"),
  pageToken: z.string().optional().describe("Pagination token from previous response"),
  viewType: z.enum(["ACTIVE_ONLY", "DELETED_ONLY", "ALL"]).optional().describe("Filter by lifecycle stage"),
  extractFields: ef,
});

export async function searchExperiments(params: z.infer<typeof searchExperimentsSchema>) {
  return mlflowClient.post("/experiments/search", {
    filter: params.filter,
    max_results: params.maxResults,
    order_by: params.orderBy,
    page_token: params.pageToken,
    view_type: params.viewType,
  });
}

// --- get-experiment ---

export const getExperimentSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID (defaults to MLFLOW_EXPERIMENT_ID)"),
  extractFields: ef,
});

export async function getExperiment(params: z.infer<typeof getExperimentSchema>) {
  return mlflowClient.get("/experiments/get", {
    experiment_id: resolveExperimentId(params.experimentId),
  });
}

// --- get-experiment-by-name ---

export const getExperimentByNameSchema = z.object({
  experimentName: z.string().describe("Experiment name"),
});

export async function getExperimentByName(params: z.infer<typeof getExperimentByNameSchema>) {
  return mlflowClient.get("/experiments/get-by-name", {
    experiment_name: params.experimentName,
  });
}

// --- delete-experiment ---

export const deleteExperimentSchema = z.object({
  experimentId: z.string().describe("Experiment ID to delete"),
});

export async function deleteExperiment(params: z.infer<typeof deleteExperimentSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/experiments/delete", {
    experiment_id: params.experimentId,
  });
}

// --- restore-experiment ---

export const restoreExperimentSchema = z.object({
  experimentId: z.string().describe("Experiment ID to restore"),
});

export async function restoreExperiment(params: z.infer<typeof restoreExperimentSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/experiments/restore", {
    experiment_id: params.experimentId,
  });
}

// --- update-experiment ---

export const updateExperimentSchema = z.object({
  experimentId: z.string().describe("Experiment ID"),
  newName: z.string().describe("New experiment name"),
});

export async function updateExperiment(params: z.infer<typeof updateExperimentSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/experiments/update", {
    experiment_id: params.experimentId,
    new_name: params.newName,
  });
}

// --- set-experiment-tag ---

export const setExperimentTagSchema = z.object({
  experimentId: z.string().describe("Experiment ID"),
  key: z.string().describe("Tag key"),
  value: z.string().describe("Tag value"),
});

export async function setExperimentTag(params: z.infer<typeof setExperimentTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/experiments/set-experiment-tag", {
    experiment_id: params.experimentId,
    key: params.key,
    value: params.value,
  });
}

// --- delete-experiment-tag ---

export const deleteExperimentTagSchema = z.object({
  experimentId: z.string().describe("Experiment ID"),
  key: z.string().describe("Tag key to delete"),
});

export async function deleteExperimentTag(params: z.infer<typeof deleteExperimentTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/experiments/delete-experiment-tag", {
    experiment_id: params.experimentId,
    key: params.key,
  });
}
