#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startMcpServer } from "@us-all/mcp-toolkit/runtime";
import { inferToolAnnotations } from "@us-all/mcp-toolkit";
import { validateConfig } from "./config.js";
import { wrapToolHandler } from "./tools/utils.js";
import { registerPrompts } from "./prompts.js";

// Read version from package.json so MCP `serverInfo.version` stays in sync with
// the published npm version. Source path is `src/index.ts` and built path is
// `dist/index.js` — both resolve `../package.json` to the package root.
const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const { version: pkgVersion } = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };

import {
  createExperimentSchema, createExperiment,
  searchExperimentsSchema, searchExperiments,
  getExperimentSchema, getExperiment,
  getExperimentByNameSchema, getExperimentByName,
  deleteExperimentSchema, deleteExperiment,
  restoreExperimentSchema, restoreExperiment,
  updateExperimentSchema, updateExperiment,
  setExperimentTagSchema, setExperimentTag,
  deleteExperimentTagSchema, deleteExperimentTag,
} from "./tools/experiments.js";
import {
  createRunSchema, createRun,
  getRunSchema, getRun,
  searchRunsSchema, searchRuns,
  updateRunSchema, updateRun,
  deleteRunSchema, deleteRun,
  restoreRunSchema, restoreRun,
  logMetricSchema, logMetric,
  logParamSchema, logParam,
  logBatchSchema, logBatch,
  logInputsSchema, logInputs,
  getMetricHistorySchema, getMetricHistory,
  setRunTagSchema, setRunTag,
  deleteRunTagSchema, deleteRunTag,
  listArtifactsSchema, listArtifacts,
  getBestRunSchema, getBestRun,
  compareRunsSchema, compareRuns,
  searchRunsByTagsSchema, searchRunsByTags,
} from "./tools/runs.js";
import {
  createRegisteredModelSchema, createRegisteredModel,
  getRegisteredModelSchema, getRegisteredModel,
  searchRegisteredModelsSchema, searchRegisteredModels,
  renameRegisteredModelSchema, renameRegisteredModel,
  updateRegisteredModelSchema, updateRegisteredModel,
  deleteRegisteredModelSchema, deleteRegisteredModel,
  getLatestModelVersionsSchema, getLatestModelVersions,
  setRegisteredModelTagSchema, setRegisteredModelTag,
  deleteRegisteredModelTagSchema, deleteRegisteredModelTag,
  setRegisteredModelAliasSchema, setRegisteredModelAlias,
  deleteRegisteredModelAliasSchema, deleteRegisteredModelAlias,
  getModelVersionByAliasSchema, getModelVersionByAlias,
} from "./tools/registered-models.js";
import {
  createModelVersionSchema, createModelVersion,
  getModelVersionSchema, getModelVersion,
  searchModelVersionsSchema, searchModelVersions,
  updateModelVersionSchema, updateModelVersion,
  deleteModelVersionSchema, deleteModelVersion,
  transitionModelVersionStageSchema, transitionModelVersionStage,
  getModelVersionDownloadUriSchema, getModelVersionDownloadUri,
  setModelVersionTagSchema, setModelVersionTag,
  deleteModelVersionTagSchema, deleteModelVersionTag,
} from "./tools/model-versions.js";
import {
  createLoggedModelSchema, createLoggedModel,
  searchLoggedModelsSchema, searchLoggedModels,
  getLoggedModelSchema, getLoggedModel,
  finalizeLoggedModelSchema, finalizeLoggedModel,
  deleteLoggedModelSchema, deleteLoggedModel,
  setLoggedModelTagsSchema, setLoggedModelTags,
  deleteLoggedModelTagSchema, deleteLoggedModelTag,
  logLoggedModelParamsSchema, logLoggedModelParams,
} from "./tools/logged-models.js";
import {
  searchTracesSchema, searchTraces,
  getTraceSchema, getTrace,
  getTraceInfoSchema, getTraceInfo,
  deleteTracesSchema, deleteTraces,
  setTraceTagSchema, setTraceTag,
  deleteTraceTagSchema, deleteTraceTag,
  listTraceAttachmentsSchema, listTraceAttachments,
  getTraceAttachmentSchema, getTraceAttachment,
} from "./tools/traces.js";
import {
  logFeedbackSchema, logFeedback,
  logExpectationSchema, logExpectation,
  getAssessmentSchema, getAssessment,
  updateAssessmentSchema, updateAssessment,
  deleteAssessmentSchema, deleteAssessment,
} from "./tools/assessments.js";
import {
  createWebhookSchema, createWebhook,
  listWebhooksSchema, listWebhooks,
  getWebhookSchema, getWebhook,
  updateWebhookSchema, updateWebhook,
  deleteWebhookSchema, deleteWebhook,
  testWebhookSchema, testWebhook,
} from "./tools/webhooks.js";
import { summarizeRunSchema, summarizeRun, summarizeExperimentSchema, summarizeExperiment } from "./tools/aggregations.js";
import {
  createPromptOptimizationJobSchema, createPromptOptimizationJob,
  getPromptOptimizationJobSchema, getPromptOptimizationJob,
  searchPromptOptimizationJobsSchema, searchPromptOptimizationJobs,
  cancelPromptOptimizationJobSchema, cancelPromptOptimizationJob,
  deletePromptOptimizationJobSchema, deletePromptOptimizationJob,
} from "./tools/prompt-optimization.js";

