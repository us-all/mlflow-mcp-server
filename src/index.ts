#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
} from "./tools/traces.js";
import {
  logFeedbackSchema, logFeedback,
  logExpectationSchema, logExpectation,
  getAssessmentSchema, getAssessment,
  updateAssessmentSchema, updateAssessment,
  deleteAssessmentSchema, deleteAssessment,
} from "./tools/assessments.js";

validateConfig();

const server = new McpServer({
  name: "mlflow",
  version: pkgVersion,
});

// --- Experiments ---

server.tool("create-experiment", "Create a new MLflow experiment", createExperimentSchema.shape, wrapToolHandler(createExperiment));
server.tool("search-experiments", "Search experiments with filter and pagination", searchExperimentsSchema.shape, wrapToolHandler(searchExperiments));
server.tool("get-experiment", "Get experiment details by ID", getExperimentSchema.shape, wrapToolHandler(getExperiment));
server.tool("get-experiment-by-name", "Get experiment details by name", getExperimentByNameSchema.shape, wrapToolHandler(getExperimentByName));
server.tool("update-experiment", "Rename an experiment", updateExperimentSchema.shape, wrapToolHandler(updateExperiment));
server.tool("delete-experiment", "Soft-delete an experiment by ID", deleteExperimentSchema.shape, wrapToolHandler(deleteExperiment));
server.tool("restore-experiment", "Restore a deleted experiment", restoreExperimentSchema.shape, wrapToolHandler(restoreExperiment));
server.tool("set-experiment-tag", "Set a tag on an experiment", setExperimentTagSchema.shape, wrapToolHandler(setExperimentTag));
server.tool("delete-experiment-tag", "Delete a tag from an experiment", deleteExperimentTagSchema.shape, wrapToolHandler(deleteExperimentTag));

// --- Runs ---

server.tool("create-run", "Create a new run in an experiment", createRunSchema.shape, wrapToolHandler(createRun));
server.tool("get-run", "Get run details by ID", getRunSchema.shape, wrapToolHandler(getRun));
server.tool("search-runs", "Search runs with filter expression and pagination", searchRunsSchema.shape, wrapToolHandler(searchRuns));
server.tool("update-run", "Update run status, end time, or name", updateRunSchema.shape, wrapToolHandler(updateRun));
server.tool("delete-run", "Soft-delete a run by ID", deleteRunSchema.shape, wrapToolHandler(deleteRun));
server.tool("restore-run", "Restore a deleted run", restoreRunSchema.shape, wrapToolHandler(restoreRun));
server.tool("log-metric", "Log a single metric value to a run", logMetricSchema.shape, wrapToolHandler(logMetric));
server.tool("log-param", "Log a single parameter to a run", logParamSchema.shape, wrapToolHandler(logParam));
server.tool("log-batch", "Log a batch of metrics, params, and tags to a run", logBatchSchema.shape, wrapToolHandler(logBatch));
server.tool("log-inputs", "Log dataset inputs to a run", logInputsSchema.shape, wrapToolHandler(logInputs));
server.tool("get-metric-history", "Get full history of a metric for a run", getMetricHistorySchema.shape, wrapToolHandler(getMetricHistory));
server.tool("set-run-tag", "Set a tag on a run", setRunTagSchema.shape, wrapToolHandler(setRunTag));
server.tool("delete-run-tag", "Delete a tag from a run", deleteRunTagSchema.shape, wrapToolHandler(deleteRunTag));
server.tool("list-artifacts", "List artifacts under a run's artifact directory", listArtifactsSchema.shape, wrapToolHandler(listArtifacts));
server.tool("get-best-run", "Find the run with the best (max/min) value of a metric in an experiment", getBestRunSchema.shape, wrapToolHandler(getBestRun));
server.tool("compare-runs", "Side-by-side metric/param comparison across multiple runs", compareRunsSchema.shape, wrapToolHandler(compareRuns));
server.tool("search-runs-by-tags", "Find runs whose tags match all of the given key/value pairs", searchRunsByTagsSchema.shape, wrapToolHandler(searchRunsByTags));

// --- Registered Models ---

server.tool("create-registered-model", "Create a new registered model in the model registry", createRegisteredModelSchema.shape, wrapToolHandler(createRegisteredModel));
server.tool("get-registered-model", "Get a registered model by name", getRegisteredModelSchema.shape, wrapToolHandler(getRegisteredModel));
server.tool("search-registered-models", "Search registered models", searchRegisteredModelsSchema.shape, wrapToolHandler(searchRegisteredModels));
server.tool("rename-registered-model", "Rename a registered model", renameRegisteredModelSchema.shape, wrapToolHandler(renameRegisteredModel));
server.tool("update-registered-model", "Update a registered model's description", updateRegisteredModelSchema.shape, wrapToolHandler(updateRegisteredModel));
server.tool("delete-registered-model", "Delete a registered model and all its versions", deleteRegisteredModelSchema.shape, wrapToolHandler(deleteRegisteredModel));
server.tool("get-latest-model-versions", "Get the latest model versions per stage", getLatestModelVersionsSchema.shape, wrapToolHandler(getLatestModelVersions));
server.tool("set-registered-model-tag", "Set a tag on a registered model", setRegisteredModelTagSchema.shape, wrapToolHandler(setRegisteredModelTag));
server.tool("delete-registered-model-tag", "Delete a tag from a registered model", deleteRegisteredModelTagSchema.shape, wrapToolHandler(deleteRegisteredModelTag));
server.tool("set-registered-model-alias", "Set an alias on a registered model version", setRegisteredModelAliasSchema.shape, wrapToolHandler(setRegisteredModelAlias));
server.tool("delete-registered-model-alias", "Delete an alias from a registered model", deleteRegisteredModelAliasSchema.shape, wrapToolHandler(deleteRegisteredModelAlias));
server.tool("get-model-version-by-alias", "Get the model version pointed to by an alias", getModelVersionByAliasSchema.shape, wrapToolHandler(getModelVersionByAlias));

