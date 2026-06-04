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
4. **Don't hardcode the base URL.** It defaults correctly; override only when needed
   with `--base-url`. During beta the default is `https://beta.rare.xyz`.

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
on rare.xyz. **It cannot be completed headlessly** — a person must click Approve.
On success a `slk_` token is written to `~/.rare-profile/config.json` (mode 0600)
along with the resolved `baseUrl`. Subsequent commands reuse it.

For fully non-interactive use (CI/agents), supply a pre-issued token via the SDK
(`createProfileClient({ baseUrl, token })`) or by pre-seeding the config file.

## Global flags

| Flag | Description |
|------|-------------|
| `--json` | Emit JSON (NDJSON). Use this always. |
| `--base-url <url>` | Override API base URL (beta default: `https://beta.rare.xyz`). |

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
| `app` | `deploy`, `update`, `token` |
| `post` | `create`, `rm`, `list`, `comment`, `comments` |
| `follow` / `unfollow` / `feed` / `followers` / `following` | social graph |
| `msg` | `send`, `inbox`, `read`, `find` |
| `stats` | `links`, `views`, `creator` |
| `events` | `list` (`--unread-only`), `read --ids <id1>,<id2>` |
| `studio` | `image`, `run`, `runs`, `assets`, `projects`, `new-project` |

## Common flows

Read your profile, then update text fields:
```sh
rare-profile profile show --json
rare-profile profile set --json --bio "Building on rare.xyz" --website https://example.com \
  --display-name "Alice" --twitter alice --farcaster alice
```

Change the public handle (renames both `@username` and the URL slug — kept in sync):
```sh
rare-profile profile set-username alice --json
# Public URL becomes https://beta.rare.xyz/alice
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
