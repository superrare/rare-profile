import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli, withTempHome, parseJsonStdout } from "../helpers/cli.js";
import { dataCommands } from "../../src/cli/commands/index.js";

test("version --json → exit 0 and version payload", async () => {
  const r = await runCli(["version", "--json"]);
  assert.equal(r.code, 0);
  const j = parseJsonStdout<{ ok: boolean; command: string; data: { version: string } }>(r);
  assert.equal(j.ok, true);
  assert.equal(j.command, "version");
  assert.equal(typeof j.data.version, "string");
});

test("help --json lists all command groups", async () => {
  const r = await runCli(["help", "--json"]);
  assert.equal(r.code, 0);
  const j = parseJsonStdout<{ data: { commands: string[] } }>(r);
  for (const name of [
    "login",
    "whoami",
    "profile",
    "link",
    "store",
    "product",
    "app",
    "post",
    "follow",
    "msg",
    "stats",
    "events",
    "studio",
    "tokens",
  ]) {
    assert.ok(j.data.commands.includes(name), `help should list ${name}`);
  }
  assert.ok(j.data.commands.includes("skill"), "help should list the skill command");
});

test("help --json lists every dispatchable data command (no drift)", async () => {
  const r = await runCli(["help", "--json"]);
  const j = parseJsonStdout<{ data: { commands: string[] } }>(r);
  for (const name of Object.keys(dataCommands)) {
    assert.ok(j.data.commands.includes(name), `help is missing dispatchable command '${name}'`);
  }
});

test("the built binary dumps the bundled skill (guards the build copy step)", async () => {
  const r = await runCli(["skill"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /# Skill: Using the `rare-profile` CLI/);
  const list = await runCli(["skill", "list", "--json"]);
  const j = parseJsonStdout<{ data: { skills: string[] } }>(list);
  assert.ok(j.data.skills.includes("rare-profile-cli"));
});

test("help points AI agents at the skill (json + human)", async () => {
  const j = await runCli(["help", "--json"]);
  const parsed = parseJsonStdout<{ data: { agentSkill: string } }>(j);
  assert.match(parsed.data.agentSkill, /rare-profile skill/);

  const human = await runCli(["help"]);
  assert.equal(human.code, 0);
  assert.match(human.stdout, /rare-profile skill/);
});

test("--version / -V flags print the version (Commander convention)", async () => {
  for (const flag of ["--version", "-V"]) {
    const r = await runCli([flag]);
    assert.equal(r.code, 0, `${flag} should exit 0`);
    assert.match(r.stdout, /^\d+\.\d+\.\d+/, `${flag} should print a semver`);
  }
});

test("--help / -h show conventional usage with options and commands", async () => {
  for (const flag of ["--help", "-h"]) {
    const r = await runCli([flag]);
    assert.equal(r.code, 0, `${flag} should exit 0`);
    assert.match(r.stdout, /Usage: rare-profile \[options\] \[command\]/);
    assert.match(r.stdout, /Options:/);
    assert.match(r.stdout, /Commands:/);
    assert.match(r.stdout, /rare-profile skill/); // agent hint preserved
  }
});

test("a trailing --version does NOT swallow the command", async () => {
  await withTempHome(async (home) => {
    // `whoami --version` must run whoami (auth error → exit 3), not print the version.
    const r = await runCli(["whoami", "--version"], { home });
    assert.equal(r.code, 3, "should dispatch whoami, not emit version");
    assert.doesNotMatch(r.stdout, /^\d+\.\d+\.\d+\s*$/m, "must not print a bare version");
    assert.match(r.stdout + r.stderr, /Not authenticated/);
  });
});

test("per-command help lists subcommands", async () => {
  const r = await runCli(["profile", "--help"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Usage: rare-profile profile/);
  assert.match(r.stdout, /Subcommands:/);
  assert.match(r.stdout, /set-username/);
});

test("tokens list --json points at the dashboard", async () => {
  const r = await runCli(["tokens", "list", "--json"]);
  assert.equal(r.code, 0);
  const j = parseJsonStdout<{ data: { manageUrl: string } }>(r);
  assert.match(j.data.manageUrl, /\/dashboard\/cli$/);
});

test("unknown command → exit 2 usage error", async () => {
  const r = await runCli(["bogus", "--json"]);
  assert.equal(r.code, 2);
  const j = parseJsonStdout<{ ok: boolean; error: { code: string } }>(r);
  assert.equal(j.ok, false);
  assert.equal(j.error.code, "usage");
});

test("authenticated command without login → exit 3 auth_required (JSON)", async () => {
  await withTempHome(async (home) => {
    const r = await runCli(["whoami", "--json"], { home });
    assert.equal(r.code, 3);
    const j = parseJsonStdout<{ error: { code: string } }>(r);
    assert.equal(j.error.code, "auth_required");
  });
});

test("authenticated command without login → exit 3 (human output)", async () => {
  await withTempHome(async (home) => {
    const r = await runCli(["whoami"], { home });
    assert.equal(r.code, 3);
    assert.match(r.stdout + r.stderr, /Not authenticated/);
  });
});

test("RARE_PROFILE_JSON=1 forces JSON without the flag", async () => {
  await withTempHome(async (home) => {
    const r = await runCli(["whoami"], { home, env: { RARE_PROFILE_JSON: "1" } });
    assert.equal(r.code, 3);
    const j = parseJsonStdout<{ ok: boolean }>(r);
    assert.equal(j.ok, false);
  });
});
