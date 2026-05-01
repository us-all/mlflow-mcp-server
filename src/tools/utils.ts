import { config } from "../config.js";
import { MlflowError } from "../client.js";

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

// --- extract_fields: comma-separated dotted paths with `*` wildcard ---
// Examples:
//   "info.trace_id,info.state"
//   "data.spans.*.name"
//   "info.tags.`mlflow.traceName`"

function parsePath(path: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let inBacktick = false;
  for (const ch of path) {
    if (ch === "`") { inBacktick = !inBacktick; continue; }
    if (ch === "." && !inBacktick) {
      if (buf) parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf) parts.push(buf);
  return parts;
}

// Select-tree: each node either is a leaf (include whole subtree) or has named children.
// Wildcard child uses key "*".
type SelectNode = { leaf: boolean; children: Map<string, SelectNode> };

function newNode(): SelectNode {
  return { leaf: false, children: new Map() };
}

function buildSelectTree(paths: string[][]): SelectNode {
  const root = newNode();
  for (const parts of paths) {
    let cursor = root;
    for (const part of parts) {
      let next = cursor.children.get(part);
      if (!next) {
        next = newNode();
        cursor.children.set(part, next);
      }
      cursor = next;
    }
    cursor.leaf = true;
  }
  return root;
}

function project(data: unknown, node: SelectNode): unknown {
  if (node.leaf || node.children.size === 0) return data;
  if (data === null || data === undefined) return data;
  const wildcard = node.children.get("*");
  if (Array.isArray(data)) {
    // Array values: a wildcard child iterates the elements; otherwise broadcast.
    return data.map((v) => project(v, wildcard ?? node));
  }
  if (typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (wildcard) {
    for (const [k, v] of Object.entries(obj)) out[k] = project(v, wildcard);
  }
  for (const [key, child] of node.children) {
    if (key === "*") continue;
    if (key in obj) out[key] = project(obj[key], child);
  }
  return out;
}

export function applyExtractFields<T>(data: T, expr?: string): T | unknown {
  if (!expr || !expr.trim()) return data;
  if (data === null || typeof data !== "object") return data;
  const paths = expr.split(",").map((s) => s.trim()).filter(Boolean).map(parsePath);
  if (paths.length === 0) return data;
  const tree = buildSelectTree(paths);
  return project(data, tree);
}

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
