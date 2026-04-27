import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// MCP Prompts: pre-built workflow templates that clients can invoke. Each
// returns a user-facing instruction the LLM should follow, leveraging the
// already-registered MLflow tools.

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "debug-failed-traces",
    {
      title: "Debug failed traces",
      description: "Find failed traces in an experiment, summarize the failure modes, and suggest next steps.",
      argsSchema: {
        experimentId: z.string().describe("Experiment ID to inspect"),
        sinceMinutes: z.string().optional().describe("Look back this many minutes (default: 60)"),
      },
    },
    ({ experimentId, sinceMinutes }) => {
      const window = sinceMinutes ?? "60";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Find failed traces in experiment ${experimentId} from the last ${window} minutes.`,
              "",
              "Steps:",
              `1. Compute the timestamp ${window} minutes ago.`,
              `2. Call \`search-traces\` with experimentIds=[${JSON.stringify(experimentId)}], filter on status='ERROR' and that timestamp.`,
              "3. For each failure, call `get-trace` with extractFields='trace.info.trace_id,trace.info.state,trace.info.execution_duration,trace.info.tags.*,trace.data.spans.*.name,trace.data.spans.*.status' to keep the response small.",
              "4. Group failures by error pattern (span name + status).",
              "5. Summarize: count per pattern, representative trace_ids, and one suggested fix per pattern.",
            ].join("\n"),
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "promote-best-run",
    {
      title: "Promote best run to registry",
      description: "Find the best run in an experiment by metric, register the model, and set a 'champion' alias.",
      argsSchema: {
        experimentId: z.string().describe("Experiment to scan"),
        metric: z.string().describe("Metric to optimize, e.g. 'accuracy'"),
        ascending: z.string().optional().describe("'true' to minimize (e.g. loss), 'false' (default) to maximize"),
        modelName: z.string().describe("Registered model name to upsert into"),
        artifactPath: z.string().optional().describe("Sub-path under the run's artifacts where the model lives (default: 'model')"),
      },
    },
    ({ experimentId, metric, ascending, modelName, artifactPath }) => {
      const direction = ascending === "true" ? "minimize" : "maximize";
      const ap = artifactPath ?? "model";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Promote the best run in experiment ${experimentId} (${direction} '${metric}') to registered model '${modelName}'.`,
              "",
              "Steps:",
              `1. Call \`get-best-run\` with experimentId=${JSON.stringify(experimentId)}, metric=${JSON.stringify(metric)}, ascending=${ascending === "true"}.`,
              "2. Read the run_id from the response.",
              `3. Ensure '${modelName}' exists: call \`get-registered-model\` with name=${JSON.stringify(modelName)}; if it 404s, call \`create-registered-model\`.`,
              `4. Call \`create-model-version\` with name=${JSON.stringify(modelName)}, source=\`runs:/{run_id}/${ap}\`, runId={run_id}.`,
              "5. Read the new version number from the response.",
              `6. Call \`set-registered-model-alias\` with name=${JSON.stringify(modelName)}, alias='champion', version={new_version}.`,
              "7. Confirm with `get-model-version-by-alias` and report the run_id, version, metric value used.",
            ].join("\n"),
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "compare-top-runs",
    {
      title: "Compare top runs of an experiment",
      description: "Pick the top N runs by metric in an experiment and produce a side-by-side comparison.",
      argsSchema: {
        experimentId: z.string(),
        metric: z.string(),
        topN: z.string().optional().describe("How many runs to compare (default: 3)"),
        ascending: z.string().optional().describe("'true' to sort by minimum metric value"),
      },
    },
    ({ experimentId, metric, topN, ascending }) => {
      const n = topN ?? "3";
      const dir = ascending === "true" ? "ASC" : "DESC";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Compare the top ${n} runs of experiment ${experimentId} by '${metric}' (${dir}).`,
              "",
              "Steps:",
              `1. Call \`search-runs\` with experimentIds=[${JSON.stringify(experimentId)}], maxResults=${n}, orderBy=[${JSON.stringify(`metrics.${metric} ${dir}`)}].`,
              "2. Collect run_ids from the response.",
              "3. Call `compare-runs` with those run_ids.",
              "4. Render a markdown table with run_name as columns, metrics and key params as rows.",
              "5. Highlight `differing_params` to explain what likely drove the metric differences.",
            ].join("\n"),
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "annotate-trace-quality",
    {
      title: "Annotate trace quality with feedback",
      description: "Walk through recent traces and log structured feedback (helpfulness/correctness) on each.",
      argsSchema: {
        experimentId: z.string(),
        max: z.string().optional().describe("How many traces to annotate (default: 10)"),
        feedbackName: z.string().optional().describe("Feedback metric name (default: 'helpfulness')"),
      },
    },
    ({ experimentId, max, feedbackName }) => {
      const m = max ?? "10";
      const fb = feedbackName ?? "helpfulness";
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: [
              `Annotate the latest ${m} traces in experiment ${experimentId} with '${fb}' feedback.`,
              "",
              "Steps:",
              `1. Call \`search-traces\` with experimentIds=[${JSON.stringify(experimentId)}], maxResults=${m}, extractFields='traces.*.trace_id,traces.*.request_preview,traces.*.response_preview'.`,
              "2. For each trace:",
              "   a. Show the request_preview and response_preview to the user.",
              "   b. Ask for a 0.0–1.0 score and an optional rationale.",
              `   c. Call \`log-feedback\` with traceId={trace_id}, name=${JSON.stringify(fb)}, value={score}, rationale={text}, source={source_type:'HUMAN', source_id:'annotator'}.`,
              "3. After the loop, summarize counts by score bucket (low <0.3, mid 0.3–0.7, high >0.7).",
            ].join("\n"),
          },
        }],
      };
    },
  );
}
