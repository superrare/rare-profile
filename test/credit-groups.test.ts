import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileClient, ProfileApiError, type GrantCreditGroupCreditsInput, type CreditGroupGrantResult, type CreditGroupUsageInput, type CreditGroupUsageResult } from "../src/sdk/index.js";
import { startMockServer } from "./helpers/mock-server.js";

test("credit group create preserves atomic price as a string and validates returned configuration", async () => {
  const server = await startMockServer({
    "/api/commerce": (body) => {
      assert.equal(body.action, "create-credit-group");
      assert.equal(body.packPriceAtomic, "99999999999999999999999999999999999999999999999999999999999999999999999999999999");
      assert.equal(body.treasuryAddress, "0xABC");
      return { status: 201, json: { group: {
        id: "group-id", slug: "arcade", displayName: "Arcade", chainId: 1, currency: "USDC", tokenAddress: "0xdef", treasuryAddress: "0xabc",
        packPriceAtomic: body.packPriceAtomic, packCredits: 20, purchasesPaused: true, newUsesPaused: false,
        paymentConfigId: "payment-id", apps: [{ productId: "app-id", origin: "https://game.example", creditCost: 3 }],
      } } };
    },
  });
  try {
    const client = createProfileClient({ baseUrl: server.url, token: "pat", fetchImpl: async (input, init) => {
      if (String(input).endsWith("/api/auth/cli/exchange")) return new Response(JSON.stringify({ token: "jwt" }), { status: 200 });
      return fetch(input, init);
    } });
    const result = await client.creditGroups.create({ slug: "arcade", displayName: "Arcade", chainId: 1, currency: "USDC", tokenAddress: "0xDEF", treasuryAddress: "0xABC", packPriceAtomic: "99999999999999999999999999999999999999999999999999999999999999999999999999999999", packCredits: 20 });
    assert.equal(result.group.packPriceAtomic, "99999999999999999999999999999999999999999999999999999999999999999999999999999999");
    assert.equal(result.group.apps[0]?.productId, "app-id");
    assert.equal(server.requests[0]?.body.action, "create-credit-group");
  } finally { await server.close(); }
});

const grantInput: GrantCreditGroupCreditsInput = {
  groupId: "11111111-1111-4111-8111-111111111111", address: `0x${"ab".repeat(20)}`,
  credits: 3, idempotencyKey: "campaign-wallet-001", reason: "Campaign allocation",
};
const grantResult: CreditGroupGrantResult = { grant: {
  ...grantInput, id: "22222222-2222-4222-8222-222222222222",
  accountId: "33333333-3333-4333-8333-333333333333",
  operatorProfileId: "44444444-4444-4444-8444-444444444444", createdAt: "2026-10-19T09:00:00.000Z",
} };

test("public grant SDK contract uses commerce and preserves the key through auth retries and replay", async () => {
  const requests: unknown[] = [];
  let attempts = 0;
  const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async (url, init) => {
    if (!String(url).endsWith("/api/commerce")) return Response.json({ sessionToken: "jwt" });
    const body: unknown = JSON.parse(String(init?.body));
    requests.push(body);
    if (++attempts === 1) return Response.json({ error: "Expired" }, { status: 401 });
    return Response.json(grantResult);
  } });
  assert.deepEqual(await client.creditGroups.grant(grantInput), grantResult);
  assert.deepEqual(await client.creditGroups.grant(grantInput), grantResult);
  assert.equal(requests.length, 3);
  for (const request of requests) assert.deepEqual(request, { action: "grant-credit-group-credits", ...grantInput });
});

test("grant preserves API status and structured errors", async () => {
  for (const status of [400, 404, 409]) {
    const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async () => Response.json({ error: { message: "Grant rejected", code: "grant_rejected" } }, { status }) });
    await assert.rejects(client.creditGroups.grant(grantInput), (error: unknown) => error instanceof ProfileApiError && error.status === status && error.action === "grant-credit-group-credits" && error.message === "Grant rejected");
  }
});