// --- Model Versions ---

server.tool("create-model-version", "Create a new model version", createModelVersionSchema.shape, wrapToolHandler(createModelVersion));
server.tool("get-model-version", "Get a model version by name and version", getModelVersionSchema.shape, wrapToolHandler(getModelVersion));
server.tool("search-model-versions", "Search model versions with filter and pagination", searchModelVersionsSchema.shape, wrapToolHandler(searchModelVersions));
server.tool("update-model-version", "Update a model version's description", updateModelVersionSchema.shape, wrapToolHandler(updateModelVersion));
server.tool("delete-model-version", "Delete a specific model version", deleteModelVersionSchema.shape, wrapToolHandler(deleteModelVersion));
server.tool("transition-model-version-stage", "Transition a model version to a new stage", transitionModelVersionStageSchema.shape, wrapToolHandler(transitionModelVersionStage));
server.tool("get-model-version-download-uri", "Get the artifact download URI for a model version", getModelVersionDownloadUriSchema.shape, wrapToolHandler(getModelVersionDownloadUri));
server.tool("set-model-version-tag", "Set a tag on a model version", setModelVersionTagSchema.shape, wrapToolHandler(setModelVersionTag));
server.tool("delete-model-version-tag", "Delete a tag from a model version", deleteModelVersionTagSchema.shape, wrapToolHandler(deleteModelVersionTag));

// --- Logged Models (MLflow 3) ---

server.tool("create-logged-model", "Create a new MLflow 3 LoggedModel entity in an experiment", createLoggedModelSchema.shape, wrapToolHandler(createLoggedModel));
server.tool("search-logged-models", "Search LoggedModels by experiment with filter and pagination", searchLoggedModelsSchema.shape, wrapToolHandler(searchLoggedModels));
server.tool("get-logged-model", "Get a LoggedModel by ID", getLoggedModelSchema.shape, wrapToolHandler(getLoggedModel));
server.tool("finalize-logged-model", "Set a terminal status (READY/FAILED/...) on a LoggedModel", finalizeLoggedModelSchema.shape, wrapToolHandler(finalizeLoggedModel));
server.tool("delete-logged-model", "Soft-delete a LoggedModel by ID", deleteLoggedModelSchema.shape, wrapToolHandler(deleteLoggedModel));
server.tool("set-logged-model-tags", "Set or upsert tags on a LoggedModel", setLoggedModelTagsSchema.shape, wrapToolHandler(setLoggedModelTags));
server.tool("delete-logged-model-tag", "Delete a tag from a LoggedModel", deleteLoggedModelTagSchema.shape, wrapToolHandler(deleteLoggedModelTag));
server.tool("log-logged-model-params", "Log parameters on a LoggedModel", logLoggedModelParamsSchema.shape, wrapToolHandler(logLoggedModelParams));

// --- Traces ---

server.tool("search-traces", "Search and filter traces in experiments", searchTracesSchema.shape, wrapToolHandler(searchTraces));
server.tool("get-trace", "Retrieve detailed trace information by trace ID", getTraceSchema.shape, wrapToolHandler(getTrace));
server.tool("get-trace-info", "Retrieve trace metadata only (no spans)", getTraceInfoSchema.shape, wrapToolHandler(getTraceInfo));
server.tool("delete-traces", "Delete traces by ID or older than a timestamp", deleteTracesSchema.shape, wrapToolHandler(deleteTraces));
server.tool("set-trace-tag", "Add a custom key-value tag to a trace", setTraceTagSchema.shape, wrapToolHandler(setTraceTag));
server.tool("delete-trace-tag", "Remove a tag from a trace", deleteTraceTagSchema.shape, wrapToolHandler(deleteTraceTag));

// --- Assessments (GenAI evaluation) ---

server.tool("log-feedback", "Log evaluation feedback (score or judgment) on a trace", logFeedbackSchema.shape, wrapToolHandler(logFeedback));
server.tool("log-expectation", "Log a ground-truth expectation on a trace", logExpectationSchema.shape, wrapToolHandler(logExpectation));
server.tool("get-assessment", "Get an assessment by trace ID and assessment ID", getAssessmentSchema.shape, wrapToolHandler(getAssessment));
server.tool("update-assessment", "Update an existing assessment", updateAssessmentSchema.shape, wrapToolHandler(updateAssessment));
server.tool("delete-assessment", "Delete an assessment from a trace", deleteAssessmentSchema.shape, wrapToolHandler(deleteAssessment));

registerPrompts(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MLflow MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
