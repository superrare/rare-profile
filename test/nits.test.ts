import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runTokens } from "../src/cli/commands/tokens.js";
import { UsageError } from "../src/cli/commands/registry.js";
import { createAuth } from "../src/sdk/auth.js";
import { appCommand } from "../src/cli/commands/app.js";
import { productCommand } from "../src/cli/commands/product.js";

// ── Nit 1: tokens subcommand validation ─────────────────────────────────────

test("tokens bogus subcommand throws UsageError", () => {
  assert.throws(
    () => runTokens("https://rare.xyz", { positionals: ["tokens", "bogus"], flags: {} }),
    (e: unknown) => e instanceof UsageError,
  );
});

test("tokens list returns manageUrl ending in /dashboard/cli", () => {
  const result = runTokens("https://rare.xyz", { positionals: ["tokens", "list"], flags: {} });
  const d = result.data as { action: string; manageUrl: string; note: string };
  assert.equal(d.action, "list");
  assert.ok(d.manageUrl.endsWith("/dashboard/cli"), `Expected manageUrl to end with /dashboard/cli, got: ${d.manageUrl}`);
});

test("tokens revoke returns manageUrl ending in /dashboard/cli", () => {
  const result = runTokens("https://rare.xyz", { positionals: ["tokens", "revoke"], flags: {} });
  const d = result.data as { action: string; manageUrl: string; note: string };
  assert.equal(d.action, "revoke");
  assert.ok(d.manageUrl.endsWith("/dashboard/cli"), `Expected manageUrl to end with /dashboard/cli, got: ${d.manageUrl}`);
});

test("tokens with no subcommand defaults to list and returns manageUrl ending in /dashboard/cli", () => {
  const result = runTokens("https://rare.xyz", { positionals: ["tokens"], flags: {} });
  const d = result.data as { action: string; manageUrl: string; note: string };
  assert.equal(d.action, "list");
  assert.ok(d.manageUrl.endsWith("/dashboard/cli"), `Expected manageUrl to end with /dashboard/cli, got: ${d.manageUrl}`);
});

// ── Nit 2: auth poll-first (no leading delay) ────────────────────────────────

test("auth poll resolves immediately when poll returns approved on first call (interval:60 would hang if sleep came first)", async () => {
  // interval=60 means a leading sleep would block the test for 60 seconds.
  // With poll-first the approved response is returned before any sleep.
  let pollCount = 0;
  const fetchImpl = (async (url: string, _init: RequestInit) => {
    if ((url as string).includes("/auth/cli/device/start")) {
      return new Response(JSON.stringify({
        deviceCode: "dev123",
        userCode: "ABCD-9999",
        verificationUri: "https://rare.xyz/dashboard/cli",
        verificationUriComplete: "https://rare.xyz/dashboard/cli?code=ABCD-9999",
        interval: 60,   // large interval — would hang if sleep ran before first poll
        expiresIn: 900,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    // device/poll endpoint
    pollCount++;
    return new Response(JSON.stringify({ status: "approved", token: "slk_instant" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const auth = createAuth({ baseUrl: "https://rare.xyz", fetchImpl });
  const flow = await auth.startDeviceFlow({ label: "nit-test", scopes: ["profile"] });
  const token = await flow.poll();
  assert.equal(token, "slk_instant");
  assert.equal(pollCount, 1, "should have polled exactly once before returning");
});

// ── Nit 3: consistent empty-price guard ─────────────────────────────────────

function fakeAppClient() {
  const calls: { name: string; input: unknown }[] = [];
  const rec = (name: string) => async (input: unknown) => { calls.push({ name, input }); return {}; };
  const client: unknown = {
    apps: {
      add: rec("apps.add"),
      update: rec("apps.update"),
      grantToken: rec("apps.grantToken"),
    },
  };
  return { client, calls };
}

function fakeProductClient() {
  const calls: { name: string; input: unknown }[] = [];
  const rec = (name: string) => async (input: unknown) => { calls.push({ name, input }); return {}; };
  const client: unknown = {
    products: {
      add: rec("products.add"),
      addWithFile: rec("products.addWithFile"),
      mine: async () => { calls.push({ name: "products.mine", input: undefined }); return []; },
      unlist: rec("products.unlist"),
      delete: rec("products.delete"),
      edit: rec("products.edit"),
      browse: rec("products.browse"),
    },
  };
  return { client, calls };
}

const appCtx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof appCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

const productCtx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof productCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

test("appCommand deploy with --price '' throws UsageError (empty string rejected)", async () => {
  const { client } = fakeAppClient();
  // Provide a real zip file so only the price guard can fire
  const dir = mkdtempSync(join(tmpdir(), "rare-nit-app-"));
  const zipPath = join(dir, "app.zip");
  writeFileSync(zipPath, Buffer.from("fake-zip"));
  try {
    await assert.rejects(
      () => appCommand(appCtx(client, ["app", "deploy"], {
        store: "store-1", title: "My App", price: "", zip: zipPath,
      })),
      (e: unknown) => e instanceof UsageError,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("productCommand add with --price '' throws UsageError (empty string rejected)", async () => {
  const { client } = fakeProductClient();
  await assert.rejects(
    () => productCommand(productCtx(client, ["product", "add"], {
      store: "store-1", title: "My Product", price: "",
    })),
    (e: unknown) => e instanceof UsageError,
  );
});
