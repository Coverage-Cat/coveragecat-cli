# Coverage Cat CLI

Official Coverage Cat CLI for discovery, MCP, read-only tools, and authenticated agent-operable API requests.

## Install from source

```sh
git clone https://github.com/Coverage-Cat/coveragecat-cli.git
cd coveragecat-cli
npm pack
npm install -g ./coveragecat-cli-0.1.0.tgz
coveragecat help
```

## Install with Homebrew

```sh
brew tap Coverage-Cat/coveragecat
brew install coveragecat
coveragecat help
```

The canonical Homebrew tap lives at `https://github.com/Coverage-Cat/homebrew-coveragecat`.

## Release model

- npm package: `@coveragecat/cli`
- source repo: `Coverage-Cat/coveragecat-cli`
- Homebrew tap: `Coverage-Cat/homebrew-coveragecat`

Tagged `v*` releases run the GitHub Actions workflow that tests this package, uploads the packed tarball to the GitHub release, and publishes `@coveragecat/cli` to npm when `NPM_TOKEN` is configured.

At the moment, install from the source repo or the Homebrew tap. The npm package name is reserved in the package metadata, but a live npm publication still requires org/package setup plus `NPM_TOKEN`.

## Common commands

```sh
coveragecat discover
coveragecat openapi yaml
coveragecat mcp product tools
coveragecat tool home_calculator --json '{"zip":"90210","home_sqft":1800}'
coveragecat batch --json '{"operations":[{"tool":"home_calculator","input":{"zip":"90210","home_sqft":1800}}]}'
coveragecat request POST /api/agent/homeowners/quotes \
  --bearer "$COVERAGECAT_BEARER" \
  --idempotency-key demo-1 \
  --json '{"uid":"abc123"}'
```

## Supported surfaces

- Discovery JSON and OpenAPI downloads
- Product and docs MCP server manifests plus list operations
- Read-only calculator and homeowners-agent-finder endpoints
- Generic authenticated requests against the agent-operable API surface
