const CLI_VERSION = "0.1.1";
const DEFAULT_BASE_URL = "https://www.coveragecat.com";

const TOOL_ENDPOINTS = {
  home_calculator: "/api/agent/calculators/home",
  umbrella_calculator: "/api/agent/calculators/umbrella",
  auto_estimates: "/api/agent/calculators/auto-estimates",
  collision_and_comprehensive_coverage: "/api/agent/calculators/collision-and-comprehensive-coverage",
  file_a_claim: "/api/agent/calculators/file-a-claim",
  homeowners_agent_finder: "/api/agent/tools/homeowners-agents/search"
};

const MCP_ENDPOINTS = {
  product: "/api/agent/mcp",
  docs: "/developers/mcp/server"
};

const HELP_TEXT = `Official Coverage Cat CLI

Usage:
  coveragecat help
  coveragecat discover
  coveragecat openapi [yaml|json]
  coveragecat mcp <product|docs> [manifest|initialize|tools|resources]
  coveragecat tool <tool_id> [--json '{"zip":"90210"}']
  coveragecat batch --json '{"operations":[...]}'
  coveragecat request <METHOD> <PATH> [--json '{...}']

Examples:
  coveragecat discover
  coveragecat openapi yaml
  coveragecat mcp product tools
  coveragecat tool home_calculator --json '{"zip":"90210","home_sqft":1800}'
  coveragecat request POST /api/agent/homeowners/quotes --bearer "$COVERAGECAT_BEARER" --idempotency-key demo-1 --json '{"uid":"abc123"}'

Global options:
  --base-url URL         Override the Coverage Cat base URL. Default: ${DEFAULT_BASE_URL}
  --bearer TOKEN         Send Authorization: Bearer TOKEN.
  --api-version VERSION  Send Coverage-Cat-API-Version on /api/agent requests. Default: v1
  --idempotency-key KEY  Send Idempotency-Key on POST, PUT, or PATCH requests.
  --header NAME:VALUE    Add an extra request header. Repeatable.
  --accept MIME          Override the Accept header.
  --json STRING          Parse STRING as the JSON request body.
  --help, -h             Show this help text.

Docs:
  https://www.coveragecat.com/developers/cli
`;

export async function runCli(
  argv,
  {
    fetchImpl = globalThis.fetch,
    stdout = process.stdout,
    stderr = process.stderr,
    env = process.env
  } = {}
) {
  try {
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch is unavailable. Use Node 20+ or pass fetchImpl explicitly.");
    }

    const parsed = parseArgs(argv, env);

    if (parsed.options.help || parsed.positionals.length === 0 || parsed.positionals[0] === "help") {
      stdout.write(HELP_TEXT);
      return 0;
    }

    if (parsed.positionals[0] === "version") {
      stdout.write(`${CLI_VERSION}\n`);
      return 0;
    }

    const response = await dispatch(parsed, fetchImpl);
    const output = formatResponse(response);

    if (response.ok) {
      stdout.write(output);
      return 0;
    }

    stderr.write(output);
    return 1;
  } catch (error) {
    stderr.write(`coveragecat: ${error.message}\n`);
    return 1;
  }
}

