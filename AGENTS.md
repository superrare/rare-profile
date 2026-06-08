# AGENTS.md

## Development Approach

Build around a functional core and an imperative shell.

The functional core is pure logic: inputs in, outputs out. It owns argument parsing, validation, normalization, output shaping, error classification, and other decisions. It must not perform I/O, HTTP calls, file access, logging, or set `process.exitCode` directly.

The imperative shell is the thin orchestration layer. It reads config and environment, makes HTTP calls, reads files, writes to stdout, and sets process behavior, then passes plain data into the functional core. In this repo, `src/cli/bin.ts`, the command handlers in `src/cli/commands/**`, config I/O in `src/cli/config.ts`, and the SDK transport/auth/domains in `src/sdk/**` are shell code. The pure helpers in `src/cli/args.ts` (`parseArgs`) and `src/cli/output.ts` (`renderSuccess`, `renderError`, `classifyError`) are core code.

## Scope

`rare-profile` is a **wallet-less** CLI + SDK for managing a rare.xyz profile over HTTP. It does **not** buy, move funds, or mint/deploy/auction NFTs — those stay on the rare.xyz website and the separate `@rareprotocol/rare-cli`. The `purchase` and `wallet` scopes exist in `src/sdk/scopes.ts` for type completeness but are never requested at login and are rejected server-side for CLI tokens. Do not add commands or SDK methods that move money or touch a wallet.

## Boundaries

- Put decisions in pure functions before wiring them into commands or SDK methods.
- Keep the CLI mostly as a thin wrapper around the SDK. Command handlers should validate input, call one or a few SDK methods, and shape output — nothing more.
- Let the SDK own meaningful behavior and reusable flows (auth/token exchange, transport, schema validation, per-domain actions).
- Pass dependencies into shell code instead of burying side effects inside core logic. The SDK takes a `fetchImpl`; the transport takes `getToken`/`refresh`; commands take a constructed `client`. Keep it that way so tests can substitute a mock server.
- Return structured data from core logic and command handlers (`{ data, human }`) instead of printing or exiting inline.

## Public SDK Design

Treat package exports as a product API. Only export symbols consumers should import, document, test, and rely on across releases.

- The public surface is the single `.` export, re-exported from `src/sdk/index.ts`: `createProfileClient`, its `ProfileClient` / `ProfileClientOptions` types, the catchable public errors `ProfileApiError` and `ProfileAuthError`, the scope types (`CliScope`, `DEFAULT_CLI_SCOPES`), and the response model types in `src/sdk/types.ts`.
- Do not export the transport, auth internals, domain factory functions (`makeLinksDomain`, etc.), CLI shell helpers, or arg/output internals from the SDK barrel. Reach domains through `createProfileClient(...).links.*` and friends, not by importing the factory.
- Before adding an export, ask: would we document this, test it as public behavior, and treat changes to it as semver-significant? If not, keep it internal.
- The CLI is a consumer of the SDK like any external caller — it imports only from `src/sdk/index.ts`.

## Error Handling

Rule of thumb: **if the caller wants to handle the failure differently in code, return it; if the failure should abort and surface to the user, throw it.**

### Throw when

- Crossing an I/O boundary — HTTP, filesystem, token exchange. The transport (`src/sdk/transport.ts`) throws `ProfileApiError` on any non-2xx or schema-validation failure and `ProfileAuthError` when refresh can't recover a 401. Let those flow up; do not catch-and-swallow.
- The failure is at the SDK's public surface. SDK consumers (the CLI and external users) expect Promise rejections, not Result types. Throwing keeps the SDK ergonomic and consistent with the JS ecosystem.
- The failure is a user-input error inside a CLI command handler. Throw `UsageError` (`src/cli/commands/registry.ts`) — never `console.error` + `process.exit` inline. The single exit ramp is the `try/catch` in `dispatch()` (`src/cli/bin.ts`), which runs every thrown error through `classifyError` so `--json` mode and exit codes stay consistent. There is also a last-resort guard in `main().catch(...)` for anything that escapes.

### Return a discriminated result when

