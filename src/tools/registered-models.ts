import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

const tagSchema = z.object({ key: z.string(), value: z.string() });

// --- create-registered-model ---

export const createRegisteredModelSchema = z.object({
  name: z.string().describe("Registered model name (unique within registry)"),
  description: z.string().optional(),
  tags: z.array(tagSchema).optional(),
});

export async function createRegisteredModel(params: z.infer<typeof createRegisteredModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/registered-models/create", {
    name: params.name,
    description: params.description,
    tags: params.tags,
  });
}

// --- get-registered-model ---

export const getRegisteredModelSchema = z.object({
  name: z.string().describe("Registered model name"),
});

export async function getRegisteredModel(params: z.infer<typeof getRegisteredModelSchema>) {
  return mlflowClient.get("/registered-models/get", { name: params.name });
}

// --- search-registered-models ---

export const searchRegisteredModelsSchema = z.object({
  filter: z.string().optional().describe("Filter expression (e.g. \"name LIKE 'foo%'\")"),
  maxResults: z.coerce.number().optional().default(100),
  orderBy: z.array(z.string()).optional(),
  pageToken: z.string().optional(),
});

export async function searchRegisteredModels(params: z.infer<typeof searchRegisteredModelsSchema>) {
  return mlflowClient.get("/registered-models/search", {
    filter: params.filter,
    max_results: params.maxResults,
    order_by: params.orderBy ? params.orderBy.join(",") : undefined,
    page_token: params.pageToken,
  });
}

// --- rename-registered-model ---

export const renameRegisteredModelSchema = z.object({
  name: z.string().describe("Current name"),
  newName: z.string().describe("New name"),
});

export async function renameRegisteredModel(params: z.infer<typeof renameRegisteredModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/registered-models/rename", {
    name: params.name,
    new_name: params.newName,
  });
}

// --- update-registered-model ---

export const updateRegisteredModelSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export async function updateRegisteredModel(params: z.infer<typeof updateRegisteredModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.patch("/registered-models/update", {
    name: params.name,
    description: params.description,
  });
}

// --- delete-registered-model ---

export const deleteRegisteredModelSchema = z.object({
  name: z.string().describe("Registered model name to delete"),
});

export async function deleteRegisteredModel(params: z.infer<typeof deleteRegisteredModelSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete("/registered-models/delete", { name: params.name });
}

// --- get-latest-model-versions ---

export const getLatestModelVersionsSchema = z.object({
  name: z.string().describe("Registered model name"),
  stages: z.array(z.string()).optional().describe("Stages to query (e.g. ['Production', 'Staging'])"),
});

export async function getLatestModelVersions(params: z.infer<typeof getLatestModelVersionsSchema>) {
  return mlflowClient.post("/registered-models/get-latest-versions", {
    name: params.name,
    stages: params.stages,
  });
}

// --- set-registered-model-tag ---

export const setRegisteredModelTagSchema = z.object({
  name: z.string(),
  key: z.string(),
  value: z.string(),
});

export async function setRegisteredModelTag(params: z.infer<typeof setRegisteredModelTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/registered-models/set-tag", {
    name: params.name,
    key: params.key,
    value: params.value,
  });
}

// --- delete-registered-model-tag ---

export const deleteRegisteredModelTagSchema = z.object({
  name: z.string(),
  key: z.string(),
});

export async function deleteRegisteredModelTag(params: z.infer<typeof deleteRegisteredModelTagSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete("/registered-models/delete-tag", {
    name: params.name,
    key: params.key,
  });
}

// --- set-registered-model-alias ---

export const setRegisteredModelAliasSchema = z.object({
  name: z.string(),
  alias: z.string().describe("Alias name (e.g. 'champion')"),
  version: z.string().describe("Model version to point alias at"),
});

export async function setRegisteredModelAlias(params: z.infer<typeof setRegisteredModelAliasSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/registered-models/alias", {
    name: params.name,
    alias: params.alias,
    version: params.version,
  });
}

// --- delete-registered-model-alias ---

export const deleteRegisteredModelAliasSchema = z.object({
  name: z.string(),
  alias: z.string(),
});

export async function deleteRegisteredModelAlias(params: z.infer<typeof deleteRegisteredModelAliasSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete("/registered-models/alias", {
    name: params.name,
    alias: params.alias,
  });
}

// --- get-model-version-by-alias ---

export const getModelVersionByAliasSchema = z.object({
  name: z.string(),
  alias: z.string(),
});

export async function getModelVersionByAlias(params: z.infer<typeof getModelVersionByAliasSchema>) {
  return mlflowClient.get("/registered-models/alias", {
    name: params.name,
    alias: params.alias,
  });
}
