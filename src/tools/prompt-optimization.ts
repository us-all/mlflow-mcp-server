import { z } from "zod/v4";
import { mlflowClient } from "../client.js";
import { assertWriteAllowed, resolveExperimentId } from "./utils.js";

/**
 * Prompt Optimization Jobs (MLflow 3.x GenAI)
 * REST endpoints under /api/3.0/mlflow/prompt-optimization/jobs
 */

// --- create-prompt-optimization-job ---

export const createPromptOptimizationJobSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID (defaults to MLFLOW_EXPERIMENT_ID if unset)"),
  sourcePromptUri: z.string().describe("URI of the source prompt to optimize (e.g. 'prompts:/my_prompt/1')"),
  config: z.record(z.string(), z.unknown()).optional().describe("Optimizer configuration object (algorithm, dataset, scorers, etc.)"),
  tags: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe("Tags to attach to the job"),
});

export async function createPromptOptimizationJob(params: z.infer<typeof createPromptOptimizationJobSchema>) {
  assertWriteAllowed();
  return mlflowClient.post("/api/3.0/mlflow/prompt-optimization/jobs", {
    experiment_id: resolveExperimentId(params.experimentId),
    source_prompt_uri: params.sourcePromptUri,
    config: params.config,
    tags: params.tags,
  });
}

// --- get-prompt-optimization-job ---

export const getPromptOptimizationJobSchema = z.object({
  jobId: z.string().describe("Prompt optimization job ID"),
});

export async function getPromptOptimizationJob(params: z.infer<typeof getPromptOptimizationJobSchema>) {
  return mlflowClient.get(`/api/3.0/mlflow/prompt-optimization/jobs/${encodeURIComponent(params.jobId)}`);
}

// --- search-prompt-optimization-jobs ---

export const searchPromptOptimizationJobsSchema = z.object({
  experimentId: z.string().optional().describe("Experiment ID to scope the search (defaults to MLFLOW_EXPERIMENT_ID)"),
  filter: z.string().optional().describe("Filter expression"),
  maxResults: z.coerce.number().optional().describe("Max jobs to return"),
  pageToken: z.string().optional().describe("Pagination token"),
});

export async function searchPromptOptimizationJobs(params: z.infer<typeof searchPromptOptimizationJobsSchema>) {
  return mlflowClient.post("/api/3.0/mlflow/prompt-optimization/jobs/search", {
    experiment_id: resolveExperimentId(params.experimentId),
    filter: params.filter,
    max_results: params.maxResults,
    page_token: params.pageToken,
  });
}

// --- cancel-prompt-optimization-job ---

export const cancelPromptOptimizationJobSchema = z.object({
  jobId: z.string().describe("Prompt optimization job ID to cancel"),
});

export async function cancelPromptOptimizationJob(params: z.infer<typeof cancelPromptOptimizationJobSchema>) {
  assertWriteAllowed();
  return mlflowClient.post(`/api/3.0/mlflow/prompt-optimization/jobs/${encodeURIComponent(params.jobId)}/cancel`);
}

// --- delete-prompt-optimization-job ---

export const deletePromptOptimizationJobSchema = z.object({
  jobId: z.string().describe("Prompt optimization job ID to delete"),
});

export async function deletePromptOptimizationJob(params: z.infer<typeof deletePromptOptimizationJobSchema>) {
  assertWriteAllowed();
  return mlflowClient.delete(`/api/3.0/mlflow/prompt-optimization/jobs/${encodeURIComponent(params.jobId)}`);
}
