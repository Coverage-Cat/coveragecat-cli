import assert from "node:assert/strict";
import test from "node:test";

import { runCli } from "../lib/cli.js";

function capture() {
  const chunks = [];

  return {
    stream: {
      write(chunk) {
        chunks.push(chunk);
      },
    },
    text() {
      return chunks.join("");
    },
  };
}

function jsonResponse(body, { ok = true, status = 200, contentType = "application/json" } = {}) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    json: async () => body,
    ok,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("discover fetches the public discovery document", async () => {
  const stdout = capture();
  const stderr = capture();
  const calls = [];

  const exitCode = await runCli(["discover"], {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ service: "coverage-cat-agent-api" });
    },
    stderr: stderr.stream,
    stdout: stdout.stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/agent");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.accept, "application/json");
  assert.equal(stdout.text(), '{\n  "service": "coverage-cat-agent-api"\n}\n');
  assert.equal(stderr.text(), "");
});

test("tool command posts JSON to the matching read-only tool endpoint", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(
    ["tool", "home_calculator", "--json", '{"zip":"90210","home_sqft":1800}'],
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ estimate: { annual_mid: 1234 } });
      },
      stdout: stdout.stream,
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/agent/calculators/home");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.equal(calls[0].options.headers["coverage-cat-api-version"], "v1");
  assert.deepEqual(JSON.parse(calls[0].options.body), { home_sqft: 1800, zip: "90210" });
  assert.match(stdout.text(), /"annual_mid": 1234/);
});

test("generic request sends bearer, version, and idempotency headers", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(
    [
      "request",
      "POST",
      "/api/agent/homeowners/quotes",
      "--bearer",
      "operator-key",
      "--idempotency-key",
      "demo-1",
      "--json",
      '{"uid":"abc123"}',
    ],
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ status: "pending_quotes", uid: "abc123" }, { status: 202 });
      },
      stdout: stdout.stream,
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/agent/homeowners/quotes");
  assert.equal(calls[0].options.headers.authorization, "Bearer operator-key");
  assert.equal(calls[0].options.headers["coverage-cat-api-version"], "v1");
  assert.equal(calls[0].options.headers["idempotency-key"], "demo-1");
  assert.deepEqual(JSON.parse(calls[0].options.body), { uid: "abc123" });
  assert.match(stdout.text(), /"pending_quotes"/);
});

test("consumer prefill requests also send the API version header", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(
    [
      "request",
      "POST",
      "/api/consumer/umbrella/prefill",
      "--idempotency-key",
      "consumer-prefill-1",
      "--json",
      '{"credit_consent_pending":true,"intake":{"full_name":"Taylor Example"}}',
    ],
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ uid: "abc123", intake_access_token: "token-1" });
      },
      stdout: stdout.stream,
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/consumer/umbrella/prefill");
  assert.equal(calls[0].options.headers["coverage-cat-api-version"], "v1");
  assert.equal(calls[0].options.headers["idempotency-key"], "consumer-prefill-1");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    credit_consent_pending: true,
    intake: { full_name: "Taylor Example" },
  });
  assert.match(stdout.text(), /"intake_access_token": "token-1"/);
});

test("direct intake follow-up requests send bearer and API version headers", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(
    ["request", "GET", "/api/intake/abc123/issues", "--bearer", "intake-token"],
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ resource: { status: "ready_for_review" } });
      },
      stdout: stdout.stream,
    },
  );

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/intake/abc123/issues");
  assert.equal(calls[0].options.headers.authorization, "Bearer intake-token");
  assert.equal(calls[0].options.headers["coverage-cat-api-version"], "v1");
  assert.match(stdout.text(), /"ready_for_review"/);
});

test("mcp consumer tools posts a JSON-RPC tools/list request to the consumer transport", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(["mcp", "consumer", "tools"], {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ jsonrpc: "2.0", result: { tools: [] } });
    },
    stdout: stdout.stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/consumer/mcp");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    id: "cli-tools",
    jsonrpc: "2.0",
    method: "tools/list",
  });
  assert.match(stdout.text(), /"tools": \[\]/);
});

test("mcp product manifest keeps the legacy alias but fetches consumer discovery metadata", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(["mcp", "product", "manifest"], {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ name: "coverage-cat-product-mcp" });
    },
    stdout: stdout.stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/.well-known/mcp.json");
  assert.equal(calls[0].options.method, "GET");
  assert.match(stdout.text(), /"coverage-cat-product-mcp"/);
});
