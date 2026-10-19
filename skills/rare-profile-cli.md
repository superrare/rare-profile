# Skill: Using the `rare-profile` CLI

> **Use this when** an AI agent (Claude, Codex, Cursor, or any other) needs to manage
> a rare.xyz profile programmatically with the `rare-profile` CLI — logging in,
> reading/updating profile fields, handle/username, links, storefronts, products,
> apps, posts, social graph, messages, analytics, events, and AI Studio image runs.
> This is for **using the published CLI**, not for developing this repo.

`rare-profile` is a wallet-less CLI for managing a rare.xyz profile. It does **not**
buy, move funds, or mint/deploy/auction NFTs — those stay on the website. The token
scopes `purchase` and `wallet` can never be granted to a CLI token.

> **Installing this skill:** this document ships inside the CLI. Dump it into your
> agent runtime's skill location with `rare-profile skill`, e.g.
> `rare-profile skill > .claude/skills/rare-profile-cli/SKILL.md`,
> `rare-profile skill >> AGENTS.md`, or `rare-profile skill > .cursor/rules/rare-profile.md`.
> `rare-profile skill list` shows everything available.

## Golden rules for agents

1. **Always pass `--json`** (or set `RARE_PROFILE_JSON=1`). Output is one JSON object
   per line (NDJSON). Never parse the human-readable output.
2. **Branch on the exit code, not on stdout text.** See the table below.
3. **Check `ok` in the JSON**, then read `data` (success) or `error` (failure).
4. **Don't hardcode the base URL.** It defaults to the Studio API/login origin,
   `https://studio.superrare.com`; override only when needed with `--base-url`.

## Output contract

Success (one line):
```json
{ "ok": true, "command": "profile", "data": { /* ... */ } }
```
Error (one line):
```json
{ "ok": false, "command": "profile", "error": { "code": "api_error", "message": "...", "status": 404 } }
```

Exit codes:

| Code | Meaning                                          |
|------|--------------------------------------------------|
| 0    | Success                                          |
| 1    | Generic or API error (inspect `error`)           |
| 2    | Usage error (bad/missing subcommand or argument) |
| 3    | Auth required — run `rare-profile login` first   |

## Authentication

```sh
rare-profile login          # OAuth device flow (interactive: needs a human to approve in a browser)
rare-profile whoami --json  # verify the stored token; exit 3 if not logged in
rare-profile logout         # clear the stored token
```

`login` prints a user code + an approval URL, then polls until a human approves it
through the Studio API/login origin. **It cannot be completed headlessly** — a person
must click Approve at the browser URL returned by the service.
On success a `slk_` token is written to `~/.rare-profile/config.json` (mode 0600)
along with the resolved `baseUrl`. Subsequent commands reuse it.

An exact legacy configured value of `https://beta.rare.xyz` (with or without a
trailing slash) resolves to Studio automatically. Explicit `--base-url` has highest
precedence, and every other custom configured URL is preserved.

For fully non-interactive use (CI/agents), supply a pre-issued token via the SDK
(`createProfileClient({ baseUrl, token })`) or by pre-seeding the config file.

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Emit JSON (NDJSON). Use this always. |
| `--base-url <url>` | Override API base URL (default: `https://studio.superrare.com`). |

## Command map

| Group | Subcommands |
|-------|-------------|
| `login` / `logout` / `whoami` | device-flow auth; clear token; current profile |
| `version` / `help` / `tokens` | version string; command list; dashboard link |
| `skill` | dump an agent skill doc (`skill list` to enumerate) |
| `profile` | `show`, `set`, `set-username`, `set-avatar`, `set-banner`, `feature-nft` |
| `link` | `add`, `list`, `rm`, `update`, `reorder` |
| `store` | `create`, `list`, `get`, `update` |
| `product` | `add`, `list`, `unlist`, `rm`, `edit`, `browse` |
| `app` | `deploy`, `update`, `scoring`, `token` |
| `post` | `create`, `rm`, `list`, `comment`, `comments` |
| `follow` / `unfollow` / `feed` / `followers` / `following` | social graph |
| `msg` | `send`, `inbox`, `read`, `find` |
| `stats` | `links`, `views`, `creator` |
| `events` | `list` (`--unread-only`), `read --ids <id1>,<id2>` |
| `studio` | `image`, `run`, `runs`, `assets`, `projects`, `new-project` |
| `credit-group` | `create`, `update`, `resume-purchases`, `list`, `get`, `add-game`, `grant`, `usage` |

### Publishing server-scored games

For a game, put `server-verifier.js` and `scoring-config.json` at the ZIP root.
The config must set integer `maxTicks` from 1 to 100000. Pass
`--max-attempts <1-10000>` when deploying or updating a game:

```sh
rare-profile app deploy --store <storefront-id> --title "Game" --price 0 \
  --zip ./game.zip --max-attempts 20
rare-profile app update <app-id> --zip ./game-v2.zip --max-attempts 20
```

The CLI deploys the ZIP, resolves its current deployment ID, registers that
deployment's verifier, creates the scoring event, and verifies the event is active.
Authentication policy defaults to `authenticated`; `--auth-policy any` is optional.
If upload succeeds but scorer setup fails, rerun registration without another
deployment using the same ZIP and options:

```sh
rare-profile app scoring <app-id> --zip ./game-v2.zip --max-attempts 20
```

This registers scoring only; it does not create a credit group or attach the app
to one. Complete those as a separate platform configuration step.

## Shared game credits

Use a feature-enabled CLI release. A group owner can register any existing hosted
game by app ID; the game creator can discover its group with `list --app` and
retrieve integration settings with `get`.

