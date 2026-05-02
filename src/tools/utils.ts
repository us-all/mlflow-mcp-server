import { applyExtractFields, createWrapToolHandler } from "@us-all/mcp-toolkit";
import { config } from "../config.js";
import { MlflowError } from "../client.js";

export { applyExtractFields };

export class WriteBlockedError extends Error {
  constructor() {
    super("Write operations are disabled. Set MLFLOW_ALLOW_WRITE=true to enable.");
    this.name = "WriteBlockedError";
  }
}

export function assertWriteAllowed(): void {
  if (!config.allowWrite) {
    throw new WriteBlockedError();
  }
}

export function resolveExperimentId(provided?: string): string {
  const id = provided ?? config.defaultExperimentId;
  if (!id) {
    throw new Error("experimentId is required (pass explicitly or set MLFLOW_EXPERIMENT_ID)");
  }
  return id;
}

export const wrapToolHandler = createWrapToolHandler({
  // Defaults already cover api_key, authorization, bearer, password, secret, token.
  // Basic auth header values are MLflow-specific and not in the default set.
  redactionPatterns: [/basic\s+\S+/i],
  errorExtractors: [
    {
      match: (error) => error instanceof WriteBlockedError,
      extract: (error) => ({
        kind: "passthrough",
        text: (error as WriteBlockedError).message,
      }),
    },
    {
      match: (error) => error instanceof MlflowError,
      extract: (error) => {
        const err = error as MlflowError;
        return {
          kind: "structured",
          data: {
            message: err.message,
            status: err.status,
            body: err.body,
          },
        };
      },
    },
  ],
});