validateConfig();

import { registry, searchToolsSchema, searchTools, type Category } from "./tool-registry.js";
import { registerResources } from "./resources.js";

const server = new McpServer({
  name: "mlflow",
  version: pkgVersion,
});

// --- Tool registration with category filtering (MLFLOW_TOOLS / MLFLOW_DISABLE) ---
let currentCategory: Category = "experiments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tool(name: string, description: string, schema: any, handler: any, annotations?: any): void {
  registry.register(name, description, currentCategory);
  if (registry.isEnabled(currentCategory)) {
    server.tool(name, description, schema, inferToolAnnotations(name, annotations), handler);
  }
}

// --- Experiments ---
currentCategory = "experiments";

tool("create-experiment", "Create a new MLflow experiment", createExperimentSchema.shape, wrapToolHandler(createExperiment));
tool("search-experiments", "Search experiments with filter and pagination", searchExperimentsSchema.shape, wrapToolHandler(searchExperiments));
tool("get-experiment", "Get experiment details by ID", getExperimentSchema.shape, wrapToolHandler(getExperiment));
tool("get-experiment-by-name", "Get experiment details by name", getExperimentByNameSchema.shape, wrapToolHandler(getExperimentByName));
tool("update-experiment", "Rename an experiment", updateExperimentSchema.shape, wrapToolHandler(updateExperiment));
tool("delete-experiment", "Soft-delete an experiment by ID", deleteExperimentSchema.shape, wrapToolHandler(deleteExperiment));
tool("restore-experiment", "Restore a deleted experiment", restoreExperimentSchema.shape, wrapToolHandler(restoreExperiment));
tool("set-experiment-tag", "Set a tag on an experiment", setExperimentTagSchema.shape, wrapToolHandler(setExperimentTag));
tool("delete-experiment-tag", "Delete a tag from an experiment", deleteExperimentTagSchema.shape, wrapToolHandler(deleteExperimentTag));

// --- Runs ---
currentCategory = "runs";

