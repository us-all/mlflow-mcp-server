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

  // === MCP prompts ===
  const promptsList = await rpc("prompts/list", {});
  const promptCount = promptsList?.result?.prompts?.length ?? 0;
  if (promptCount >= 4) {
    results.push({ name: "prompts/list", ok: true });
    console.log(`✓ prompts/list (${promptCount} prompts)`);
  } else {
    results.push({ name: "prompts/list", ok: false, info: `expected ≥4, got ${promptCount}` });
    console.log(`✗ prompts/list (${promptCount})`);
  }
  const getPrompt = await rpc("prompts/get", {
    name: "promote-best-run",
    arguments: { experimentId: "1", metric: "accuracy", modelName: "demo-classifier" },
  });
  const msg = getPrompt?.result?.messages?.[0]?.content?.text ?? "";
  if (msg.includes("get-best-run") && msg.includes("create-model-version")) {
    results.push({ name: "prompts/get:promote-best-run", ok: true });
    console.log(`✓ prompts/get:promote-best-run`);
  } else {
    results.push({ name: "prompts/get:promote-best-run", ok: false, info: msg.slice(0, 100) });
    console.log(`✗ prompts/get:promote-best-run`);
  }

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

  // === convenience tools (read-only) ===
  const best = await call("get-best-run", { experimentId: "1", metric: "accuracy", ascending: false });
  if (!best?.run?.info?.run_id) {
    results.push({ name: "get-best-run:check", ok: false, info: "no run returned" });
    console.log("✗ get-best-run:check");
  } else {
    results.push({ name: "get-best-run:check", ok: true });
    console.log("✓ get-best-run:check");
  }

  // pick 2 run ids from the experiment for compare-runs
  const compareIds = (runsResp?.runs ?? []).slice(0, 2).map(r => r.info.run_id);
  if (compareIds.length === 2) {
    const cmp = await call("compare-runs", { runIds: compareIds });
    if (!cmp?.metrics || !cmp?.params || !Array.isArray(cmp?.differing_params)) {
      results.push({ name: "compare-runs:shape", ok: false, info: "missing fields" });
      console.log("✗ compare-runs:shape");
    } else {
      results.push({ name: "compare-runs:shape", ok: true });
      console.log(`✓ compare-runs:shape (differing params: ${cmp.differing_params.length})`);
    }
  }

  await call("search-runs-by-tags", { experimentIds: ["1"], tags: { owner: "demo", env: "local" }, maxResults: 5 });

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

    // extract_fields smoke
    const sliced = await call("search-traces", {
      experimentIds: ["1"],
      maxResults: 2,
      extractFields: "traces.*.trace_id,traces.*.trace_location",
    });
    const t = sliced?.traces?.[0];
    if (!t || !("trace_id" in t) || "tags" in t) {
      results.push({ name: "extract_fields:search-traces", ok: false, info: `unexpected shape: ${JSON.stringify(t).slice(0,200)}` });
      console.log(`✗ extract_fields:search-traces — unexpected shape`);
    } else {
      results.push({ name: "extract_fields:search-traces", ok: true });
      console.log(`✓ extract_fields:search-traces (kept ${Object.keys(t).length} keys)`);
    }
    const slicedTrace = await call("get-trace", {
      traceId: seedTraceId,
      extractFields: "trace.trace_info.trace_id",
    });
    const ti = slicedTrace?.trace?.trace_info;
    if (!ti || !("trace_id" in ti) || Object.keys(ti).length !== 1) {
      results.push({ name: "extract_fields:get-trace", ok: false, info: `unexpected: ${JSON.stringify(slicedTrace).slice(0,200)}` });
      console.log(`✗ extract_fields:get-trace`);
    } else {
      results.push({ name: "extract_fields:get-trace", ok: true });
      console.log(`✓ extract_fields:get-trace`);
    }

    // maxResults clamp — server-side cap is 500 on MLflow 3.12+. Without the
    // client-side Math.min, the request errors out as INVALID_PARAMETER_VALUE.
    try {
      const clamped = await call("search-traces", { experimentIds: ["1"], maxResults: 1000 });
      if (!Array.isArray(clamped?.traces)) throw new Error(`unexpected: ${JSON.stringify(clamped).slice(0, 200)}`);
      results.push({ name: "search-traces:maxResults-clamp", ok: true });
      console.log(`✓ search-traces:maxResults-clamp (1000 -> server cap)`);
    } catch (e) {
      results.push({ name: "search-traces:maxResults-clamp", ok: false, info: String(e.message ?? e) });
      console.log(`✗ search-traces:maxResults-clamp — ${e.message ?? e}`);
    }

    // pageToken round-trip — verify the token from page 1 is accepted on page 2.
    const page1 = await call("search-traces", { experimentIds: ["1"], maxResults: 1 });
    const token = page1?.next_page_token;
    if (!token) {
      results.push({ name: "search-traces:pageToken-roundtrip", ok: false, info: "no next_page_token on page 1 (need ≥2 seeded traces)" });
      console.log(`✗ search-traces:pageToken-roundtrip — no token`);
    } else {
      try {
        const page2 = await call("search-traces", { experimentIds: ["1"], maxResults: 1, pageToken: token });
        if (!Array.isArray(page2?.traces)) throw new Error(`unexpected: ${JSON.stringify(page2).slice(0, 200)}`);
        results.push({ name: "search-traces:pageToken-roundtrip", ok: true });
        console.log(`✓ search-traces:pageToken-roundtrip`);
      } catch (e) {
        results.push({ name: "search-traces:pageToken-roundtrip", ok: false, info: String(e.message ?? e) });
        console.log(`✗ search-traces:pageToken-roundtrip — ${e.message ?? e}`);
      }
    }
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

  // === logged-models (MLflow 3) ===
  const lm = await call("create-logged-model", {
    experimentId: expId,
    name: `${PREFIX}-lm`,
    modelType: "sklearn",
    sourceRunId: runId,
    params: [{ key: "alpha", value: "0.5" }],
    tags: [{ key: "phase", value: "smoke" }],
  });
  const lmId = lm?.model?.info?.model_id;
  if (!lmId) throw new Error("create-logged-model failed");

  await call("get-logged-model", { modelId: lmId });
  await call("search-logged-models", { experimentIds: [expId], maxResults: 5 });
  await call("set-logged-model-tags", { modelId: lmId, tags: [{ key: "smoke", value: "yes" }] });
  await call("delete-logged-model-tag", { modelId: lmId, key: "smoke" });
  await call("log-logged-model-params", { modelId: lmId, params: [{ key: "extra", value: "v" }] });
  await call("finalize-logged-model", { modelId: lmId, status: "READY" });
  await call("delete-logged-model", { modelId: lmId });

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
