# Coverage Cat CLI

Official Coverage Cat CLI for discovery, MCP, read-only tools, and authenticated agent-operable API requests.

## Who this is for

The CLI is for operator partners who already have an issued Coverage Cat bearer key and want direct discovery/request tooling, plus MCP access to the read-only calculators and homeowners-agent finder.

If you are building a consumer-facing AI agent for an individual shopper, do not install the CLI for that shopper handoff. Install the Coverage Cat umbrella or homeowners skill in that agent instead, let the skill use Coverage Cat's public consumer-prefill flow, keep the returned `uid` plus the freshest rotated `intake_access_token` in chat, continue the direct `/api/intake/:uid/...` follow-up loop there, and fall back to `resume_url` only when the runtime cannot continue directly.

For umbrella consumer handoffs specifically, the intended direct-follow-up UX is: keep filling behind the scenes until `/api/intake/:uid/issues` reaches `ready_for_submission`, or until it returns a staged review plus bundled contact-detail `next_question`. On that staged review turn, show the assembled facts and ask for full name, email, and full address together in one message rather than one field at a time. Then submit from that same review turn, and only ask for soft-credit consent later if `/select` requires it after the user picks an offer. When Coverage Cat returns multiple offers, present the alternatives instead of collapsing the result to only the recommended default.

For homeowners consumer handoffs specifically, the intended UX is: ask the user only for full name, email, and property address first, recover core shopper and occupancy facts such as date of birth, marital status, and owner-occupied vs new-purchase from the user's own context before calling `/api/consumer/homeowners/prefill`, let Coverage Cat estimate the remaining reviewable home fields, then show one completed review-and-soft-credit-consent card instead of a questionnaire.

## Install from npm

```sh
npm install -g @coveragecat/cli
coveragecat help
```

## Install from source

```sh
git clone https://github.com/Coverage-Cat/coveragecat-cli.git
cd coveragecat-cli
package_tgz="$(npm pack --silent)"
npm install -g "./$package_tgz"
coveragecat help
```

## Install with Homebrew

```sh
brew tap Coverage-Cat/coveragecat
brew trust coverage-cat/coveragecat
brew install coveragecat
coveragecat help
```

The canonical Homebrew tap lives at `https://github.com/Coverage-Cat/homebrew-coveragecat`.

## Release model

- npm package: `@coveragecat/cli`
- source repo: `Coverage-Cat/coveragecat-cli`
- Homebrew tap: `Coverage-Cat/homebrew-coveragecat`

Tagged `v*` releases run the GitHub Actions workflow that tests this package and uploads the packed tarball to the GitHub release. npm publication uses the same workflow only on an explicit manual dispatch with `publish_npm: true` when repository npm publish auth is configured.

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
coveragecat request POST /api/consumer/umbrella/prefill \
  --idempotency-key consumer-prefill-1 \
  --json '{"credit_consent_pending":true,"intake":{"full_name":"Taylor Example"}}'
coveragecat request GET /api/intake/abc123/issues \
  --bearer "$COVERAGECAT_INTAKE_ACCESS_TOKEN"
```

## Supported surfaces

- Discovery JSON and OpenAPI downloads
- Recommended product MCP well-known manifest and list operations
- Read-only calculator and homeowners-agent-finder endpoints
- Generic authenticated requests against the agent-operable API surface
- Generic public requests against consumer-prefill and direct-intake follow-up endpoints
