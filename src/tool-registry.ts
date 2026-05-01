import { ToolRegistry, createSearchToolsMetaTool } from "@us-all/mcp-toolkit";
import { config } from "./config.js";

export const CATEGORIES = [
  "experiments",
  "runs",
  "registry",
  "logged-models",
  "traces",
  "assessments",
  "webhooks",
  "prompts",
  "meta",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const registry = new ToolRegistry<Category>({
  enabledCategories: config.enabledCategories,
  disabledCategories: config.disabledCategories,
});

const meta = createSearchToolsMetaTool(registry, CATEGORIES,
  "Discover tools across the MLflow MCP surface (experiments, runs, registry, traces, assessments, webhooks, prompts).");

export const searchToolsSchema = meta.schema;
export const searchTools = meta.handler;
