# MLflow MCP Server

> **The widest-coverage MLflow MCP — including MLflow 3 traces, attachments, prompt-optimization, and webhooks that no other MCP exposes.**
>
> 78 tools across experiments, runs, registry, logged models, traces, assessments, webhooks, prompt-optimization. Aggregation tools (`summarize-experiment`, `summarize-run`) fold 3–5 round-trips into one structured response with already-fetched metric stats.

[![npm](https://img.shields.io/npm/v/@us-all/mlflow-mcp)](https://www.npmjs.com/package/@us-all/mlflow-mcp)
[![downloads](https://img.shields.io/npm/dm/@us-all/mlflow-mcp)](https://www.npmjs.com/package/@us-all/mlflow-mcp)
[![tools](https://img.shields.io/badge/tools-78-blue)](#tools)
[![@us-all standard](https://img.shields.io/badge/built%20to-%40us--all%20MCP%20standard-blue)](https://github.com/us-all/mcp-toolkit/blob/main/STANDARD.md)

## What it does that others don't

- **Full coverage** — only third-party MLflow MCP shipping prompt-optimization-jobs (5 tools), webhooks (6), MLflow 3 LoggedModel (8), and trace attachments (`list-trace-attachments`, `get-trace-attachment`).
- **Aggregation tools** — `summarize-experiment` returns experiment + topN runs + metric stats (min/max/mean) in one call from already-fetched data, zero extra round-trips. `summarize-run` dedups `metricHistory.history.*.key` (~100KB savings on 4k-point series).
- **MCP Prompts** (4) — `debug-failed-traces`, `promote-best-run`, `compare-top-runs`, `annotate-trace-quality`. Workflow templates the model invokes directly.
- **MCP Resources** (6) — `mlflow://run/{runId}`, `mlflow://experiment/{expId}`, `mlflow://run/{runId}/artifacts`, `mlflow://experiment/{expId}/runs`, `mlflow://registered-model/{name}/versions`, `mlflow://trace/{traceId}`.
- **Token-efficient by design** — `extractFields` projection on `search-traces` / `get-trace` / fat reads, `MLFLOW_TOOLS` / `MLFLOW_DISABLE` 8 categories, `search-tools` meta-tool.
- **Apps SDK card** — `compare-runs` renders as a side-by-side card on ChatGPT clients (run summary + metric/param tables with diff highlight) via `_meta["openai/outputTemplate"]`. Claude clients receive the same JSON content.
- **stdio + Streamable HTTP** — defaults to stdio. Set `MCP_TRANSPORT=http` for ChatGPT Apps SDK or remote clients (Bearer auth via `MCP_HTTP_TOKEN`).

## Try this — 5 prompts

Connect the server to Claude Desktop or Claude Code, then paste any of these:

1. **Best run** — *"In the `customer-churn-v3` experiment, find the run with the highest `val_accuracy`. Show its hyperparameters and metric history."*
2. **Failure mode clustering** — *"Find traces with `status=ERROR` from the last 24h in experiment 12. Group the failures by exception type and surface the 3 most common."*
3. **Run comparison** — *"Compare the top 5 runs of experiment 12 by `validation_loss`. Show differing hyperparameters in a table."*
4. **Model promotion** — *"Get the latest version of `recommendation_v2` registered model with the `champion` alias. Show its training metrics + lineage to the source run."*
5. **Trace deep-dive** — *"Pull trace `tr-abc123` with all attachments. Highlight slow spans and any failed feedback annotations."*

## When to use this vs alternatives

| | Official `mlflow[mcp]` | kkruglik/mlflow-mcp | `@us-all/mlflow-mcp` (this) |
|--|------------------------|---------------------|------------------------------|
| Tool count | ~9 (trace-only) | ~25 | **78** |
| MLflow 3 LoggedModel | ❌ | ✅ | ✅ |
| Trace attachments | ❌ | ❌ | ✅ |
| Prompt-optimization-jobs | ❌ | ❌ | ✅ |
| Webhooks | ❌ | ❌ | ✅ |
| Aggregation tools | ❌ | ❌ | ✅ `summarize-experiment`, `summarize-run` |
| MCP Prompts | ❌ | ✅ | ✅ |
| MCP Resources | ❌ | ❌ | ✅ 6 URIs |
| Auth | Databricks SDK | Bearer / basic | Bearer / basic |
| Transport | stdio | stdio | stdio |

The official `mlflow[mcp]` is bundled inside MLflow itself and intentionally trace-narrow. Use it for quick managed-MLflow trace inspection. Use this server for end-to-end coverage, especially MLflow 3 entities, prompt-optimization workflows, and aggregation-driven AI debugging.

## Install

### Claude Desktop

```json
{
  "mcpServers": {
    "mlflow": {
      "command": "npx",
      "args": ["-y", "@us-all/mlflow-mcp"],
      "env": {
        "MLFLOW_TRACKING_URI": "http://localhost:5000"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add mlflow -s user \
  -e MLFLOW_TRACKING_URI=http://localhost:5000 \
  -- npx -y @us-all/mlflow-mcp
```

### Docker

```bash
docker run --rm -i \
  -e MLFLOW_TRACKING_URI=http://your-host:5000 \
  ghcr.io/us-all/mlflow-mcp-server
```

### Build from source

```bash
git clone https://github.com/us-all/mlflow-mcp-server.git
cd mlflow-mcp-server && pnpm install && pnpm build
node dist/index.js
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `MLFLOW_TRACKING_URI` | ✅ | — | MLflow tracking URL (`http://localhost:5000`, Databricks workspace URL, etc.) |
| `MLFLOW_TRACKING_TOKEN` | ❌ | — | Bearer token. Use for Databricks PAT (`dapi…`) |
| `MLFLOW_TRACKING_USERNAME` | ❌ | — | Basic-auth username (alternative to token) |
| `MLFLOW_TRACKING_PASSWORD` | ❌ | — | Basic-auth password |
| `MLFLOW_EXPERIMENT_ID` | ❌ | — | Default experiment ID for tools that accept it implicitly |
| `MLFLOW_ALLOW_WRITE` | ❌ | `false` | Set `true` to enable mutations (create/update/delete) |
| `MLFLOW_TOOLS` | ❌ | — | Comma-sep allowlist of categories. Biggest token saver. |
| `MLFLOW_DISABLE` | ❌ | — | Comma-sep denylist. Ignored when `MLFLOW_TOOLS` is set. |
| `MCP_TRANSPORT` | ❌ | `stdio` | `http` to enable Streamable HTTP transport |
| `MCP_HTTP_TOKEN` | conditional | — | Bearer token. Required when `MCP_TRANSPORT=http` |
| `MCP_HTTP_PORT` | ❌ | `3000` | HTTP listen port |
| `MCP_HTTP_HOST` | ❌ | `127.0.0.1` | HTTP bind host (DNS rebinding protection auto-enabled for localhost) |
| `MCP_HTTP_SKIP_AUTH` | ❌ | `false` | Skip Bearer auth — e.g. behind a reverse proxy that handles it |

**Categories** (8): `experiments`, `runs`, `registry`, `logged-models`, `traces`, `assessments`, `webhooks`, `prompts`.

When `MCP_TRANSPORT=http`: `POST /mcp` (Bearer-auth JSON-RPC) + `GET /health` (public liveness).

### Databricks managed MLflow

For Databricks-hosted MLflow:

```bash
MLFLOW_TRACKING_URI=https://<workspace>.cloud.databricks.com
MLFLOW_TRACKING_TOKEN=dapi...   # PAT or service-principal token
```

The MLflow REST API path (`/api/2.0/mlflow/...`) is identical between OSS and Databricks. Bearer auth handles both PAT and service-principal flows.

### Token efficiency

| Scenario | Tools | Schema tokens | vs default |
|----------|------:|--------------:|-----------:|
| default (all categories) | 78 | 9,200 | — |
| typical (`MLFLOW_TOOLS=experiments,runs,registry,traces`) | 54 | 5,900 | −36% |
| narrow (`MLFLOW_TOOLS=experiments,runs`) | 27 | **3,200** | **−66%** |

Plus `extractFields` on `search-traces` / `get-trace` / `summarize-experiment` — caller can scope response fields per call.

### Read-only mode

By default, all writes are blocked. The following require `MLFLOW_ALLOW_WRITE=true`:

`create-experiment`, `update-experiment`, `delete-experiment`, `restore-experiment`, `set-experiment-tag`, `delete-experiment-tag`, `create-run`, `update-run`, `delete-run`, `restore-run`, `log-metric`, `log-param`, `log-batch`, `log-inputs`, `set-run-tag`, `delete-run-tag`, `create-registered-model`, `rename-registered-model`, `update-registered-model`, `delete-registered-model`, plus all model-version, logged-model, trace, assessment, webhook, and prompt-optimization writes.

## MCP Prompts (4)

Workflow templates available via MCP `prompts/list`:

- `debug-failed-traces` — find failed traces, group failure modes
- `promote-best-run` — find best run, register, set `champion` alias
- `compare-top-runs` — top-N comparison by metric
- `annotate-trace-quality` — guided feedback annotation loop

## MCP Resources

URI-based read-only access:

`mlflow://run/{runId}`, `mlflow://experiment/{expId}`, `mlflow://experiment-by-name/{name}`, `mlflow://registered-model/{name}`, `mlflow://model-version/{name}/{version}`, `mlflow://trace/{traceId}`, `mlflow://run/{runId}/artifacts`, `mlflow://experiment/{expId}/runs`, `mlflow://registered-model/{name}/versions`.

## Tools (78)

8 categories. Use `search-tools` to discover at runtime; full list collapsed below.

<details>
<summary>Full tool list</summary>

### Experiments (9)
`create-experiment`, `search-experiments`, `get-experiment`, `get-experiment-by-name`, `update-experiment`, `delete-experiment`, `restore-experiment`, `set-experiment-tag`, `delete-experiment-tag`

### Runs (17)
`create-run`, `get-run`, `search-runs`, `update-run`, `delete-run`, `restore-run`, `log-metric`, `log-param`, `log-batch`, `log-inputs`, `get-metric-history`, `set-run-tag`, `delete-run-tag`, `list-artifacts`, `get-best-run`, `compare-runs`, `search-runs-by-tags`, `summarize-run` *(aggregation)*

### Registered Models (12)
`create-registered-model`, `get-registered-model`, `search-registered-models`, `rename-registered-model`, `update-registered-model`, `delete-registered-model`, `get-latest-model-versions`, `set-registered-model-tag`, `delete-registered-model-tag`, `set-registered-model-alias`, `delete-registered-model-alias`, `get-model-version-by-alias`

### Model Versions (9)
`create-model-version`, `get-model-version`, `search-model-versions`, `update-model-version`, `delete-model-version`, `transition-model-version-stage`, `get-model-version-download-uri`, `set-model-version-tag`, `delete-model-version-tag`

### Logged Models — MLflow 3 (8)
`create-logged-model`, `search-logged-models`, `get-logged-model`, `finalize-logged-model`, `delete-logged-model`, `set-logged-model-tags`, `delete-logged-model-tag`, `log-logged-model-params`

### Traces (8)
`search-traces`, `get-trace`, `get-trace-info`, `delete-traces`, `set-trace-tag`, `delete-trace-tag`, `list-trace-attachments`, `get-trace-attachment`

`search-traces`, `get-trace`, and `summarize-experiment` accept `extractFields` for response slicing.

### Assessments (5)
`log-feedback`, `log-expectation`, `get-assessment`, `update-assessment`, `delete-assessment`

### Webhooks (6)
`create-webhook`, `list-webhooks`, `get-webhook`, `update-webhook`, `delete-webhook`, `test-webhook`

### Prompt Optimization (5)
`create-prompt-optimization-job`, `get-prompt-optimization-job`, `search-prompt-optimization-jobs`, `cancel-prompt-optimization-job`, `delete-prompt-optimization-job`

### Aggregations
`summarize-experiment`, `summarize-run` — fold 3–5 round-trips into one structured response with `caveats` array.

### Meta
`search-tools` — query other tools by keyword; always enabled.

</details>

## Local validation with docker compose

```bash
# 1. start MLflow (UI at http://localhost:5050)
docker compose up -d mlflow

# 2. seed demo experiment, runs, registered model, traces
docker compose run --rm seed

# 3a. probe the MCP server locally against the compose'd MLflow
MLFLOW_TRACKING_URI=http://localhost:5050 \
  MLFLOW_EXPERIMENT_ID=1 \
  MLFLOW_ALLOW_WRITE=true \
  node dist/index.js

# 3b. or run inside compose (stdio)
docker compose run --rm mcp

# tear down
docker compose down -v
```

`./dev/seed.py` is idempotent — skips if `demo` experiment already has runs.

## Architecture

```
Claude → MCP stdio → src/index.ts → src/tools/*.ts → MlflowClient (fetch) → MLflow REST API
```

Built on [`@us-all/mcp-toolkit`](https://github.com/us-all/mcp-toolkit):
- `extractFields` — token-efficient response projections
- `aggregate(fetchers, caveats)` — fan-out helper for `summarize-experiment`
- `createWrapToolHandler` — Bearer/basic credential redaction + MlflowError extraction
- `search-tools` meta-tool

Targets MLflow 3.5.1+ (uses v3 traces/assessments REST). Validated end-to-end against MLflow 3.11.1.

## Tech stack

Node.js 20+ • TypeScript strict ESM • pnpm • `@modelcontextprotocol/sdk` • zod • dotenv • vitest.

## References

- MLflow MCP overview: https://mlflow.org/docs/latest/genai/mcp/
- MLflow REST API: https://mlflow.org/docs/latest/api_reference/rest-api.html

## License

[MIT](./LICENSE)