tool("create-run", "Create a new run in an experiment", createRunSchema.shape, wrapToolHandler(createRun));
tool("get-run", "Get run details by ID", getRunSchema.shape, wrapToolHandler(getRun));
tool("search-runs", "Search runs with filter expression and pagination", searchRunsSchema.shape, wrapToolHandler(searchRuns));
tool("update-run", "Update run status, end time, or name", updateRunSchema.shape, wrapToolHandler(updateRun));
tool("delete-run", "Soft-delete a run by ID", deleteRunSchema.shape, wrapToolHandler(deleteRun));
tool("restore-run", "Restore a deleted run", restoreRunSchema.shape, wrapToolHandler(restoreRun));
tool("log-metric", "Log a single metric value to a run", logMetricSchema.shape, wrapToolHandler(logMetric));
tool("log-param", "Log a single parameter to a run", logParamSchema.shape, wrapToolHandler(logParam));
tool("log-batch", "Log a batch of metrics, params, and tags to a run", logBatchSchema.shape, wrapToolHandler(logBatch));
tool("log-inputs", "Log dataset inputs to a run", logInputsSchema.shape, wrapToolHandler(logInputs));
tool("get-metric-history", "Get full history of a metric for a run", getMetricHistorySchema.shape, wrapToolHandler(getMetricHistory));
tool("set-run-tag", "Set a tag on a run", setRunTagSchema.shape, wrapToolHandler(setRunTag));
tool("delete-run-tag", "Delete a tag from a run", deleteRunTagSchema.shape, wrapToolHandler(deleteRunTag));
tool("list-artifacts", "List artifacts under a run's artifact directory", listArtifactsSchema.shape, wrapToolHandler(listArtifacts));
tool("get-best-run", "Find the run with the best (max/min) value of a metric in an experiment", getBestRunSchema.shape, wrapToolHandler(getBestRun));
// Card-aware wrapper: see datadog `slo-compliance-snapshot` for the same pattern.
const COMPARE_RUNS_CARD_URI = "ui://widget/compare-runs.html";
const wrappedCompareRuns = wrapToolHandler(compareRuns);
async function compareRunsWithCard(args: Parameters<typeof wrappedCompareRuns>[0]) {
  const result = await wrappedCompareRuns(args);
  if (result.isError) return result;
  try {
    const structured = JSON.parse(result.content[0].text);
    return {
      ...result,
      structuredContent: structured,
      _meta: {
        "openai/outputTemplate": COMPARE_RUNS_CARD_URI,
        "ui.resourceUri": COMPARE_RUNS_CARD_URI,
      },
    };
  } catch { return result; }
}
tool("compare-runs", "Side-by-side metric/param comparison across multiple runs. Renders an Apps SDK card on ChatGPT clients (Claude clients receive the same JSON text).", compareRunsSchema.shape, compareRunsWithCard);
tool("search-runs-by-tags", "Find runs whose tags match all of the given key/value pairs", searchRunsByTagsSchema.shape, wrapToolHandler(searchRunsByTags));

// --- Registered Models ---
currentCategory = "registry";

tool("create-registered-model", "Create a new registered model in the model registry", createRegisteredModelSchema.shape, wrapToolHandler(createRegisteredModel));
tool("get-registered-model", "Get a registered model by name", getRegisteredModelSchema.shape, wrapToolHandler(getRegisteredModel));
tool("search-registered-models", "Search registered models", searchRegisteredModelsSchema.shape, wrapToolHandler(searchRegisteredModels));
tool("rename-registered-model", "Rename a registered model", renameRegisteredModelSchema.shape, wrapToolHandler(renameRegisteredModel));
tool("update-registered-model", "Update a registered model's description", updateRegisteredModelSchema.shape, wrapToolHandler(updateRegisteredModel));
tool("delete-registered-model", "Delete a registered model and all its versions", deleteRegisteredModelSchema.shape, wrapToolHandler(deleteRegisteredModel));
tool("get-latest-model-versions", "Get the latest model versions per stage", getLatestModelVersionsSchema.shape, wrapToolHandler(getLatestModelVersions));
tool("set-registered-model-tag", "Set a tag on a registered model", setRegisteredModelTagSchema.shape, wrapToolHandler(setRegisteredModelTag));
tool("delete-registered-model-tag", "Delete a tag from a registered model", deleteRegisteredModelTagSchema.shape, wrapToolHandler(deleteRegisteredModelTag));
tool("set-registered-model-alias", "Set an alias on a registered model version", setRegisteredModelAliasSchema.shape, wrapToolHandler(setRegisteredModelAlias));
tool("delete-registered-model-alias", "Delete an alias from a registered model", deleteRegisteredModelAliasSchema.shape, wrapToolHandler(deleteRegisteredModelAlias));
tool("get-model-version-by-alias", "Get the model version pointed to by an alias", getModelVersionByAliasSchema.shape, wrapToolHandler(getModelVersionByAlias));

