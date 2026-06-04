import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli, withTempHome, parseJsonStdout } from "../helpers/cli.js";

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
