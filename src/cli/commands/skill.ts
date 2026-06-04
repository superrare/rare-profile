import { readFileSync } from "node:fs";
import type { ParsedArgs } from "../args.js";
import { UsageError } from "./registry.js";

/**
 * Consumer-facing agent skill docs that ship with the package. The markdown lives
 * in `skills/` (single source of truth, also referenced by the README) and is
 * copied into `dist/skills/` at build time so the published binary can dump it.
 * Agents run `rare-profile skill > <wherever their runtime expects>` to install it.
 *
 * This registry is the authoritative list of *consumer* skills. Only skills listed
 * here are dumpable, and the `build` script copies exactly these files into
 * `dist/skills/` — when adding a skill here, add a matching `cp` in package.json.
 * Development/contributor guides do NOT belong here (they must not be shipped or
 * dumped to consumers); keep those separate — see `skills/README.md`.
 */
const SKILLS: Record<string, string> = {
  "rare-profile-cli": "rare-profile-cli.md",
};

const DEFAULT_SKILL = "rare-profile-cli";

/** Read a bundled skill file, trying the published layout then the dev (tsx) layout. */
function readSkillFile(filename: string): string {
  const candidates = [
    new URL(`./skills/${filename}`, import.meta.url), // published: dist/bin.js → dist/skills/<file>
    new URL(`../../../skills/${filename}`, import.meta.url), // dev (tsx): src/cli/commands → repo/skills/<file>
  ];
  for (const url of candidates) {
    try {
      return readFileSync(url, "utf8");
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Skill file not found: ${filename}`);
}

/**
 * `rare-profile skill [name]` — print an agent skill doc to stdout so any agent
 * (Claude, Codex, Cursor, …) can save it where its runtime expects.
 * `rare-profile skill list` — list available skills.
 */
export function runSkill(args: ParsedArgs): { data: unknown; human: (d: unknown) => string } {
  const arg = args.positionals[1] ?? DEFAULT_SKILL;

  if (arg === "list") {
    const skills = Object.keys(SKILLS).sort();
    return {
      data: { skills },
      human: () => "Available skills:\n  " + skills.join("\n  ") + "\n\nDump one with: rare-profile skill <name>",
    };
  }

  const filename = SKILLS[arg];
  if (!filename) {
    throw new UsageError(
      `Unknown skill: ${arg}. Available: ${Object.keys(SKILLS).sort().join(", ")} (or 'list').`,
    );
  }

  const content = readSkillFile(filename);
  return {
    // In --json mode the markdown is returned as a string field; the default
    // (human) mode prints raw markdown so it pipes straight into a file.
    data: { name: arg, filename, content },
    human: (d) => (d as { content: string }).content,
  };
}
