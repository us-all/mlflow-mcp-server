# Security Policy

## Read-Only by Default

All write/mutate operations are **blocked by default**. The server starts in read-only
mode to prevent accidental changes when used by AI agents.

To enable write operations, set the environment variable:

```
MLFLOW_ALLOW_WRITE=true
```

When the flag is unset (or anything other than the literal string `true`), every
write-gated tool returns:

```
Write operations are disabled. Set MLFLOW_ALLOW_WRITE=true to enable.
```

### Write-Gated Tools (47)

**Experiments** — `create-experiment`, `update-experiment`, `delete-experiment`,
`restore-experiment`, `set-experiment-tag`, `delete-experiment-tag`

**Runs** — `create-run`, `update-run`, `delete-run`, `restore-run`,
`log-metric`, `log-param`, `log-batch`, `log-inputs`,
`set-run-tag`, `delete-run-tag`

**Registered Models** — `create-registered-model`, `update-registered-model`,
`delete-registered-model`, `rename-registered-model`,
`set-registered-model-tag`, `delete-registered-model-tag`,
`set-registered-model-alias`, `delete-registered-model-alias`

**Model Versions** — `create-model-version`, `update-model-version`,
`delete-model-version`, `transition-model-version-stage`,
`set-model-version-tag`, `delete-model-version-tag`

**Logged Models** — `create-logged-model`, `finalize-logged-model`, `delete-logged-model`,
`set-logged-model-tags`, `delete-logged-model-tag`, `log-logged-model-params`

**Traces** — `delete-traces`, `set-trace-tag`, `delete-trace-tag`

**Assessments** — `log-feedback`, `log-expectation`, `update-assessment`, `delete-assessment`

## Credential Handling

### Environment Variables

| Variable | Purpose |
|---|---|
| `MLFLOW_TRACKING_URI` | Required. Tracking server URL. |
| `MLFLOW_TRACKING_TOKEN` | Bearer token (e.g. Databricks PAT). |
| `MLFLOW_TRACKING_USERNAME` / `MLFLOW_TRACKING_PASSWORD` | Basic auth alternative. |

**Best practices:**
- Use **least-privilege** scopes for tokens. For read-only use, never grant a token
  with write permissions — the MCP `MLFLOW_ALLOW_WRITE` flag is defense-in-depth, not
  the only line of defense.
- Never commit credentials to source control — use environment variables, a secrets
  manager, or your MCP client's secret store.
- Rotate tokens periodically.

### Error Sanitization

Before returning errors to the AI agent, the server redacts sensitive substrings:

- `MLFLOW_TRACKING_TOKEN`, `MLFLOW_TRACKING_PASSWORD`
- `Bearer <token>` and `Basic <encoded>` patterns
- Anything matching `api[_-]?key`, `password`, `secret` (case-insensitive)

Implemented in `src/tools/utils.ts` (`sanitize`). Verified by
`tests/unit/sanitize.test.ts`.

## Reporting a Vulnerability

If you discover a security issue, please email the maintainers directly rather than
opening a public issue. We aim to respond within 72 hours.
