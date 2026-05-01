import { applyExtractFields } from "@us-all/mcp-toolkit";
import { config } from "../config.js";
import { MlflowError } from "../client.js";

export { applyExtractFields };

const SENSITIVE_PATTERNS = [
  /MLFLOW_TRACKING_TOKEN/i,
  /MLFLOW_TRACKING_PASSWORD/i,
  /authorization/i,
  /bearer\s+\S+/i,
  /basic\s+\S+/i,
  /api[_-]?key/i,
  /password/i,
  /secret/i,
];

function sanitize(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

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

// applyExtractFields is imported from @us-all/mcp-toolkit and re-exported above.

export function resolveExperimentId(provided?: string): string {
  const id = provided ?? config.defaultExperimentId;
  if (!id) {
    throw new Error("experimentId is required (pass explicitly or set MLFLOW_EXPERIMENT_ID)");
  }
  return id;
}

export function wrapToolHandler<T>(fn: (params: T) => Promise<unknown>) {
  return async (params: T) => {
    try {
      const result = await fn(params);
      const expr = (params as Record<string, unknown> | undefined)?.extractFields;
      const projected = typeof expr === "string" ? applyExtractFields(result, expr) : result;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projected, null, 2) }],
      };
    } catch (error) {
      if (error instanceof WriteBlockedError) {
        return {
          content: [{ type: "text" as const, text: error.message }],
          isError: true,
        };
      }

      const structured: Record<string, unknown> = {
        message: "Unknown error",
      };

      if (error instanceof MlflowError) {
        structured.message = sanitize(error.message);
        structured.status = error.status;
        structured.details = error.body;
      } else if (error instanceof Error) {
        structured.message = sanitize(error.message);
      } else {
        structured.message = sanitize(String(error));
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
        isError: true,
      };
    }
  };
}
