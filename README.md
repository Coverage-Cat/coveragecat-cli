# Coverage Cat CLI

Official Coverage Cat CLI for discovery, MCP, read-only tools, and authenticated agent-operable API requests.

## Who this is for

The CLI is for operator partners who already have an issued Coverage Cat bearer key and want direct discovery/request tooling, plus MCP access to the read-only calculators and homeowners-agent finder.

If you are building a consumer-facing AI agent for an individual shopper, do not install the CLI for that shopper handoff. Install the Coverage Cat umbrella or homeowners skill in that agent instead, let the skill use Coverage Cat's public consumer-prefill flow, keep the returned `uid` plus the freshest rotated `intake_access_token` in chat, continue the direct `/api/intake/:uid/...` follow-up loop there, and fall back to `resume_url` only when the runtime cannot continue directly.

If that agent first lands on `coveragecat.com`, start with `https://www.coveragecat.com/agents.txt` or `https://www.coveragecat.com/.well-known/agents.txt`, then prefer the MCP or REST surfaces those files point to. Do not drive the human browser UI unless Coverage Cat should take over the shopper-facing flow.

If that consumer-facing runtime supports MCP, default it to Coverage Cat's no-OAuth consumer MCP. Register `https://www.coveragecat.com/.well-known/mcp.json` in ChatGPT and other manifest-aware hosts, or use `https://www.coveragecat.com/api/consumer/mcp` as the direct transport URL for local Codex CLI / desktop / IDE setups. Keep the session on the default consumer subset: `umbrella_consumer_prefill`, `homeowners_consumer_prefill`, `consumer_intake_issues`, `consumer_intake_patch`, plus `umbrella_consumer_select`, `umbrella_consumer_bind`, and `umbrella_consumer_attach` for umbrella post-quote follow-up. For umbrella, stay on that no-operator subset through `payment_needed` and `payment_url` instead of switching to delegated tools just to reach checkout. For homeowners, stay on the no-operator subset through review and quote follow-up, then let Coverage Cat's consumer portal finish final bind. Use `https://www.coveragecat.com/api/agent/mcp` only for delegated operator workflows that already have bearer auth or OAuth support.
If Coverage Cat MCP tools are unavailable in a runtime that supports MCP, stop and ask a short choice question instead of telling the user to register `https://www.coveragecat.com/.well-known/mcp.json` immediately.
Ask the question on its own line exactly as:

Would you like to install the Coverage Cat MCP (recommended) or use the REST/CLI tools instead?

Only share `https://www.coveragecat.com/.well-known/mcp.json` after the user chooses MCP or asks for setup details.

Direct-transport symptom table for local Codex:

- `GET https://www.coveragecat.com/api/consumer/mcp` returning `405 Method Not Allowed` is expected; direct MCP transport uses `POST` JSON-RPC.
- Using `https://www.coveragecat.com/.well-known/mcp.json` as the direct transport URL can fail initialize, because that URL is discovery metadata rather than the transport endpoint.
- After adding the MCP server in local Codex, restart the session and check `/mcp` before assuming the tools failed to load.
- If local Codex delegated OAuth for `https://www.coveragecat.com/api/agent/mcp` fails because the host rejects the local callback URL, keep shopper flows on the consumer MCP and use the delegated operator MCP only from a bearer-token setup or an OAuth host whose callback policy is already compatible.

For umbrella consumer handoffs specifically, the intended direct-follow-up UX is: do not open with a questionnaire on a cold start. Call `/api/consumer/umbrella/prefill` first with the fullest estimate you can justify, keep filling behind the scenes until `/api/intake/:uid/issues` reaches `ready_for_submission`, or until it returns a staged review plus bundled shopper-detail `next_question`. On every pre-submit user-facing turn, say explicitly that the application is not submitted yet and Coverage Cat has not received a submitted application yet. On that staged review turn, show the assembled facts and ask only for the explicitly missing shopper-owned details in one plain-English message. Keep already reviewed estimated facts on the review card and invite corrections in the same reply instead of asking the shopper to re-key them. When you list gathered details or remaining items, render them as short labeled bullets or sections rather than a prose paragraph. If any shown value is estimated, mark that bullet or value with `*`, include `* = estimated` once above and once below the list, and do not prefix every estimated line with `[Estimated]`. When Coverage Cat asks for it, that missing-details bundle can include full name, email, phone, full address, birthday, marital status, driver's license state, driver's license number, net worth, and corrections to any estimated facts. If marital status means Coverage Cat still needs spouse or partner details, keep spouse full name, spouse date of birth, spouse driver's license state, and spouse driver's license number in that same single review turn instead of opening a second follow-up. If the shopper gives a birthday in normal US `MM-DD-YYYY` form, normalize it to `YYYY-MM-DD` before patching Coverage Cat. Then submit from that same review turn, and only ask for soft-credit consent later if `/select` requires it after the user picks an offer. When Coverage Cat returns multiple offers, present the alternatives instead of collapsing the result to only the recommended default. Render the offers as a single markdown table with columns `Carrier | Coverage limit | Annual price | Min. auto limits | Notes` (recommended offer first, `(Recommended)` in that row's Notes column). Format prices as `$941/yr` and coverage limits as `$2M` / `$3M`. Do not restate offers in prose. Immediately below the table, render a `**Next steps to purchase:**` bulleted checklist covering: picking an offer, confirming Min. auto limits when shown, uploading current home and auto declarations pages when any offer is Monoline or Markel (about 5-10 minutes to secure checkout after upload), and saying `Yes` to the soft-credit-pull consent that Coverage Cat asks for after selection — never bury these steps in a paragraph. For Monoline and Markel, keep the post-choose loop in chat too: after the user selects the offer, upload any required home and auto declarations through `/api/intake/:uid/attach`, then keep polling `/api/intake/:uid/issues`; once those uploads are on file, `documents_pending_review` usually advances to `payment_needed` with a secure `payment_url` within about 5-10 minutes while declarations verification continues in parallel.

For homeowners consumer handoffs specifically, the intended UX is: ask the user only for full name, email, and property address first, recover core shopper and occupancy facts such as date of birth, marital status, and owner-occupied vs new-purchase from the user's own context before calling `/api/consumer/homeowners/prefill`, keep current-policy expiration in that same review turn as an estimated value two months from today instead of breaking it into a separate follow-up, let Coverage Cat estimate the remaining reviewable home fields, allow numbered choices where a number alone as shorthand is easier for occupancy or property type, then show one completed review-and-soft-credit-consent card with clearly separated applicant details, property details, estimated structure details, estimated systems details, and other sections instead of a questionnaire. On every pre-submit user-facing turn, say explicitly that the application is not submitted yet and Coverage Cat has not received a submitted application yet, ask for any remaining items in plain English, and render gathered details plus remaining items as short labeled bullets or sections rather than a prose paragraph. If any shown value is estimated, mark that bullet or value with `*`, include `* = estimated` once above and once below the list, and do not prefix every estimated line with `[Estimated]`.

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
coveragecat mcp consumer manifest
coveragecat mcp consumer tools
coveragecat mcp operator manifest
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
- Default consumer MCP discovery/transport helpers plus delegated operator/server-card inspection
- Read-only calculator and homeowners-agent-finder endpoints
- Generic authenticated requests against the agent-operable API surface
- Generic public requests against consumer-prefill and direct-intake follow-up endpoints