- The failure is expected and part of a pure function's contract — error classification, output shaping, parsing. `classifyError` in `src/cli/output.ts` is the model: it returns `{ shape, exitCode }` rather than throwing, so the shell can render and set the exit code in one place.
- The caller wants to branch on the failure mode rather than propagate it.
- The function lives in the functional core. The core's whole point is that decisions return structured data; throwing from it makes outputs harder to test.

### Return `undefined` / `null` when

- A lookup has a single "not found" mode and no useful "why" (e.g. `readConfig()` returning `null` when no token is stored).
- Avoid when the absent value is ambiguous (not found vs not loaded vs intentionally empty).

### Error classes

- Model new domain errors on `ProfileApiError` in `src/sdk/errors.ts`: a `name` discriminator plus typed fields (`status`, `action`) that `classifyError` can pull out. `classifyError` branches on `name` (`UsageError` → exit 2, `ProfileAuthError` → exit 3, `ProfileApiError` → exit 1 with status, else → exit 1). A custom error with no `instanceof`/`name` discriminator is an anti-pattern.

### Anti-patterns

- **Try/catch as control flow inside the core.** If you catch to pick a code path, return a Result instead.
- **Boolean returns for failure.** They discard the reason — throw or return a Result.
- **Catch-rewrap-rethrow without `cause`.** If you must wrap, set `{ cause: original }` so the message chain survives.
- **Catching `unknown` and swallowing it.** `catch { return undefined }` hides real bugs.
- **`console.error` + `process.exit(1)` from shell code.** Throw and let `classifyError` + the renderers handle it, or you'll bypass `--json` mode and the exit-code contract.

## Output Contract

Every command emits one line. In `--json`/NDJSON mode (`--json` flag or `RARE_PROFILE_JSON=1`), success is `{ ok: true, command, data }` and failure is `{ ok: false, command, error }` with a stable `error.code`. In human mode it's the handler's `human(data)` string, or `Error: <message>`. Keep this contract intact — route all output through `renderSuccess`/`renderError`, never `console.log` raw.

## Testing Approach

The core/shell split guides test scope. Use the cheapest test that gives real confidence. Run with `pnpm test` (unit → integration → e2e); `pnpm typecheck` for types.

### Unit Tests (`test/*.test.ts`, `node --test`)

Write unit tests for functional core logic — call pure functions directly with plain inputs and assert outputs. No mocks needed.

Good targets: `parseArgs` (`test/args.test.ts`), output/error shaping (`test/output.test.ts`), config read/write (`test/config.test.ts`), command-handler wiring against a fake/mock client (`test/commands*.test.ts`, `test/domains-*.test.ts`), auth/transport against the mock server (`test/auth.test.ts`, `test/transport.test.ts`).

Avoid unit tests for pure pass-through, logging, or formatting-only wrappers.

### Integration Tests (`test/integration/**`, run against the built `dist/`)

Cover the public package surface as a consumer imports it — e.g. `test/integration/package-exports.test.ts` asserts the built barrel exports the intended symbols. These build first (`pnpm build`) so they catch packaging/export regressions, not just source-level behavior.

### E2E Tests (`test/e2e/**`, built CLI)

Test the built CLI as a user would, using the spawn harness (`test/helpers/cli.ts`) against the mock server (`test/helpers/mock-server.ts`). Assert observable behavior: exit codes, stdout/stderr, JSON output, and config effects (e.g. the full device-flow `login` → `whoami` path in `test/e2e/login-flow.test.ts`). The CLI is thin, so most command-wiring confidence comes from E2E plus the handler unit tests.

## Review Checklist

- Decisions live in pure functions; the CLI handler stays a thin wrapper over the SDK.
- New SDK methods go through the transport and validate responses with a Zod schema from `src/sdk/types.ts`.
- Errors are thrown across I/O boundaries and as `UsageError` for bad input — never `process.exit`/`console.error` inline.
- New public symbols are intentional and exported only from `src/sdk/index.ts`.
- The `{ ok, command, data | error }` JSON contract and exit codes are preserved.
- No command or scope moves money or touches a wallet.
- Core logic has unit tests; the JSON/exit-code contract and any new command have E2E coverage.
