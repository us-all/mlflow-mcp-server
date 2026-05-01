import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

/**
 * Model Registry Webhooks (MLflow 3.x)
 * REST endpoints under /api/2.0/mlflow/webhooks/*
 */

const eventEnum = z.enum([
  "REGISTERED_MODEL_CREATED",
  "MODEL_VERSION_CREATED",
  "MODEL_VERSION_TRANSITIONED_STAGE",
  "MODEL_VERSION_TRANSITIONED_TO_STAGING",
  "MODEL_VERSION_TRANSITIONED_TO_PRODUCTION",
  "MODEL_VERSION_TRANSITIONED_TO_ARCHIVED",
  "MODEL_VERSION_TAG_SET",
  "MODEL_VERSION_TAG_DELETED",
  "MODEL_VERSION_ALIAS_CREATED",
  "MODEL_VERSION_ALIAS_DELETED",
  "REGISTERED_MODEL_TAG_SET",
  "REGISTERED_MODEL_TAG_DELETED",
]);

// --- create-webhook ---

export const createWebhookSchema = z.object({
  name: z.string().describe("Human-readable webhook name"),
  events: z.array(eventEnum).describe("Event types this webhook should fire on"),
  url: z.string().describe("HTTPS endpoint to call when events occur"),
  description: z.string().optional().describe("Description of the webhook's purpose"),
  modelName: z.string().optional().describe("Restrict to events for a specific registered model name"),
  status: z.enum(["ACTIVE", "DISABLED"]).optional().default("ACTIVE").describe("Initial webhook status"),
  secret: z.string().optional().describe("HMAC signing secret for payload verification"),
});

export async function createWebhook(params: z.infer<typeof createWebhookSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/webhooks/create", {
    name: params.name,
    events: params.events,
    url: params.url,
    description: params.description,
    model_name: params.modelName,
    status: params.status,
    secret: params.secret,
  });
}

// --- list-webhooks ---

export const listWebhooksSchema = z.object({
  modelName: z.string().optional().describe("Filter by registered model name"),
  maxResults: z.coerce.number().optional().describe("Max results to return"),
  pageToken: z.string().optional().describe("Pagination token"),
});

export async function listWebhooks(params: z.infer<typeof listWebhooksSchema>) {
  return mlflowClient.get("/webhooks/list", {
    model_name: params.modelName,
    max_results: params.maxResults,
    page_token: params.pageToken,
  });
}

// --- get-webhook ---

export const getWebhookSchema = z.object({
  id: z.string().describe("Webhook ID"),
});

export async function getWebhook(params: z.infer<typeof getWebhookSchema>) {
  return mlflowClient.get("/webhooks/get", { id: params.id });
}

// --- update-webhook ---

export const updateWebhookSchema = z.object({
  id: z.string().describe("Webhook ID to update"),
  events: z.array(eventEnum).optional().describe("New event list (replaces existing)"),
  url: z.string().optional().describe("New URL"),
  description: z.string().optional().describe("New description"),
  status: z.enum(["ACTIVE", "DISABLED"]).optional().describe("New status"),
  secret: z.string().optional().describe("New signing secret"),
});

export async function updateWebhook(params: z.infer<typeof updateWebhookSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/webhooks/update", {
    id: params.id,
    events: params.events,
    url: params.url,
    description: params.description,
    status: params.status,
    secret: params.secret,
  });
}

// --- delete-webhook ---

export const deleteWebhookSchema = z.object({
  id: z.string().describe("Webhook ID to delete"),
});

export async function deleteWebhook(params: z.infer<typeof deleteWebhookSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete("/webhooks/delete", { id: params.id });
}

// --- test-webhook ---

export const testWebhookSchema = z.object({
  id: z.string().describe("Webhook ID to send a test event to"),
});

export async function testWebhook(params: z.infer<typeof testWebhookSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/webhooks/test", { id: params.id });
}
