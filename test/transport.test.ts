import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createTransport } from "../src/sdk/transport.js";
import { ProfileApiError } from "../src/sdk/errors.js";

const okSchema = z.object({ id: z.string() });

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

test("posts action with bearer token and parses with schema", async () => {
  const { fn, calls } = mockFetch([{ status: 200, body: { id: "abc" } }]);
  const t = createTransport({
    baseUrl: "https://x.test",
    fetchImpl: fn,
    getToken: () => "jwt-1",
    refresh: async () => "jwt-2",
  });
  const out = await t.post("get-profile", { slug: "me" }, okSchema);
  assert.deepEqual(out, { id: "abc" });
  assert.equal(calls[0].url, "https://x.test/api/commerce");
  const body = JSON.parse(calls[0].init.body as string);
  assert.deepEqual(body, { action: "get-profile", slug: "me" });
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer jwt-1");
});

test("on 401 it refreshes once and retries with the new token", async () => {
  const { fn, calls } = mockFetch([
    { status: 401, body: { error: "Unauthorized" } },
    { status: 200, body: { id: "ok" } },
  ]);
  let refreshed = 0;
  const t = createTransport({
    baseUrl: "https://x.test",
    fetchImpl: fn,
    getToken: () => "old",
    refresh: async () => { refreshed++; return "new"; },
  });
  const out = await t.post("get-profile", {}, okSchema);
  assert.deepEqual(out, { id: "ok" });
  assert.equal(refreshed, 1);
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, "Bearer new");
});

test("non-2xx (non-401) throws ProfileApiError with status and server message", async () => {
  const { fn } = mockFetch([{ status: 403, body: { error: "Action 'buy' is outside this token's scope" } }]);
  const t = createTransport({
    baseUrl: "https://x.test", fetchImpl: fn,
    getToken: () => "jwt", refresh: async () => "jwt",
  });
  await assert.rejects(
    () => t.post("buy", {}, okSchema),
    (e: unknown) => e instanceof ProfileApiError && e.status === 403 && /outside this token/.test(e.message),
  );
});

test("schema mismatch throws ProfileApiError", async () => {
  const { fn } = mockFetch([{ status: 200, body: { wrong: true } }]);
  const t = createTransport({
    baseUrl: "https://x.test", fetchImpl: fn,
    getToken: () => "jwt", refresh: async () => "jwt",
  });
  await assert.rejects(() => t.post("get-profile", {}, okSchema), (e: unknown) => e instanceof ProfileApiError);
});

test("postArchive sends raw ZIP bytes and query metadata", async () => {
  const { fn, calls } = mockFetch([{ status: 200, body: { id: "app-1" } }]);
  const t = createTransport({
    baseUrl: "https://studio.superrare.com/",
    fetchImpl: fn,
    getToken: () => "jwt-1",
    refresh: async () => "jwt-2",
  });
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

  const out = await t.postArchive(
    "/api/app-deploy",
    {
      storefrontId: "store 1",
      title: "Interactive Garden",
      price: "0",
      entryPoint: undefined,
    },
    bytes,
    okSchema,
  );

  assert.deepEqual(out, { id: "app-1" });
  assert.equal(
    calls[0].url,
    "https://studio.superrare.com/api/app-deploy?storefrontId=store+1&title=Interactive+Garden&price=0",
  );
  assert.equal(calls[0].init.body, bytes);
  assert.equal(
    (calls[0].init.headers as Record<string, string>)["Content-Type"],
    "application/zip",
  );
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    "Bearer jwt-1",
  );
});

test("postArchive refreshes once after a 401", async () => {
  const { fn, calls } = mockFetch([
    { status: 401, body: { error: "Unauthorized" } },
    { status: 200, body: { id: "app-1" } },
  ]);
  const t = createTransport({
    baseUrl: "https://studio.superrare.com",
    fetchImpl: fn,
    getToken: () => "old",
    refresh: async () => "new",
  });

  await t.postArchive(
    "/api/app-deploy",
    { storefrontId: "store-1", title: "App", price: "0" },
    new Uint8Array([1]),
    okSchema,
  );

  assert.equal(
    (calls[1].init.headers as Record<string, string>).Authorization,
    "Bearer new",
  );
});
