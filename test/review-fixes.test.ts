import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { numFlag, readFileBytes, UsageError } from "../src/cli/commands/registry.js";
import { msgCommand } from "../src/cli/commands/msg.js";
import { productCommand } from "../src/cli/commands/product.js";
import { AckSchema } from "../src/sdk/types.js";
import { createTransport } from "../src/sdk/transport.js";
import { ProfileAuthError } from "../src/sdk/errors.js";

// ---- Fix 1: numFlag validation ----

test("numFlag returns undefined when v is undefined", () => {
  assert.equal(numFlag(undefined, "limit"), undefined);
});

test("numFlag returns a number for a valid string", () => {
  assert.equal(numFlag("5", "limit"), 5);
  assert.equal(numFlag("0", "limit"), 0);
  assert.equal(numFlag("3.14", "limit"), 3.14);
});

test("numFlag throws UsageError for non-numeric string", () => {
  assert.throws(
    () => numFlag("abc", "limit"),
    (e: unknown) => e instanceof UsageError && /--limit/.test((e as UsageError).message),
  );
});

test("numFlag throws UsageError for boolean true (bare flag)", () => {
  assert.throws(
    () => numFlag(true, "limit"),
    (e: unknown) => e instanceof UsageError && /--limit/.test((e as UsageError).message),
  );
});

test("numFlag throws UsageError for boolean false", () => {
  assert.throws(
    () => numFlag(false, "limit"),
    (e: unknown) => e instanceof UsageError,
  );
});

test("numFlag throws UsageError for NaN-producing input like 'abc123'", () => {
  assert.throws(
    () => numFlag("abc123", "count"),
    (e: unknown) => e instanceof UsageError && /--count/.test((e as UsageError).message),
  );
});

// ---- Fix 1: msgCommand inbox --limit abc rejects with UsageError ----

function fakeMsgClient() {
  const calls: { name: string; input: unknown }[] = [];
  const rec = (name: string) => async (input: unknown) => { calls.push({ name, input }); return {}; };
  const client: unknown = {
    messages: {
      send: rec("messages.send"),
      inbox: rec("messages.inbox"),
      conversation: rec("messages.conversation"),
      searchUsers: rec("messages.searchUsers"),
    },
  };
  return { client, calls };
}

const msgCtx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof msgCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

test("msgCommand inbox with --limit abc rejects with UsageError", async () => {
  const { client } = fakeMsgClient();
  await assert.rejects(
    () => msgCommand(msgCtx(client, ["msg", "inbox"], { limit: "abc" })),
    (e: unknown) => e instanceof UsageError && /--limit/.test((e as UsageError).message),
  );
});

test("msgCommand inbox with --limit 5 passes limit:5 to messages.inbox", async () => {
  const { client, calls } = fakeMsgClient();
  await msgCommand(msgCtx(client, ["msg", "inbox"], { limit: "5" }));
  assert.equal(calls[0].name, "messages.inbox");
  assert.deepEqual(calls[0].input, { limit: 5 });
});

test("msgCommand inbox with bare --limit flag (boolean) rejects with UsageError", async () => {
  const { client } = fakeMsgClient();
  await assert.rejects(
    () => msgCommand(msgCtx(client, ["msg", "inbox"], { limit: true })),
    (e: unknown) => e instanceof UsageError && /--limit/.test((e as UsageError).message),
  );
});

// ---- Fix 2: readFileBytes on missing path throws UsageError ----

test("readFileBytes on missing path throws UsageError", () => {
  assert.throws(
    () => readFileBytes("/nonexistent/path/guaranteed-missing.bin"),
    (e: unknown) => e instanceof UsageError && /Cannot read file/.test((e as UsageError).message),
  );
});

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

const productCtx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof productCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

test("productCommand add with --file pointing to missing path throws UsageError", async () => {
  const { client } = fakeProductClient();
  await assert.rejects(
    () => productCommand(productCtx(client, ["product", "add"], {
      store: "store-1",
      title: "My Product",
      price: "9.99",
      file: "/nonexistent/guaranteed-missing-x.pdf",
    })),
    (e: unknown) => e instanceof UsageError && /Cannot read file/.test((e as UsageError).message),
  );
});

// ---- Fix 3: Transport second-401 → ProfileAuthError ----

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fn: fn as unknown as typeof fetch, calls };
}

const okSchema = z.object({ id: z.string() });

test("second 401 after refresh throws ProfileAuthError (not ProfileApiError)", async () => {
  const { fn } = mockFetch([
    { status: 401, body: { error: "Unauthorized" } },
    { status: 401, body: { error: "Still unauthorized" } },
  ]);
  let refreshed = 0;
  const t = createTransport({
    baseUrl: "https://x.test",
    fetchImpl: fn,
    getToken: () => "old",
    refresh: async () => { refreshed++; return "new"; },
  });
  await assert.rejects(
    () => t.post("get-profile", {}, okSchema),
    (e: unknown) => {
      assert.ok(e instanceof ProfileAuthError, `Expected ProfileAuthError but got ${(e as Error)?.name}: ${(e as Error)?.message}`);
      assert.ok(/Authentication failed after token refresh/.test((e as ProfileAuthError).message));
      return true;
    },
  );
  assert.equal(refreshed, 1, "should have refreshed exactly once");
});

test("first 401 then success is still the happy path (refresh works)", async () => {
  const { fn } = mockFetch([
    { status: 401, body: { error: "Unauthorized" } },
    { status: 200, body: { id: "ok" } },
  ]);
  const t = createTransport({
    baseUrl: "https://x.test",
    fetchImpl: fn,
    getToken: () => "old",
    refresh: async () => "new",
  });
  const out = await t.post("get-profile", {}, okSchema);
  assert.deepEqual(out, { id: "ok" });
});

// ---- Fix 5: AckSchema accepts arrays AND objects ----

test("AckSchema accepts empty array", () => {
  assert.equal(AckSchema.safeParse([]).success, true);
});

test("AckSchema accepts array with items", () => {
  assert.equal(AckSchema.safeParse([{ id: "1" }, { id: "2" }]).success, true);
});

test("AckSchema accepts plain object", () => {
  assert.equal(AckSchema.safeParse({ a: 1 }).success, true);
});

test("AckSchema accepts empty object", () => {
  assert.equal(AckSchema.safeParse({}).success, true);
});

test("AckSchema accepts object with deleted field", () => {
  assert.equal(AckSchema.safeParse({ deleted: true }).success, true);
});
