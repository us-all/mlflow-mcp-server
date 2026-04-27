#!/usr/bin/env node
// Smoke-test every MCP tool against a live MLflow.
// Requires the demo experiment+runs+model+traces to be seeded.

import { spawn } from "node:child_process";

const env = {
  ...process.env,
  MLFLOW_TRACKING_URI: process.env.MLFLOW_TRACKING_URI ?? "http://localhost:5050",
  MLFLOW_EXPERIMENT_ID: process.env.MLFLOW_EXPERIMENT_ID ?? "1",
  MLFLOW_ALLOW_WRITE: "true",
};

const proc = spawn("node", ["dist/index.js"], {
  env,
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
proc.stdout.on("data", (d) => {
  buf += d.toString();
  const lines = buf.split("\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id != null && pending.has(msg.id)) {
        const r = pending.get(msg.id);
        pending.delete(msg.id);
        r(msg);
      }
    } catch {}
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 15000);
  });
}
function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const results = [];
async function call(name, args) {
  let resp;
  try {
    resp = await rpc("tools/call", { name, arguments: args });
  } catch (e) {
    results.push({ name, ok: false, info: `transport: ${e.message}` });
    console.log(`✗ ${name} — transport: ${e.message}`);
    return null;
  }
  if (resp.error) {
    results.push({ name, ok: false, info: `rpc-error: ${resp.error.message}` });
    console.log(`✗ ${name} — rpc-error: ${resp.error.message}`);
    return null;
  }
  const text = resp.result.content?.[0]?.text ?? "";
  const isError = resp.result.isError === true;
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (isError) {
    const msg = typeof parsed === "object" ? parsed.message ?? JSON.stringify(parsed) : String(parsed);
    results.push({ name, ok: false, info: `tool-error: ${msg.slice(0, 200)}` });
    console.log(`✗ ${name} — ${msg.slice(0, 200)}`);
    return null;
  }
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
  return parsed;
}

const PREFIX = `mcp-smoke-${Date.now()}`;

