import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mlflowClient } from "./client.js";

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), "ui");
const COMPARE_RUNS_HTML = readFileSync(join(UI_DIR, "compare-runs.html"), "utf-8");

/**
 * MCP Resources for hot MLflow entities.
 *
 * URI scheme: `mlflow://`
 *   - mlflow://run/{runId}                              — run details (info + metrics + params + tags)
 *   - mlflow://run/{runId}/artifacts                    — artifacts under a run's artifact root
 *   - mlflow://experiment/{experimentId}                — experiment details
 *   - mlflow://experiment-by-name/{name}                — experiment by name
 *   - mlflow://experiment/{experimentId}/runs           — recent runs in experiment (last 10 by start_time desc)
 *   - mlflow://registered-model/{name}                  — registered model details + latest versions
 *   - mlflow://registered-model/{name}/versions         — all versions of a registered model
 *   - mlflow://model-version/{name}/{version}           — specific model version
 *   - mlflow://trace/{traceId}                          — GenAI trace
 */

function asJson(uri: string, data: unknown) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    "run",
    new ResourceTemplate("mlflow://run/{runId}", { list: undefined }),
    {
      title: "MLflow Run",
      description: "Run details: info, metrics, params, tags",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get("/runs/get", { run_id: String(vars.runId) });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "experiment",
    new ResourceTemplate("mlflow://experiment/{experimentId}", { list: undefined }),
    {
      title: "MLflow Experiment",
      description: "Experiment details",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get("/experiments/get", { experiment_id: String(vars.experimentId) });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "experiment-by-name",
    new ResourceTemplate("mlflow://experiment-by-name/{name}", { list: undefined }),
    {
      title: "MLflow Experiment by Name",
      description: "Experiment lookup by name",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get("/experiments/get-by-name", { experiment_name: decodeURIComponent(String(vars.name)) });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "registered-model",
    new ResourceTemplate("mlflow://registered-model/{name}", { list: undefined }),
    {
      title: "MLflow Registered Model",
      description: "Registered model with latest versions",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get("/registered-models/get", { name: decodeURIComponent(String(vars.name)) });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "model-version",
    new ResourceTemplate("mlflow://model-version/{name}/{version}", { list: undefined }),
    {
      title: "MLflow Model Version",
      description: "Specific version of a registered model",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get("/model-versions/get", {
        name: decodeURIComponent(String(vars.name)),
        version: String(vars.version),
      });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "trace",
    new ResourceTemplate("mlflow://trace/{traceId}", { list: undefined }),
    {
      title: "MLflow GenAI Trace",
      description: "GenAI trace with spans and metadata",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get(`/api/3.0/mlflow/traces/${encodeURIComponent(String(vars.traceId))}`);
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "run-artifacts",
    new ResourceTemplate("mlflow://run/{runId}/artifacts", { list: undefined }),
    {
      title: "MLflow Run Artifacts",
      description: "List artifacts under a run's artifact root",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.get("/artifacts/list", { run_id: String(vars.runId) });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "experiment-runs",
    new ResourceTemplate("mlflow://experiment/{experimentId}/runs", { list: undefined }),
    {
      title: "MLflow Experiment Runs",
      description: "Recent runs in experiment (last 10 by start_time desc)",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const data = await mlflowClient.post("/runs/search", {
        experiment_ids: [String(vars.experimentId)],
        max_results: 10,
        order_by: ["attributes.start_time DESC"],
      });
      return asJson(uri.toString(), data);
    },
  );

  server.registerResource(
    "registered-model-versions",
    new ResourceTemplate("mlflow://registered-model/{name}/versions", { list: undefined }),
    {
      title: "MLflow Registered Model Versions",
      description: "All versions of a registered model",
      mimeType: "application/json",
    },
    async (uri, vars) => {
      const name = decodeURIComponent(String(vars.name));
      const data = await mlflowClient.get("/model-versions/search", {
        filter: `name='${name.replace(/'/g, "\\'")}'`,
        max_results: 200,
      });
      return asJson(uri.toString(), data);
    },
  );

  // --- Apps SDK UI templates (ui:// scheme) ---
  // Rendered by ChatGPT / Apps SDK clients via _meta["openai/outputTemplate"].
  // Claude clients ignore the metadata and use the tool's text content instead.
  server.registerResource(
    "compare-runs-card",
    "ui://widget/compare-runs.html",
    {
      title: "Compare Runs card",
      description: "Apps SDK UI template rendered with compare-runs tool output",
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/outputTemplate": "ui://widget/compare-runs.html",
        "ui.resourceUri": "ui://widget/compare-runs.html",
      },
    },
    async (uri) => ({
      contents: [{
        uri: uri.toString(),
        mimeType: "text/html+skybridge",
        text: COMPARE_RUNS_HTML,
      }],
    }),
  );
}
