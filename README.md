# rare-profile

A wallet-less CLI + SDK for managing your rare.xyz profile programmatically.

> **🤖 Driving this from an AI agent? Install the skill first.**
> Run `rare-profile skill` and save the output where your agent runtime expects it
> (e.g. `rare-profile skill > .claude/skills/rare-profile-cli/SKILL.md`, or
> `rare-profile skill >> AGENTS.md`). It's a self-contained guide to using the CLI —
> the `--json` contract, exit codes, auth, and gotchas. See
> [For AI agents](#for-ai-agents-claude-codex-cursor-) below.

## What it is / is not

**rare-profile** lets you manage your rare.xyz presence from the terminal or from code:

- Profile metadata (bio, avatar, banner, featured NFT)
- Links (add, list, reorder, update, delete)
- Storefronts (create, list, get, update)
- Products (add with optional file upload, list, edit, unlist, delete, browse)
- Apps (deploy zip, update, grant app token)
- Posts (create with optional media, list, delete, comment)
- Social graph (follow, unfollow, feed, followers, following)
- Messages (inbox, conversation threads, search users)
- Analytics (link clicks, page views, creator stats)
- Events (list, mark read)
- AI Studio (generate image runs, poll run status, list assets, manage projects)

**Out of scope** — rare-profile does **not** buy, move funds, or mint/deploy/auction NFTs. Those operations stay on the rare.xyz website and the separate `@rareprotocol/rare-cli`. The CLI token scopes `purchase` and `wallet` can never be granted to a CLI token (rejected server-side).

---

## Install

```sh
npm install -g rare-profile
rare-profile --help
```

As a library:

```sh
npm install rare-profile
```

---

## Login

```sh
rare-profile login
```

This starts an OAuth device flow:

1. A user code and a URL (`https://rare.xyz/dashboard/cli`) are printed.
2. Open the URL in your browser while logged into rare.xyz and approve the request.
3. The CLI polls until approval, then writes a `slk_` token to `~/.rare-profile/config.json` (mode 0600).

```sh
rare-profile logout   # clear stored token
rare-profile whoami   # verify the stored token
```

---

## For AI agents (Claude, Codex, Cursor, …)

This CLI ships a tool-agnostic **skill** — a plain-Markdown guide for driving it from
an AI agent. The fastest way to install it is to let the CLI dump it into whatever
location your agent runtime expects:

```sh
rare-profile skill list                                   # see what's available
rare-profile skill > .claude/skills/rare-profile-cli/SKILL.md   # Claude Code
rare-profile skill >> AGENTS.md                           # Codex / Cursor / others
rare-profile skill > .cursor/rules/rare-profile.md        # Cursor rules
```

The source also lives in the repo at [`skills/`](./skills):

- [`skills/rare-profile-cli.md`](./skills/rare-profile-cli.md) — how to **use** the
  CLI: the `--json` contract, exit codes, auth/device flow, the command map, common
  flows, and gotchas.

These are plain Markdown (no tool-specific frontmatter), so any agent runtime can
load them.

> **Scope:** everything under [`skills/`](./skills) is for **consumers using the
> published CLI** — it's bundled into the package and dumpable via `rare-profile
> skill`. It is **not** guidance for developing this repo. If you're working *on*
> rare-profile, see [Development](#development) below; a dev-focused agent guide, when
> added, will live separately and will not be shipped or dumped as a usage skill.

---

## JSON output for agents

Every command supports a `--json` flag (or set `RARE_PROFILE_JSON=1` in the environment). Output is one JSON object per line.

**Success shape:**

```json
{ "ok": true, "command": "profile", "data": { ... } }
```

**Error shape:**

```json
{ "ok": false, "command": "profile", "error": { "code": "api_error", "message": "...", "status": 404 } }
```

**Exit codes:**

| Code | Meaning                                              |
|------|------------------------------------------------------|
| 0    | Success                                              |
| 1    | Generic or API error                                 |
| 2    | Usage error (bad/missing subcommand or argument)     |
| 3    | Auth required (not logged in)                        |

**Login NDJSON progress event** (emitted before the final success line while waiting for approval):

```json
{ "ok": true, "command": "login", "event": "awaiting_approval", "userCode": "ABCD-1234", "verificationUri": "https://rare.xyz/dashboard/cli?code=ABCD-1234" }
```

---

## Command reference

### Global flags

| Flag | Description |
|------|-------------|
| `--json` | Emit JSON output |
| `--base-url <url>` | Override API base URL (beta default: `https://beta.rare.xyz`) |
| `-h, --help` | Show help (works per command, e.g. `rare-profile profile --help`) |
| `-V, --version` | Print the version |

Run `rare-profile --help` for the full command list, or `rare-profile <command> --help`
for a command's subcommands.

### Commands

| Group | Subcommands |
|-------|-------------|
| `login` | _(no subcommand)_ — device flow |
| `logout` | _(no subcommand)_ — clear token |
| `whoami` | _(no subcommand)_ — print current profile |
| `version` | _(no subcommand)_ — print package version |
| `tokens` | _(no subcommand / list)_ — open dashboard link |
| `skill` | `list`, _or_ `<name>` — dump an agent skill doc to stdout |
| `help` | _(no subcommand)_ — list commands |
| `profile` | `show`, `set`, `set-username`, `set-avatar`, `set-banner`, `feature-nft` |
| `link` | `add`, `list`, `rm`, `update`, `reorder` |
| `store` | `create`, `list`, `get`, `update` |
| `product` | `add`, `list`, `unlist`, `rm`, `edit`, `browse` |
| `app` | `deploy`, `update`, `token` |
| `post` | `create`, `rm`, `list`, `comment`, `comments` |
| `follow` | _(no subcommand)_ — `rare-profile follow <userId>` |
| `unfollow` | _(no subcommand)_ — `rare-profile unfollow <userId>` |
| `feed` | _(no subcommand)_ — activity feed |
| `followers` | _(no subcommand, `--user <id>`)_ |
| `following` | _(no subcommand, `--user <id>`)_ |
| `stats` | `links`, `views`, `creator` |
| `events` | `list`, `read` |
| `studio` | `image`, `run`, `runs`, `assets`, `projects`, `new-project` |

### Examples

```sh
# Show your profile
rare-profile profile show

# Show another user's profile by slug
rare-profile profile show --slug someuser

# Update profile fields
rare-profile profile set --bio "Building on rare.xyz" --website https://example.com
rare-profile profile set --display-name "Alice" --twitter alice --farcaster alice

# Change your public handle (renames both @username and the URL slug)
rare-profile profile set-username alice
# → Public URL becomes https://beta.rare.xyz/alice
# Handle rules: ^[a-z0-9_-]{3,30}$, not reserved, must be unique (409 on conflict).

# Upload avatar / banner
rare-profile profile set-avatar ./avatar.png
rare-profile profile set-banner ./banner.jpg

# Feature an NFT on your profile (see Server Requirements below)
rare-profile profile feature-nft --chain ethereum --contract 0x1234... --token-id 42

# Links
rare-profile link add "My Site" https://example.com
rare-profile link list
rare-profile link update <id> --title "Updated Title" --url https://new.example.com
rare-profile link rm <id>
rare-profile link reorder <id1> <id2> <id3>

# Storefronts
rare-profile store create "My Store" --description "Best store"
rare-profile store list
rare-profile store get my-store-slug
rare-profile store update <id> --name "New Name" --bio "Store bio"

# Products
rare-profile product add --store <storefrontId> --title "My PDF" --price 5 --file ./book.pdf
rare-profile product add --store <storefrontId> --title "Free Item" --price 0
rare-profile product list
rare-profile product edit <id> --title "Updated Title" --price 10
rare-profile product unlist <id>
rare-profile product rm <id>
rare-profile product browse --filter featured

# Apps (HTML/zip bundles sold as products)
rare-profile app deploy --store <storefrontId> --title "My App" --price 2 --zip ./app.zip
rare-profile app update <id> --zip ./app-v2.zip
rare-profile app token <id>

# Posts
rare-profile post create --text "Hello rare.xyz!"
rare-profile post create --text "With media" --media ./image.png --media-type image/png
rare-profile post list --store <storefrontId>
rare-profile post comment <postId> "Great post!"
rare-profile post comments <postId>
rare-profile post rm <postId>

# Social
rare-profile follow <userId>
rare-profile unfollow <userId>
rare-profile feed
rare-profile followers --user <userId>
rare-profile following

# Messages
rare-profile msg send <recipientId> "Hey there"
rare-profile msg inbox
rare-profile msg read <partnerId>
rare-profile msg find someusername

# Stats / analytics
rare-profile stats links
rare-profile stats views
rare-profile stats creator

# Events (notifications)
rare-profile events list
rare-profile events list --unread-only
rare-profile events read --ids <id1>,<id2>

# Studio — image generation (async run model, poll for result)
rare-profile studio image --prompt "a surreal digital painting of a rare NFT marketplace"
# Returns a run ID. Poll with:
rare-profile studio run <runId>
# List all runs
rare-profile studio runs
# List generated assets
rare-profile studio assets
# Projects
rare-profile studio projects
rare-profile studio new-project "My Collection"

# Token management (links to dashboard)
rare-profile tokens

# JSON output
rare-profile profile show --json
RARE_PROFILE_JSON=1 rare-profile link list
```

---

## SDK usage

The package ships both ESM and CommonJS builds, so either import style works:

```typescript
// ESM / TypeScript
import { createProfileClient } from "rare-profile";
// CommonJS
const { createProfileClient } = require("rare-profile");
```

```typescript
import { createProfileClient } from "rare-profile";

const client = createProfileClient({
  baseUrl: "https://beta.rare.xyz", // beta host until GA on rare.xyz
  token: process.env.RARE_PROFILE_TOKEN, // a slk_ CLI token
});

// Get your profile
const profile = await client.profile.get();
console.log(profile.username, profile.bio);

// Get another user's profile by slug
const other = await client.profile.get({ slug: "someuser" });

// Update profile
await client.profile.update({ bio: "Updated via SDK", website: "https://example.com" });

// Rename your public handle (username + URL slug are kept in sync server-side)
const renamed = await client.profile.updateUsername({ username: "alice" });
// renamed.slug === "alice"  → https://beta.rare.xyz/alice

// Add a link
const link = await client.links.add({ title: "My Site", url: "https://example.com" });

// List links
const { links } = await client.links.list({});

// Kick off an image generation run
const run = await client.studio.generateImage({ prompt: "vibrant abstract NFT art" });
// run.id is the run ID — poll with:
const result = await client.studio.getRun({ runId: run.id });
```

The client automatically exchanges your `slk_` PAT for a short-lived (15-minute) session JWT and refreshes it transparently on expiry.

**Exported types:**

```typescript
import {
  createProfileClient,
  type ProfileClient,
  type ProfileClientOptions,
  ProfileApiError,
  ProfileAuthError,
  DEFAULT_CLI_SCOPES,
  type CliScope,
} from "rare-profile";
```

---

## Server requirements

**rare-profile requires the following server-side endpoints to be active on your `baseUrl`:**

- Device flow: `POST /auth/cli/device/start`, `POST /auth/cli/device/poll`, `POST /auth/cli/exchange`
- Commerce proxy: `/api/commerce/*` (profiles, links, storefronts, products, apps, posts, social, messages, analytics, events)
- Studio proxy: `/api/studio/*` (requires the `studio` scope)

### feature-nft — pending server dependency

`rare-profile profile feature-nft` (and `client.profile.featureNft(...)`) calls `PATCH /api/commerce/update-profile` with a `featured_nft` field. **This field does not yet exist on the server.** Until that server change lands, the CLI/SDK accepts the call and the server returns success — but the featured NFT field is silently ignored. Document any dependency on this feature as pending until the server is updated.

### Studio run model

`studio image` is **not** a one-shot download. It creates an image generation *run* and returns a run ID. You then poll with `studio run <runId>` until the run completes and assets are available. Use `studio assets` to list completed outputs.

---

## Token scopes

CLI tokens are granted the following scopes at login (the `purchase` and `wallet` scopes cannot be granted to CLI tokens — the server rejects any request to include them):

| Scope | What it covers |
|-------|----------------|
| `profile` | Profile metadata read/write, avatar, banner, featured NFT |
| `links` | Link CRUD and reordering |
| `storefronts` | Storefront CRUD |
| `products` | Product CRUD, file upload, browse |
| `apps` | App deploy/update/token |
| `posts` | Post CRUD, comments |
| `social` | Follow/unfollow, feed, followers/following |
| `messages` | Send/read DMs, user search |
| `analytics` | Link clicks, page views, creator stats |
| `events` | Notification list and mark-read |
| `studio` | AI image generation, runs, assets, projects |

---

## Maintainer note — scope sync

`src/sdk/scopes.ts` is a **vendored copy** of the superlinks server's `app/lib/cli-scopes.ts`. The server is the source of truth. When the server's scope list changes (new scopes added, scopes renamed or removed), re-sync this file manually. No automated cross-repo check exists because the server lives in a separate repository.

---

## Development

```sh
pnpm install         # install dependencies
pnpm test            # run tests (node:test via tsx)
pnpm typecheck       # TypeScript type check (no emit)
pnpm build           # rolldown build → dist/index.js + dist/index.d.ts + dist/bin.js (executable)
```

Tests use Node.js built-in `node:test` runner, imported via `tsx` for TypeScript support. The build uses rolldown to emit a **dual ESM + CommonJS** library (`dist/index.js` + `dist/index.cjs`, with matching `index.d.ts` / `index.d.cts`) plus the self-contained CLI executable (`dist/bin.js`). The package `exports` map serves the right file to `import` and `require` consumers; both are verified by integration tests and `arethetypeswrong`.

> **Note for AI agents working on this repo:** the [`skills/`](./skills) folder is
> **consumer-facing** — it documents how to *use* the published CLI and is shipped to
> end users. Do **not** treat it as development guidance, and don't run
> `rare-profile skill` to install a usage skill into this repo. Repo conventions live
> here in the README (and in a dedicated dev guide if/when one is added).