```sh
rare-profile credit-group create --slug arcade --name "Arcade credits" \
  --chain-id <chain-id> --currency USDC --token-address <address> --treasury <address> \
  --pack-price-atomic <token-units> --pack-credits 10
rare-profile credit-group update <group-id> --currency ETH --treasury <address> \
  --pack-price-atomic <wei> --pack-credits 10
rare-profile credit-group resume-purchases <group-id>
rare-profile credit-group add-game <group-id> --app <hosted-game-app-id> \
  --origin https://<exact-game-origin> --credits 1
rare-profile credit-group list --app <hosted-game-app-id>
rare-profile credit-group get <group-id>
rare-profile credit-group grant 11111111-1111-4111-8111-111111111111 \
  --address 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --credits 3 \
  --idempotency-key campaign-wallet-001 --reason "Campaign allocation" --json
```

With Studio migration `083`, new groups enable purchases immediately. Check the
treasury, chain, token and pack terms before creation. The creation output reports
the actual server pause state; existing groups are unchanged, and payment-term
edits still pause purchases. Adding an approved game to an active group immediately
gates unpaid game-session starts, even while purchases are paused. Do not attach
a live game until its paid-start flow is ready.

### Operator credit allocations

Only the authenticated current group operator can grant credits, using existing
creator apps-write commerce authorization. Operator identity comes from the
server-authenticated user, not a caller-supplied field. Existing privileged
database administrators and service credentials remain trusted.

Grant input requires a UUID group ID, an EVM recipient wallet, an integer amount
from 1 through 2147483647, a trimmed reason of 1–500 characters, and an explicit
8–128-character idempotency key matching `[A-Za-z0-9][A-Za-z0-9._:-]{7,127}`.
The recipient address is normalized to lowercase. Never invent a new key when
retrying an uncertain outcome: reuse the same key and payload. Identical retries
return the same receipt without allocating twice; changed payloads return HTTP
409. Missing groups and nonoperators return HTTP 404. Disabled groups reject
grants with HTTP 409. Purchase/new-use pauses do not prevent granting, and grants
do not change those pauses or enable spending.

Grants do not move funds, revoke balances, or apply NFT eligibility rules.
Human output displays a receipt; normal `--json` output returns `data.grant`
with `id`, `groupId`, `accountId`, `address`, numeric `credits`,
`operatorProfileId`, `idempotencyKey`, `reason`, and ISO `createdAt`, never a
mutable balance. SDK callers use `client.creditGroups.grant(input)` with exported
`GrantCreditGroupCreditsInput` and `CreditGroupGrantResult` types.

### Operator usage reports

```sh
rare-profile credit-group usage GROUP_ID \
  --from 2026-10-19T00:00:00Z --to 2026-10-26T00:00:00Z \
  --limit 100 --json
```

Requires the current group operator's creator `apps` authorization and deployed Studio migration `086`/report handler. Require explicit valid timezone-qualified bounds with `from < to`; never guess a local week. Missing/nonowned groups return 404. The report uses capture-ledger timestamps in `[from,to)`: `capturedPlays`, `creditsConsumed` and `completedPlays` are nonnegative decimal strings. Completion is current status within that captured cohort and can happen after the window. Reservations, uncharged cancellations and credit issuance do not count; charged abandoned/expired runs do. Historical disabled groups and suspended registrations remain reportable.

Keep whole-window `totals` separate from the current `games` page. For the next UUID-ordered page, pass `--after` with `page.nextCursor`, preserving the interval. Limit is 1–100, default 100. No automatic crawl or frozen cross-page snapshot. SDK: `client.creditGroups.usage(input)` with `CreditGroupUsageInput` and `CreditGroupUsageResult`. Credits are not revenue, a paid/free spend attribution, a jackpot amount, or weekly winner selection. Never embed operator credentials in a public prize-pool page.


## Common flows

Read your profile, then update text fields:
```sh
rare-profile profile show --json
rare-profile profile set --json --bio "Building on rare.xyz" --website https://example.com \
  --display-name "Alice" --twitter alice --farcaster alice
```

Change the public handle (renames both `@username` and the profile slug — kept in sync):
```sh
rare-profile profile set-username alice --json
# Username and profile slug become "alice".
# The public profile host is product-defined; do not derive it from the API base URL.
```

Links:
```sh
rare-profile link add "My Site" https://example.com --json
rare-profile link list --json
rare-profile link update <id> --title "New" --url https://new.example.com --json
rare-profile link reorder <id1> <id2> <id3> --json
```

Products (price is required; `0` is allowed for free items):
```sh
rare-profile product add --store <storefrontId> --title "My PDF" --price 5 --file ./book.pdf --json
```

## Gotchas (read before relying on these)

- **`set-username` is normalized, not rejected, for case.** The handle rule is
  `^[a-z0-9_-]{3,30}$`; the server lowercases input (`Alice` → `alice`). Reserved
  and already-taken handles are rejected (HTTP 400/409 → exit 1 with an `error`).
  Username changes use a dedicated action — `profile set` deliberately ignores
  username/slug.
- **`studio image` is async.** It creates a *run* and returns a run id — it is not a
  one-shot download. Poll `studio run <runId>` until complete, then `studio assets`
  to list outputs.
- **`profile feature-nft` is pending a server field.** The call succeeds but the
  server currently ignores `featured_nft` until that column ships. Treat any
  dependency on it as not-yet-live.
- **Scopes are granted at login.** A command can fail with an auth/scope error if its
  scope (e.g. `studio`) wasn't granted. `purchase`/`wallet` are never available.

## Full reference

The repo `README.md` has the complete command reference, every flag, the SDK API,
token scopes, and server endpoint requirements. Consult it for anything not covered
above.
