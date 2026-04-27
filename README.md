# MLflow MCP Server

MCP server for [MLflow](https://mlflow.org/) — covers experiments, runs, registered models, model versions, traces, and assessments. Read-only by default.

References:
- MLflow MCP overview: https://mlflow.org/docs/latest/genai/mcp/
- MLflow REST API: https://mlflow.org/docs/latest/api_reference/rest-api.html

## Quick Start

```bash
# npx
npx @us-all/mlflow-mcp

# or install globally
npm i -g @us-all/mlflow-mcp
mlflow-mcp
```

### Claude Code

```bash
claude mcp add mlflow \
  -e MLFLOW_TRACKING_URI=http://localhost:5000 \
  -- npx @us-all/mlflow-mcp
```

### Claude Desktop / Cursor

Add to your MCP settings JSON:

```json
{
  "mcpServers": {
    "mlflow": {
      "command": "npx",
      "args": ["@us-all/mlflow-mcp"],
      "env": {
        "MLFLOW_TRACKING_URI": "http://localhost:5000",
        "MLFLOW_EXPERIMENT_ID": "0"
      }
    }
  }
}
```

### Docker

```bash
docker run --rm -i \
  -e MLFLOW_TRACKING_URI=http://your-host:5000 \
  ghcr.io/us-all/mlflow-mcp-server
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MLFLOW_TRACKING_URI` | Yes | MLflow tracking server URL (e.g. `http://localhost:5000`, Databricks workspace URL) |
| `MLFLOW_TRACKING_TOKEN` | No | Bearer token (e.g. Databricks PAT) |
| `MLFLOW_TRACKING_USERNAME` | No | Basic-auth username (alternative to token) |
| `MLFLOW_TRACKING_PASSWORD` | No | Basic-auth password |
| `MLFLOW_EXPERIMENT_ID` | No | Default experiment ID for tools that accept it implicitly |
| `MLFLOW_ALLOW_WRITE` | No | Set to `true` to enable create/update/delete operations (default: `false`) |

## Tools

### Experiments (9)
`create-experiment` `search-experiments` `get-experiment` `get-experiment-by-name` `update-experiment` `delete-experiment` `restore-experiment` `set-experiment-tag` `delete-experiment-tag`

### Runs (14)
`create-run` `get-run` `search-runs` `update-run` `delete-run` `restore-run` `log-metric` `log-param` `log-batch` `log-inputs` `get-metric-history` `set-run-tag` `delete-run-tag` `list-artifacts`

### Registered Models (12)
`create-registered-model` `get-registered-model` `search-registered-models` `rename-registered-model` `update-registered-model` `delete-registered-model` `get-latest-model-versions` `set-registered-model-tag` `delete-registered-model-tag` `set-registered-model-alias` `delete-registered-model-alias` `get-model-version-by-alias`

### Model Versions (9)
`create-model-version` `get-model-version` `search-model-versions` `update-model-version` `delete-model-version` `transition-model-version-stage` `get-model-version-download-uri` `set-model-version-tag` `delete-model-version-tag`

### Traces (6)
`search-traces` `get-trace` `get-trace-info` `delete-traces` `set-trace-tag` `delete-trace-tag`

### Assessments (5)
`log-feedback` `log-expectation` `get-assessment` `update-assessment` `delete-assessment`

## Local Development

```bash
pnpm install
pnpm build
node dist/index.js
```

### Local validation with docker compose

Brings up an MLflow tracking server (SQLite + local artifact store) so you can exercise the MCP tools against real data.

```bash
# 1. start MLflow (UI at http://localhost:5050)
docker compose up -d mlflow

# 2. seed demo experiment, runs, and a registered model with a 'champion' alias
docker compose run --rm seed

# 3a. probe the MCP server locally against the compose'd MLflow
MLFLOW_TRACKING_URI=http://localhost:5050 \
  MLFLOW_EXPERIMENT_ID=1 \
  MLFLOW_ALLOW_WRITE=true \
  node dist/index.js

# 3b. or run the MCP server inside compose (stdio)
docker compose run --rm mcp

# tear down (use -v to also drop seeded data)
docker compose down -v
```

`./dev/seed.py` is idempotent — it skips re-seeding if the `demo` experiment already has runs.

## License

MIT
