import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mlflowClient } from "./client.js";

/**
 * MCP Resources for hot MLflow entities.
 *
 * URI scheme: `mlflow://`
 *   - mlflow://run/{runId}                         — run details (info + metrics + params + tags)
 *   - mlflow://experiment/{experimentId}           — experiment details
 *   - mlflow://experiment-by-name/{name}           — experiment by name
 *   - mlflow://registered-model/{name}             — registered model details + versions
 *   - mlflow://model-version/{name}/{version}      — specific model version
 *   - mlflow://trace/{traceId}                     — GenAI trace
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
}
