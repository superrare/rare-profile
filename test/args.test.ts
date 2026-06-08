import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/cli/args.js";

test("splits positionals and flags; --json and --flag value", () => {
  const r = parseArgs(["link", "add", "Site", "https://x.com", "--icon", "globe", "--json"]);
  assert.deepEqual(r.positionals, ["link", "add", "Site", "https://x.com"]);
  assert.equal(r.flags.icon, "globe");
  assert.equal(r.flags.json, true);
});

test("--base-url override and boolean default", () => {
  const r = parseArgs(["whoami", "--base-url", "https://staging.test"]);
  assert.deepEqual(r.positionals, ["whoami"]);
  assert.equal(r.flags["base-url"], "https://staging.test");
  assert.equal(r.flags.json, undefined);
});

test("--key=value form is parsed (value may contain '=')", () => {
  const r = parseArgs(["whoami", "--base-url=https://x.test/api?a=1"]);
  assert.deepEqual(r.positionals, ["whoami"]);
  assert.equal(r.flags["base-url"], "https://x.test/api?a=1");
});

test("--flag=value does not consume the next token", () => {
  const r = parseArgs(["link", "add", "--title=My Site", "https://x.com"]);
  assert.deepEqual(r.positionals, ["link", "add", "https://x.com"]);
  assert.equal(r.flags.title, "My Site");
});