// --- Model Versions ---
currentCategory = "registry";

tool("create-model-version", "Create a new model version", createModelVersionSchema.shape, wrapToolHandler(createModelVersion));
tool("get-model-version", "Get a model version by name and version", getModelVersionSchema.shape, wrapToolHandler(getModelVersion));
tool("search-model-versions", "Search model versions with filter and pagination", searchModelVersionsSchema.shape, wrapToolHandler(searchModelVersions));
tool("update-model-version", "Update a model version's description", updateModelVersionSchema.shape, wrapToolHandler(updateModelVersion));
tool("delete-model-version", "Delete a specific model version", deleteModelVersionSchema.shape, wrapToolHandler(deleteModelVersion));
tool("transition-model-version-stage", "Transition a model version to a new stage", transitionModelVersionStageSchema.shape, wrapToolHandler(transitionModelVersionStage));
tool("get-model-version-download-uri", "Get the artifact download URI for a model version", getModelVersionDownloadUriSchema.shape, wrapToolHandler(getModelVersionDownloadUri));
tool("set-model-version-tag", "Set a tag on a model version", setModelVersionTagSchema.shape, wrapToolHandler(setModelVersionTag));
tool("delete-model-version-tag", "Delete a tag from a model version", deleteModelVersionTagSchema.shape, wrapToolHandler(deleteModelVersionTag));

// --- Logged Models (MLflow 3) ---
currentCategory = "logged-models";

tool("create-logged-model", "Create a new MLflow 3 LoggedModel entity in an experiment", createLoggedModelSchema.shape, wrapToolHandler(createLoggedModel));
tool("search-logged-models", "Search LoggedModels by experiment with filter and pagination", searchLoggedModelsSchema.shape, wrapToolHandler(searchLoggedModels));
tool("get-logged-model", "Get a LoggedModel by ID", getLoggedModelSchema.shape, wrapToolHandler(getLoggedModel));
tool("finalize-logged-model", "Set a terminal status (READY/FAILED/...) on a LoggedModel", finalizeLoggedModelSchema.shape, wrapToolHandler(finalizeLoggedModel));
tool("delete-logged-model", "Soft-delete a LoggedModel by ID", deleteLoggedModelSchema.shape, wrapToolHandler(deleteLoggedModel));
tool("set-logged-model-tags", "Set or upsert tags on a LoggedModel", setLoggedModelTagsSchema.shape, wrapToolHandler(setLoggedModelTags));
tool("delete-logged-model-tag", "Delete a tag from a LoggedModel", deleteLoggedModelTagSchema.shape, wrapToolHandler(deleteLoggedModelTag));
tool("log-logged-model-params", "Log parameters on a LoggedModel", logLoggedModelParamsSchema.shape, wrapToolHandler(logLoggedModelParams));

// --- Traces ---
currentCategory = "traces";

tool("search-traces", "Search and filter traces in experiments", searchTracesSchema.shape, wrapToolHandler(searchTraces));
tool("get-trace", "Retrieve detailed trace information by trace ID", getTraceSchema.shape, wrapToolHandler(getTrace));
tool("get-trace-info", "Retrieve trace metadata only (no spans)", getTraceInfoSchema.shape, wrapToolHandler(getTraceInfo));
tool("delete-traces", "Delete traces by ID or older than a timestamp", deleteTracesSchema.shape, wrapToolHandler(deleteTraces));
tool("set-trace-tag", "Add a custom key-value tag to a trace", setTraceTagSchema.shape, wrapToolHandler(setTraceTag));
tool("delete-trace-tag", "Remove a tag from a trace", deleteTraceTagSchema.shape, wrapToolHandler(deleteTraceTag));
tool("list-trace-attachments", "List attachments on a trace (Databricks MLflow only — OSS servers return 404)", listTraceAttachmentsSchema.shape, wrapToolHandler(listTraceAttachments));
tool("get-trace-attachment", "Get a specific attachment on a trace by ID (Databricks MLflow only — OSS servers return 404)", getTraceAttachmentSchema.shape, wrapToolHandler(getTraceAttachment));

