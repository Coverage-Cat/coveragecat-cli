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

test("integrations fetches the well-known integrations declaration", async () => {
  const stdout = capture();
  const calls = [];

  const exitCode = await runCli(["integrations"], {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ version: 3 });
    },
    stdout: stdout.stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/.well-known/integrations.json");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.accept, "application/json");
  assert.equal(stdout.text(), '{\n  "version": 3\n}\n');
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


test("feedback sends a message with a retry identifier without requiring auth", async () => {
  const calls = [];
  const stdout = capture();
  const code = await runCli(["feedback", "The quote table is hard to read"], {
    env: {}, stdout: stdout.stream,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ feedback_id: JSON.parse(options.body).request_id, status: "received" });
    }
  });
  assert.equal(code, 0);
  assert.equal(calls[0].url, "https://www.coveragecat.com/api/agent/feedback");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, undefined);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.message, "The quote table is hard to read");
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(stdout.text()).feedback_id, body.request_id);
});

test("feedback preserves structured category, tool and retry identifier", async () => {
  const body = { message: "Select returned an error", category: "bug", tool: "umbrella_consumer_select", request_id: "fe1ca5eb-bf87-4c31-952a-f14c180f4320" };
  let posted;
  const code = await runCli(["feedback", "--json", JSON.stringify(body)], {
    env: {}, stdout: capture().stream,
    fetchImpl: async (_url, options) => {
      posted = JSON.parse(options.body);
      return jsonResponse({ feedback_id: body.request_id, status: "received" });
    }
  });
  assert.equal(code, 0);
  assert.deepEqual(posted, body);
});

for (const args of [[], ["  "], ["one", "two"], ["text", "--json", '{}'], ["--json", '[]'], ["--json", 'null'], ["--json", '{"message":7}']]) {
  test(`feedback rejects invalid input ${JSON.stringify(args)} before sending`, async () => {
    const code = await runCli(["feedback", ...args], {
      env: {}, stderr: capture().stream,
      fetchImpl: async () => assert.fail("invalid feedback must not be sent")
    });
    assert.equal(code, 1);
  });
}

test("feedback reports a failed save instead of success", async () => {
  const stderr = capture();
  const code = await runCli(["feedback", "Unable to select an offer"], {
    env: {}, stderr: stderr.stream,
    fetchImpl: async () => jsonResponse({ error: "service_unavailable" }, { ok: false, status: 503 })
  });
  assert.equal(code, 1);
  assert.match(stderr.text(), /HTTP 503/);
});


test("feedback exposes its retry identifier after a lost response without echoing text", async () => {
  const stderr = capture();
  let saved;
  const message = "A private technical observation";
  const code = await runCli(["feedback", message], {
    env: {}, stderr: stderr.stream,
    fetchImpl: async (_url, options) => {
      saved = JSON.parse(options.body);
      throw new Error("Connection lost");
    }
  });
  assert.equal(code, 1);
  assert.ok(stderr.text().includes(saved.request_id));
  assert.ok(!stderr.text().includes(message));
  const retried = await runCli(["feedback", "--json", JSON.stringify({ message, request_id: saved.request_id })], {
    env: {}, stdout: capture().stream,
    fetchImpl: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), saved);
      return jsonResponse({ feedback_id: saved.request_id, status: "received" });
    }
  });
  assert.equal(retried, 0);
});
