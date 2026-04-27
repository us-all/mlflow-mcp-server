# Contributing

Thanks for considering a contribution. This is a small project — pragmatic patches
welcome.

## Development setup

```bash
git clone https://github.com/us-all/mlflow-mcp-server.git
cd mlflow-mcp-server
pnpm install
pnpm run build
```

### Local MLflow

Spin up MLflow + seed demo data with docker compose:

```bash
docker compose up -d mlflow
docker compose run --rm seed   # experiments, runs, model, traces
```

The MLflow UI is at <http://localhost:5050>.

### Run the server locally

```bash
MLFLOW_TRACKING_URI=http://localhost:5050 \
  MLFLOW_EXPERIMENT_ID=1 \
  MLFLOW_ALLOW_WRITE=true \
  node dist/index.js
```

## Tests

| Command | What it runs | Speed |
|---|---|---|
| `pnpm test` | vitest unit tests (config, extract-fields, sanitization) | ~150ms |
| `pnpm smoke` | Calls every tool against a live MLflow via stdio MCP | ~5–10s |

Smoke requires the docker compose MLflow to be up + seeded.

CI runs both on every push/PR (matrix: Node 18/20/22 for build+unit;
Node 22 for smoke against a Compose'd MLflow).

## Adding a new tool

1. Pick the right file under `src/tools/` (or create one if it's a new domain).
2. Export both a Zod schema (`*Schema`) and a handler. Use `assertWriteAllowed()`
   in any mutating handler.
3. For MLflow REST paths starting with `/api/`, the client treats them as absolute
   from `MLFLOW_TRACKING_URI` (bypassing the default `/api/2.0/mlflow` base).
4. Register the tool in `src/index.ts` with `server.tool(...)`.
5. Add a one-line entry in `README.md` under the appropriate section.
6. Cover it in `dev/smoke.mjs`. Order matters: read-only first, write next, destructive
   last (otherwise you'll delete fixtures the smoke still depends on).
7. If the change deserves it, add or update a unit test under `tests/unit/`.

## Releasing

Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
- Patch (`1.1.x`): bug fixes, internals, CI, docs.
- Minor (`1.x.0`): new tools, new prompts, backward-compatible schema additions.
- Major (`x.0.0`): breaking schema or behavior changes (none yet).

Steps:
1. Bump `version` in `package.json`.
2. Add a section to `CHANGELOG.md`.
3. Commit, then tag `vX.Y.Z` and push:
   ```bash
   git commit -m "X.Y.Z: <one-line summary>"
   git tag vX.Y.Z
   git push origin main --tags
   ```
4. The tag triggers `npm-publish.yml` and `docker-publish.yml`. A GitHub Release
   is generated automatically.

## Style

- Keep handler files thin — one Zod schema + one handler per tool, mirroring the
  REST endpoint shape.
- Don't introduce abstraction layers ahead of need (no "BaseTool" classes).
- Comments only for non-obvious *why* (constraints, hidden invariants), not *what*.