// --- Assessments (GenAI evaluation) ---
currentCategory = "assessments";

tool("log-feedback", "Log evaluation feedback (score or judgment) on a trace", logFeedbackSchema.shape, wrapToolHandler(logFeedback));
tool("log-expectation", "Log a ground-truth expectation on a trace", logExpectationSchema.shape, wrapToolHandler(logExpectation));
tool("get-assessment", "Get an assessment by trace ID and assessment ID", getAssessmentSchema.shape, wrapToolHandler(getAssessment));
tool("update-assessment", "Update an existing assessment", updateAssessmentSchema.shape, wrapToolHandler(updateAssessment));
tool("delete-assessment", "Delete an assessment from a trace", deleteAssessmentSchema.shape, wrapToolHandler(deleteAssessment));

// --- Webhooks (Model Registry events) ---
currentCategory = "webhooks";

tool("create-webhook", "Register a webhook for model registry events", createWebhookSchema.shape, wrapToolHandler(createWebhook));
tool("list-webhooks", "List webhooks (optionally filtered by model name)", listWebhooksSchema.shape, wrapToolHandler(listWebhooks));
tool("get-webhook", "Get webhook details by ID", getWebhookSchema.shape, wrapToolHandler(getWebhook));
tool("update-webhook", "Update an existing webhook (events, URL, status, secret)", updateWebhookSchema.shape, wrapToolHandler(updateWebhook));
tool("delete-webhook", "Delete a webhook by ID", deleteWebhookSchema.shape, wrapToolHandler(deleteWebhook));
tool("test-webhook", "Send a test event to a webhook to verify configuration", testWebhookSchema.shape, wrapToolHandler(testWebhook));

// --- Prompt Optimization (MLflow 3 GenAI) ---
currentCategory = "prompts";

tool("create-prompt-optimization-job", "Create a prompt optimization job to automatically improve a registered prompt", createPromptOptimizationJobSchema.shape, wrapToolHandler(createPromptOptimizationJob));
tool("get-prompt-optimization-job", "Get a prompt optimization job by ID", getPromptOptimizationJobSchema.shape, wrapToolHandler(getPromptOptimizationJob));
tool("search-prompt-optimization-jobs", "Search prompt optimization jobs in an experiment", searchPromptOptimizationJobsSchema.shape, wrapToolHandler(searchPromptOptimizationJobs));
tool("cancel-prompt-optimization-job", "Cancel a running prompt optimization job", cancelPromptOptimizationJobSchema.shape, wrapToolHandler(cancelPromptOptimizationJob));
tool("delete-prompt-optimization-job", "Delete a prompt optimization job", deletePromptOptimizationJobSchema.shape, wrapToolHandler(deletePromptOptimizationJob));

// --- Aggregation tools (round-trip elimination) ---
currentCategory = "runs";

tool("summarize-run",
  "Aggregated run view: run info + (optional) metric history + (optional) artifacts list in a single call. Replaces 3-4 round-trips of get-run + get-metric-history (per metric) + list-artifacts.",
  summarizeRunSchema.shape, wrapToolHandler(summarizeRun));

tool("summarize-experiment",
  "Aggregated experiment view: experiment overview + topN runs (sorted by metric or start_time) + metric stats (min/max/mean across topN) in a single call. Replaces 3-5 round-trips of get-experiment + search-runs + get-best-run.",
  summarizeExperimentSchema.shape, wrapToolHandler(summarizeExperiment));

// --- Meta tools (always enabled) ---
currentCategory = "meta";

tool("search-tools",
  "Discover available tools by natural language query. Returns matching tool names + descriptions across all categories. Use this first to navigate the 77+ tool surface efficiently.",
  searchToolsSchema.shape, wrapToolHandler(searchTools));

registerPrompts(server);
registerResources(server);

startMcpServer(server).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