(async () => {
  // initialize
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  notify("notifications/initialized", {});

  // === read-only on existing seed data ===
  await call("search-experiments", { maxResults: 10 });
  await call("get-experiment", { experimentId: "1" });
  await call("get-experiment-by-name", { experimentName: "demo" });

  const runsResp = await call("search-runs", { experimentIds: ["1"], maxResults: 5 });
  const seedRunId = runsResp?.runs?.[0]?.info?.run_id;
  if (!seedRunId) throw new Error("no seed run found");

  await call("get-run", { runId: seedRunId });
  await call("get-metric-history", { runId: seedRunId, metricKey: "loss" });
  await call("list-artifacts", { runId: seedRunId });

  await call("search-registered-models", { maxResults: 10 });
  await call("get-registered-model", { name: "demo-classifier" });
  await call("get-latest-model-versions", { name: "demo-classifier" });
  await call("get-model-version-by-alias", { name: "demo-classifier", alias: "champion" });
  await call("get-model-version", { name: "demo-classifier", version: "1" });
  await call("search-model-versions", { maxResults: 10 });
  await call("get-model-version-download-uri", { name: "demo-classifier", version: "1" });

  const tracesResp = await call("search-traces", { experimentIds: ["1"], maxResults: 5 });
  const t0 = tracesResp?.traces?.[0];
  const seedTraceId =
    t0?.trace_id ??
    t0?.request_id ??
    t0?.info?.trace_id ??
    t0?.info?.request_id ??
    t0?.trace_info?.trace_id ??
    t0?.trace_info?.request_id;
  if (!seedTraceId) console.warn("WARN: no trace id parsed; downstream trace tools may fail");
  if (seedTraceId) {
    await call("get-trace", { traceId: seedTraceId });
    await call("get-trace-info", { traceId: seedTraceId });
  }

  // === write: experiment ===
  const expName = `${PREFIX}-exp`;
  const createdExp = await call("create-experiment", { name: expName });
  const expId = createdExp?.experiment_id;
  if (!expId) throw new Error("create-experiment failed");

  await call("update-experiment", { experimentId: expId, newName: `${expName}-renamed` });
  await call("set-experiment-tag", { experimentId: expId, key: "smoke", value: "yes" });
  await call("delete-experiment-tag", { experimentId: expId, key: "smoke" });

  // === write: run ===
  const createdRun = await call("create-run", { experimentId: expId, runName: "smoke-run" });
  const runId = createdRun?.run?.info?.run_id;
  if (!runId) throw new Error("create-run failed");

  await call("log-param", { runId, key: "algo", value: "test" });
  await call("log-metric", { runId, key: "loss", value: 0.42 });
  await call("log-batch", {
    runId,
    metrics: [{ key: "acc", value: 0.9, timestamp: Date.now() }],
    params: [{ key: "bs", value: "32" }],
    tags: [{ key: "phase", value: "smoke" }],
  });
  await call("log-inputs", {
    runId,
    datasets: [{
      dataset: { name: "test-ds", digest: "abc", source_type: "local", source: "/tmp/foo" },
    }],
  });
  await call("set-run-tag", { runId, key: "owner", value: "smoke" });
  await call("delete-run-tag", { runId, key: "owner" });
  await call("update-run", { runId, status: "FINISHED", endTime: Date.now() });
  await call("delete-run", { runId });
  await call("restore-run", { runId });

  // === write: registered model ===
  const modelName = `${PREFIX}-model`;
  await call("create-registered-model", { name: modelName, description: "smoke" });
  await call("update-registered-model", { name: modelName, description: "smoke v2" });
  await call("set-registered-model-tag", { name: modelName, key: "stage", value: "qa" });
  await call("delete-registered-model-tag", { name: modelName, key: "stage" });

  // === write: model version (need a run with artifact path) ===
  const mvSource = `runs:/${runId}/model`;
  const mv = await call("create-model-version", { name: modelName, source: mvSource, runId });
  const mvVersion = mv?.model_version?.version;
  if (!mvVersion) throw new Error("create-model-version failed");

  await call("get-model-version", { name: modelName, version: mvVersion });
  await call("update-model-version", { name: modelName, version: mvVersion, description: "smoke mv" });
  await call("set-model-version-tag", { name: modelName, version: mvVersion, key: "qa", value: "ok" });
  await call("delete-model-version-tag", { name: modelName, version: mvVersion, key: "qa" });
  await call("transition-model-version-stage", { name: modelName, version: mvVersion, stage: "Staging" });

  // alias round-trip
  await call("set-registered-model-alias", { name: modelName, alias: "smoke", version: mvVersion });
  await call("delete-registered-model-alias", { name: modelName, alias: "smoke" });

  // rename
  const renamedModel = `${modelName}-renamed`;
  await call("rename-registered-model", { name: modelName, newName: renamedModel });

  // === traces: write ===
  if (seedTraceId) {
    await call("set-trace-tag", { traceId: seedTraceId, key: "smoke", value: "yes" });
    await call("delete-trace-tag", { traceId: seedTraceId, key: "smoke" });

    // === assessments ===
    const fb = await call("log-feedback", {
      traceId: seedTraceId,
      name: "helpfulness",
      value: 0.8,
      rationale: "smoke",
      source: { source_type: "HUMAN", source_id: "smoke@local" },
    });
    const fbId = fb?.assessment?.assessment_id;
    const exp_ = await call("log-expectation", {
      traceId: seedTraceId,
      name: "expected",
      value: "hello-world-ping",
      source: { source_type: "HUMAN" },
    });
    if (fbId) {
      await call("get-assessment", { traceId: seedTraceId, assessmentId: fbId });
      await call("update-assessment", { traceId: seedTraceId, assessmentId: fbId, rationale: "updated" });
      await call("delete-assessment", { traceId: seedTraceId, assessmentId: fbId });
    } else {
      results.push({ name: "get-assessment", ok: false, info: "no assessment_id from log-feedback" });
      results.push({ name: "update-assessment", ok: false, info: "no assessment_id from log-feedback" });
      results.push({ name: "delete-assessment", ok: false, info: "no assessment_id from log-feedback" });
    }
  } else {
    for (const n of ["set-trace-tag","delete-trace-tag","log-feedback","log-expectation","get-assessment","update-assessment","delete-assessment"]) {
      results.push({ name: n, ok: false, info: "skipped: no seed trace" });
    }
  }

  // === cleanup destructive ===
  await call("delete-model-version", { name: renamedModel, version: mvVersion });
  await call("delete-registered-model", { name: renamedModel });

  // delete-traces by id (uses smoke prefix tag — instead delete by id list)
  await call("delete-traces", { experimentId: "1", traceIds: seedTraceId ? [seedTraceId] : ["nonexistent"] });

  await call("delete-experiment", { experimentId: expId });
  await call("restore-experiment", { experimentId: expId });
  // final cleanup: delete again
  await call("delete-experiment", { experimentId: expId });

  // shutdown
  proc.stdin.end();
  setTimeout(() => proc.kill(), 500);

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\n=== ${passed}/${results.length} passed ===`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.info}`);
  }
  // unique tools tested
  const tools = new Set(results.map(r => r.name));
  console.log(`\nUnique tools exercised: ${tools.size}`);
  process.exit(failed.length > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e);
  proc.kill();
  process.exit(2);
});
