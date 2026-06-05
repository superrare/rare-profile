import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import * as pkg from "../../dist/index.js";

const require = createRequire(import.meta.url);

test("public API surface is present", () => {
  assert.equal(typeof pkg.createProfileClient, "function");
  assert.equal(typeof pkg.ProfileApiError, "function");
  assert.equal(typeof pkg.ProfileAuthError, "function");
  assert.ok(Array.isArray(pkg.DEFAULT_CLI_SCOPES));
  assert.ok(pkg.DEFAULT_CLI_SCOPES.includes("profile"));
  assert.ok(!pkg.DEFAULT_CLI_SCOPES.includes("purchase"));
  assert.ok(!pkg.DEFAULT_CLI_SCOPES.includes("wallet"));
});

test("client exposes expected domains and no money/admin methods", () => {
  const client = pkg.createProfileClient({ baseUrl: "https://x.test", token: "slk_x" });
  for (const d of [
    "profile",
    "links",
    "storefronts",
    "products",
    "apps",
    "posts",
    "social",
    "messages",
    "analytics",
    "events",
    "studio",
  ]) {
    assert.equal(typeof (client as any)[d], "object", `missing domain ${d}`);
  }
  const surface = JSON.stringify(Object.keys(client).concat(Object.keys((client as any).profile)));
  for (const forbidden of ["buy", "wallet", "purchase", "admin"]) {
    assert.ok(!surface.toLowerCase().includes(forbidden), `must not expose ${forbidden}`);
  }
});

test("CommonJS require() loads the bundle and exposes the same surface", () => {
  // Real CJS consumers (`require('rare-profile')`) must work, not just ESM.
  const cjs = require("../../dist/index.cjs") as typeof pkg;
  assert.equal(typeof cjs.createProfileClient, "function");
  assert.equal(typeof cjs.ProfileApiError, "function");
  assert.equal(typeof cjs.ProfileAuthError, "function");
  assert.ok(Array.isArray(cjs.DEFAULT_CLI_SCOPES) && cjs.DEFAULT_CLI_SCOPES.includes("profile"));
  const client = cjs.createProfileClient({ baseUrl: "https://x.test", token: "slk_x" });
  assert.equal(typeof client.profile, "object");
});

test("dual-format build emits both declaration files", async () => {
  // Guards the exports map: import → index.d.ts, require → index.d.cts.
  for (const f of ["index.js", "index.cjs", "index.d.ts", "index.d.cts"]) {
    await assert.doesNotReject(access(new URL(`../../dist/${f}`, import.meta.url)), `dist/${f} should exist`);
  }
});
