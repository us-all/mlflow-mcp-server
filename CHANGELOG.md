# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-04-27

### Fixed
- `serverInfo.version` reported by the MCP server was hardcoded to `"1.0.0"`. Now read
  from `package.json` at startup so it tracks the published version. Discovered when
  testing `npx @us-all/mlflow-mcp` — npm said 1.1.2 but `initialize` reported 1.0.0.

## [1.1.2] - 2026-04-27

### Changed
- **Minimum Node bumped to 20.x** (`engines.node: ">=20.0.0"`). Node 18 reached EOL
  in April 2025; vitest 4 also requires `node:util.styleText` (Node 20.12+).
  CI matrix is now `[20, 22]`. v1.1.1 CI failed because of this — fixed in v1.1.2.

### Fixed
- **Publish workflows now gate on tests.** `npm-publish.yml` and `docker-publish.yml`
  now run `pnpm test` before publishing. Previously they only ran `build`, so v1.1.1
  was published to npm even though `ci.yml` had failed (the workflows were independent).
  This was a structural CI/CD weakness.

## [1.1.1] - 2026-04-27

### Added
- vitest unit tests for `config`, `applyExtractFields`, and error sanitization (20 tests).
- `pnpm test` script wired into CI.
- `pnpm smoke` convenience script.
- `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`.

### Changed
- Docker images now built for `linux/amd64` + `linux/arm64` (was amd64-only).
  Apple Silicon hosts can now `docker pull ghcr.io/us-all/mlflow-mcp-server:1.1.1`.

## [1.1.0] - 2026-04-27

### Added
- **Logged Models (MLflow 3)** — 8 tools: `create-logged-model`, `search-logged-models`,
  `get-logged-model`, `finalize-logged-model`, `delete-logged-model`,
  `set-logged-model-tags`, `delete-logged-model-tag`, `log-logged-model-params`.
- **Convenience tools (3)** — `get-best-run`, `compare-runs` (with `differing_params` auto-detection),
  `search-runs-by-tags`.
- **MCP Prompts (4)** — workflow templates: `debug-failed-traces`, `promote-best-run`,
  `compare-top-runs`, `annotate-trace-quality`.
- **`extractFields` parameter** on `search-traces` and `get-trace` — comma-separated dotted
  paths with `*` wildcard for response slicing (token efficiency).
- `seed.py` now seeds `@mlflow.trace` traces alongside experiments/runs/models.
- GitHub Actions CI/CD: `ci.yml` (matrix build + live smoke against MLflow + gitleaks),
  `npm-publish.yml` (trusted publishing + provenance), `docker-publish.yml` (ghcr.io).

### Changed
- Targeting MLflow 3.x v3 REST endpoints (`/api/3.0/mlflow/...`) for traces and assessments.
- `MlflowClient`:
  - `DELETE` requests now send a JSON body (MLflow 3 rejects query-only DELETE).
  - Paths starting with `/api/` bypass the default `/api/2.0/mlflow` base — required to
    reach v3 endpoints.
  - Array query parameters are repeated (`append()`), supporting `experiment_ids[]`.
- `update-assessment` auto-builds a `FieldMask` from supplied fields (MLflow 3 makes it required).

### Fixed
- `delete-experiment-tag` now works (was 404 on MLflow 2.20; v3 added the REST endpoint).
- `delete-{registered-model,model-version}-tag`, `delete-registered-model-alias`,
  `delete-{registered-model,model-version}` — were 400 on body-less DELETE; fixed by
  client refactor.
- `search-traces` now uses `POST /api/3.0/mlflow/traces/search` with `locations` schema
  (was POST `/traces/search`, returning 405).
- `delete-traces` now uses `/api/2.0/mlflow/traces/delete-traces` (was `/traces/delete`).
- Trace tag operations migrated to v3 REST style: `PATCH /traces/{id}/tags`,
  `DELETE /traces/{id}/tags`.
- Assessment operations migrated to v3 REST: `/api/3.0/mlflow/traces/{id}/assessments[/{aid}]`.

## [1.0.0] - 2026-04-27

Initial public release.

### Added
- 55 MCP tools across experiments (9), runs (14), registered-models (12),
  model-versions (9), traces (6), assessments (5).
- Read-only by default; writes gated behind `MLFLOW_ALLOW_WRITE=true`.
- Bearer token (Databricks PAT) and Basic auth support via env vars.
- Sensitive-pattern redaction in error messages.
- Docker image and `dev/seed.py` + `dev/smoke.mjs` for local validation.
