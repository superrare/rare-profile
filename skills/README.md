# `skills/` — consumer-facing agent skills

These Markdown files are **agent skills for *using* the published `rare-profile`
CLI** — the `--json` contract, exit codes, auth, the command map, and gotchas. They
exist so an AI agent (Claude, Codex, Cursor, …) driving the CLI can load a concise,
accurate guide.

**This folder is not development documentation for this repo.** If you are working
*on* rare-profile, see the **Development** section of the root [`README.md`](../README.md)
instead. Don't treat these files as repo conventions, and don't install a usage skill
into this repo's own agent config.

## What's here

- [`rare-profile-cli.md`](./rare-profile-cli.md) — how to use the CLI.

## How these ship

- The build copies the **consumer** skills listed in the CLI's skill registry
  (`src/cli/commands/skill.ts`) into `dist/skills/`, so they travel inside the
  published npm package.
- End users/agents install one with `rare-profile skill > <their runtime's location>`
  (`rare-profile skill list` enumerates them).
- Only files registered in `skill.ts` are bundled and dumpable. Anything else in this
  folder (like this README) is **not** shipped or dumpable.

## Adding a *development* skill later

A guide for developing this repo is a different audience and must not be confused with
a usage skill. When one is added, keep it clearly separated — e.g. a root
`CONTRIBUTING.md`/`AGENTS.md` or a dedicated `skills/dev/` subfolder — and do **not**
register it in `skill.ts`, so it is never shipped to consumers or dumped by
`rare-profile skill`.
