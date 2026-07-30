import { test } from "node:test";
import assert from "node:assert/strict";
import { runSkill } from "../src/cli/commands/skill.js";
import { UsageError } from "../src/cli/commands/registry.js";

const args = (positionals: string[], flags: Record<string, string | boolean> = {}) => ({
  positionals: ["skill", ...positionals],
  flags,
});

test("skill (default) dumps the rare-profile-cli markdown", () => {
  const result = runSkill(args([]));
  const data = result.data as { name: string; filename: string; content: string };
  assert.equal(data.name, "rare-profile-cli");
  assert.equal(data.filename, "rare-profile-cli.md");
  assert.match(data.content, /# Skill: Using the `rare-profile` CLI/);
  assert.match(data.content, /https:\/\/studio\.superrare\.com/);
  // human output is the raw markdown so it pipes straight to a file.
  assert.equal(result.human(result.data), data.content);
});

test("skill <name> dumps the named skill", () => {
  const result = runSkill(args(["rare-profile-cli"]));
  const data = result.data as { name: string };
  assert.equal(data.name, "rare-profile-cli");
});

test("skill list returns available skill names", () => {
  const result = runSkill(args(["list"]));
  const data = result.data as { skills: string[] };
  assert.ok(Array.isArray(data.skills));
  assert.ok(data.skills.includes("rare-profile-cli"));
});

test("skill <unknown> throws UsageError", () => {
  assert.throws(() => runSkill(args(["nope"])), (e: unknown) => e instanceof UsageError);
});