function parseArgs(argv, env) {
  const options = {
    accept: null,
    apiVersion: env.COVERAGECAT_API_VERSION || "v1",
    baseUrl: env.COVERAGECAT_BASE_URL || DEFAULT_BASE_URL,
    bearer: env.COVERAGECAT_BEARER || null,
    headers: [],
    help: false,
    idempotencyKey: null,
    json: null
  };

  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--accept":
        options.accept = requireValue(argv, ++index, arg);
        break;
      case "--api-version":
        options.apiVersion = requireValue(argv, ++index, arg);
        break;
      case "--base-url":
        options.baseUrl = requireValue(argv, ++index, arg);
        break;
      case "--bearer":
        options.bearer = requireValue(argv, ++index, arg);
        break;
      case "--header":
        options.headers.push(requireValue(argv, ++index, arg));
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--idempotency-key":
        options.idempotencyKey = requireValue(argv, ++index, arg);
        break;
      case "--json":
        options.json = requireValue(argv, ++index, arg);
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option ${arg}. Run 'coveragecat help'.`);
        }

        positionals.push(arg);
        break;
    }
  }

  return { options, positionals };
}

function requireValue(argv, index, optionName) {
  const value = argv[index];

  if (!value) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

async function dispatch({ options, positionals }, fetchImpl) {
  const [command, ...rest] = positionals;

  switch (command) {
    case "discover":
    case "discovery":
      return jsonRequest(fetchImpl, options, "GET", "/api/agent");

    case "openapi":
      return openapiCommand(fetchImpl, options, rest);

    case "mcp":
      return mcpCommand(fetchImpl, options, rest);

    case "tool":
      return toolCommand(fetchImpl, options, rest);

    case "batch":
      return batchCommand(fetchImpl, options);

    case "request":
      return requestCommand(fetchImpl, options, rest);

    default:
      throw new Error(`Unknown command '${command}'. Run 'coveragecat help'.`);
  }
}

function openapiCommand(fetchImpl, options, args) {
  const format = args[0] || "yaml";

  if (format === "json") {
    return jsonRequest(fetchImpl, options, "GET", "/openapi.json");
  }

  if (format === "yaml") {
    return request(fetchImpl, options, {
      accept: options.accept || "text/yaml",
      method: "GET",
      path: "/api/agent/openapi.yaml"
    });
  }

  throw new Error("openapi accepts only 'yaml' or 'json'.");
}

function mcpCommand(fetchImpl, options, args) {
  const server = args[0];
  const action = args[1] || "manifest";

  if (!server || !Object.hasOwn(MCP_ENDPOINTS, server)) {
    throw new Error("mcp requires 'product' or 'docs' as the server.");
  }

  const path = MCP_ENDPOINTS[server];

  switch (action) {
    case "manifest":
      return jsonRequest(fetchImpl, options, "GET", path);

    case "initialize":
      return jsonRequest(fetchImpl, options, "POST", path, {
        body: {
          id: "cli-initialize",
          jsonrpc: "2.0",
          method: "initialize"
        }
      });

    case "resources":
      return jsonRequest(fetchImpl, options, "POST", path, {
        body: {
          id: "cli-resources",
          jsonrpc: "2.0",
          method: "resources/list"
        }
      });

    case "tools":
      return jsonRequest(fetchImpl, options, "POST", path, {
        body: {
          id: "cli-tools",
          jsonrpc: "2.0",
          method: "tools/list"
        }
      });

    default:
      throw new Error("mcp actions are manifest, initialize, resources, or tools.");
  }
}

function toolCommand(fetchImpl, options, args) {
  const toolId = args[0];
  const path = TOOL_ENDPOINTS[toolId];

  if (!toolId || !path) {
    const knownTools = Object.keys(TOOL_ENDPOINTS).join(", ");
    throw new Error(`tool requires one of: ${knownTools}`);
  }

  return jsonRequest(fetchImpl, options, "POST", path, {
    body: parseJsonOption(options.json, {})
  });
}

function batchCommand(fetchImpl, options) {
  const parsed = parseJsonOption(options.json);

  if (parsed === null) {
    throw new Error("batch requires --json with either an operations array or a full batch object.");
  }

  const body = Array.isArray(parsed) ? { operations: parsed } : parsed;
  return jsonRequest(fetchImpl, options, "POST", "/api/agent/tools/batch", { body });
}

function requestCommand(fetchImpl, options, args) {
  const method = args[0];
  const path = args[1];

  if (!method || !path) {
    throw new Error("request requires both an HTTP method and a path.");
  }

  const upperMethod = method.toUpperCase();
  const body = options.json ? parseJsonOption(options.json) : undefined;

  return request(fetchImpl, options, {
    accept: options.accept || "application/json",
    body,
    method: upperMethod,
    path
  });
}

function parseJsonOption(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON for --json: ${error.message}`);
  }
}

function jsonRequest(fetchImpl, options, method, path, { body } = {}) {
  return request(fetchImpl, options, {
    accept: options.accept || "application/json",
    body,
    method,
    path
  });
}

async function request(fetchImpl, options, { accept, body, method, path }) {
  const pathname = requestPath(path, options.baseUrl);
  const headers = buildHeaders(options, { accept, body, method, pathname });
  const url = absoluteUrl(path, options.baseUrl);

  const response = await fetchImpl(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method
  });

  const { contentType, parsedBody } = await parseResponseBody(response);

  return {
    body: parsedBody,
    contentType,
    ok: response.ok,
    status: response.status
  };
}

function buildHeaders(options, { accept, body, method, pathname }) {
  const headers = {};

  if (accept) {
    headers.accept = accept;
  }

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (options.bearer) {
    headers.authorization = `Bearer ${options.bearer}`;
  }

  if (options.apiVersion && agentApiPath(pathname)) {
    headers["coverage-cat-api-version"] = options.apiVersion;
  }

  if (options.idempotencyKey && ["PATCH", "POST", "PUT"].includes(method)) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  for (const header of options.headers) {
    const separatorIndex = header.indexOf(":");

    if (separatorIndex <= 0) {
      throw new Error(`Invalid --header value '${header}'. Expected NAME:VALUE.`);
    }

    const name = header.slice(0, separatorIndex).trim();
    const value = header.slice(separatorIndex + 1).trim();

    headers[name] = value;
  }

  return headers;
}

async function parseResponseBody(response) {
  const contentType = response.headers?.get?.("content-type") || "";

  if (contentType.includes("application/json")) {
    return {
      contentType,
      parsedBody: await response.json()
    };
  }

  return {
    contentType,
    parsedBody: await response.text()
  };
}

function formatResponse({ body, ok, status }) {
  const renderedBody = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  const suffix = renderedBody.endsWith("\n") ? renderedBody : `${renderedBody}\n`;

  if (ok) {
    return suffix;
  }

  return `HTTP ${status}\n${suffix}`;
}

function absoluteUrl(path, baseUrl) {
  try {
    return new URL(path).toString();
  } catch (_error) {
    return new URL(path, ensureTrailingSlash(baseUrl)).toString();
  }
}

function requestPath(path, baseUrl) {
  return new URL(absoluteUrl(path, baseUrl)).pathname;
}

function ensureTrailingSlash(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function agentApiPath(pathname) {
  return pathname === "/openapi.json" || pathname.startsWith("/api/agent") || pathname === "/api/openapi.yaml";
}
