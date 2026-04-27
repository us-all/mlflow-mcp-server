import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

const tagSchema = z.object({ key: z.string(), value: z.string() });

// --- create-model-version ---

export const createModelVersionSchema = z.object({
  name: z.string().describe("Registered model name"),
  source: z.string().describe("Artifact source URI (e.g. 'runs:/<run_id>/model')"),
  runId: z.string().optional().describe("Source run ID"),
  tags: z.array(tagSchema).optional(),
  runLink: z.string().optional(),
  description: z.string().optional(),
});

export async function createModelVersion(params: z.infer<typeof createModelVersionSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/model-versions/create", {
    name: params.name,
    source: params.source,
    run_id: params.runId,
    tags: params.tags,
    run_link: params.runLink,
    description: params.description,
  });
}

// --- get-model-version ---

export const getModelVersionSchema = z.object({
  name: z.string(),
  version: z.string().describe("Model version (e.g. '1')"),
});

export async function getModelVersion(params: z.infer<typeof getModelVersionSchema>) {
  return mlflowClient.get("/model-versions/get", {
    name: params.name,
    version: params.version,
  });
}

// --- search-model-versions ---

export const searchModelVersionsSchema = z.object({
  filter: z.string().optional().describe("Filter expression (e.g. \"name='model_x'\")"),
  maxResults: z.coerce.number().optional().default(100),
  orderBy: z.array(z.string()).optional(),
  pageToken: z.string().optional(),
});

export async function searchModelVersions(params: z.infer<typeof searchModelVersionsSchema>) {
  return mlflowClient.get("/model-versions/search", {
    filter: params.filter,
    max_results: params.maxResults,
    order_by: params.orderBy ? params.orderBy.join(",") : undefined,
    page_token: params.pageToken,
  });
}

// --- update-model-version ---

export const updateModelVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

export async function updateModelVersion(params: z.infer<typeof updateModelVersionSchema>) {
  assertWriteAllowed();
  return mlflowClient.patch("/model-versions/update", {
    name: params.name,
    version: params.version,
    description: params.description,
  });
}

// --- delete-model-version ---

export const deleteModelVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export async function deleteModelVersion(params: z.infer<typeof deleteModelVersionSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete("/model-versions/delete", {
    name: params.name,
    version: params.version,
  });
}

// --- transition-model-version-stage ---

export const transitionModelVersionStageSchema = z.object({
  name: z.string(),
  version: z.string(),
  stage: z.enum(["None", "Staging", "Production", "Archived"]).describe("Target stage"),
  archiveExistingVersions: z.boolean().optional().describe("Archive any existing versions in this stage"),
});

export async function transitionModelVersionStage(params: z.infer<typeof transitionModelVersionStageSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/model-versions/transition-stage", {
    name: params.name,
    version: params.version,
    stage: params.stage,
    archive_existing_versions: params.archiveExistingVersions,
  });
}

// --- get-model-version-download-uri ---

export const getModelVersionDownloadUriSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export async function getModelVersionDownloadUri(params: z.infer<typeof getModelVersionDownloadUriSchema>) {
  return mlflowClient.get("/model-versions/get-download-uri", {
    name: params.name,
    version: params.version,
  });
}

// --- set-model-version-tag ---

export const setModelVersionTagSchema = z.object({
  name: z.string(),
  version: z.string(),
  key: z.string(),
  value: z.string(),
});

export async function setModelVersionTag(params: z.infer<typeof setModelVersionTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/model-versions/set-tag", {
    name: params.name,
    version: params.version,
    key: params.key,
    value: params.value,
  });
}

// --- delete-model-version-tag ---

export const deleteModelVersionTagSchema = z.object({
  name: z.string(),
  version: z.string(),
  key: z.string(),
});

export async function deleteModelVersionTag(params: z.infer<typeof deleteModelVersionTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete("/model-versions/delete-tag", {
    name: params.name,
    version: params.version,
    key: params.key,
  });
}
