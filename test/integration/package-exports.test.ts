import { test } from "node:test";
import assert from "node:assert/strict";
import * as pkg from "../../dist/index.js";

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