test("grant runtime schema rejects malformed receipts rather than accepting unstable balances", async () => {
  const invalid = [
    { id: "not-uuid" }, { groupId: "bad" }, { accountId: "bad" }, { operatorProfileId: "bad" },
    { address: "0x123" }, { address: `0x${"AB".repeat(20)}` }, { credits: "3" },
    { credits: 0 }, { credits: -1 }, { credits: 1.5 }, { credits: 2147483648 },
    { idempotencyKey: "bad" }, { reason: "" }, { reason: " untrimmed " },
    { reason: "r".repeat(501) }, { createdAt: "yesterday" },
  ];
  for (const patch of invalid) {
    const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async () => Response.json({ grant: { ...grantResult.grant, ...patch } }) });
    await assert.rejects(client.creditGroups.grant(grantInput), (error: unknown) => error instanceof ProfileApiError && /Unexpected response shape/.test(error.message));
  }
});

const usageInput: CreditGroupUsageInput = {
  groupId: grantInput.groupId, from: "2026-10-19T00:00:00.000Z", to: "2026-10-26T00:00:00.000Z",
  limit: 1,
};
const usageResult: CreditGroupUsageResult = {
  groupId: usageInput.groupId, from: usageInput.from, to: usageInput.to,
  totals: { capturedPlays: "9007199254740993", creditsConsumed: "27021597764222979", completedPlays: "9007199254740992" },
  games: [{ appId: "22222222-2222-4222-8222-222222222222", title: "Arcade", capturedPlays: "2", creditsConsumed: "6", completedPlays: "1" }],
  page: { hasMore: true, nextCursor: "22222222-2222-4222-8222-222222222222" },
};

test("public usage SDK preserves decimal counters, explicit range and manual keyset pagination", async () => {
  const requests: unknown[] = [];
  const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async (url, init) => {
    if (!String(url).endsWith("/api/commerce")) return Response.json({ sessionToken: "jwt" });
    const body: unknown = JSON.parse(String(init?.body));
    requests.push(body);
    return Response.json(requests.length === 1 ? usageResult : { ...usageResult, games: [], page: { hasMore: false, nextCursor: null } });
  } });
  const first = await client.creditGroups.usage(usageInput);
  assert.deepEqual(first, usageResult);
  assert.equal(requests.length, 1, "usage must not automatically crawl pages");
  assert.ok(first.page.nextCursor);
  const secondInput: CreditGroupUsageInput = { ...usageInput, afterAppId: first.page.nextCursor };
  const second = await client.creditGroups.usage(secondInput);
  assert.deepEqual(second.totals, usageResult.totals, "empty later pages retain whole-range totals");
  assert.deepEqual(second.games, []);
  assert.deepEqual(second.page, { hasMore: false, nextCursor: null });
  assert.deepEqual(requests, [
    { action: "get-credit-group-usage", ...usageInput },
    { action: "get-credit-group-usage", ...secondInput },
  ]);
});

test("usage preserves authorization, missing group and invalid range API failures", async () => {
  for (const status of [400, 403, 404]) {
    const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async () => Response.json({ error: "Usage unavailable" }, { status }) });
    await assert.rejects(client.creditGroups.usage(usageInput), (error: unknown) =>
      error instanceof ProfileApiError && error.status === status && error.action === "get-credit-group-usage" && error.message === "Usage unavailable");
  }
});

test("usage rejects lossy, negative, fractional or missing counters and malformed pages at runtime", async () => {
  const invalid: unknown[] = [];
  for (const field of ["capturedPlays", "creditsConsumed", "completedPlays"]) {
    for (const value of [9007199254740992, -1, "-1", "1.5", "1e3", "", null, undefined]) {
      invalid.push({ ...usageResult, totals: { ...usageResult.totals, [field]: value } });
      invalid.push({ ...usageResult, games: [{ ...usageResult.games[0], [field]: value }] });
    }
  }
  invalid.push(
    { ...usageResult, groupId: "bad" },
    { ...usageResult, from: "2026-10-19" },
    { ...usageResult, games: [{ ...usageResult.games[0], appId: "bad" }] },
    { ...usageResult, page: { hasMore: "true", nextCursor: null } },
    { ...usageResult, page: { hasMore: false, nextCursor: "bad" } },
  );
  for (const payload of invalid) {
    const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async () => Response.json(payload) });
    await assert.rejects(client.creditGroups.usage(usageInput), (error: unknown) => error instanceof ProfileApiError && /Unexpected response shape/.test(error.message));
  }
});
