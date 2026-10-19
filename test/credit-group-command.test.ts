import { test } from "node:test";
import assert from "node:assert/strict";
import { creditGroupCommand } from "../src/cli/commands/credit-group.js";
import { createProfileClient, type ProfileClient, type CreditGroupUsageResult } from "../src/sdk/index.js";
import type { ParsedArgs } from "../src/cli/args.js";

const group = {
  id: "group-1", slug: "arcade", displayName: "Arcade", chainId: 1, currency: "USDC", tokenAddress: "0xdef", treasuryAddress: "0xabc",
  packPriceAtomic: "9007199254740993123456789", packCredits: 20, purchasesPaused: true, newUsesPaused: false,
  paymentConfigId: "payment-1", apps: [{ productId: "app-1", origin: "https://game.example", creditCost: 3 }],
};

test("credit-group list and get human output exposes IDs, registrations, and exact payment terms", async () => {
  const client = { creditGroups: { list: async () => ({ groups: [{ id: group.id, slug: group.slug, displayName: group.displayName, chainId: 1, apps: group.apps }] }), get: async () => ({ group }) } } as unknown as ProfileClient;
  const invoke = async (positionals: string[]) => creditGroupCommand({ client, json: false, baseUrl: "", args: { positionals, flags: {} } as ParsedArgs });
  const listed = await invoke(["list"]);
  assert.match(listed.human(listed.data), /groupId: group-1/);
  assert.match(listed.human(listed.data), /appId: app-1 origin: https:\/\/game\.example creditCost: 3/);
  const fetched = await invoke(["get", "group-1"]);
  const output = fetched.human(fetched.data);
  assert.match(output, /name: Arcade slug: arcade/);
  assert.match(output, /packPriceAtomic: 9007199254740993123456789/);
  assert.match(output, /appId: app-1 appOrigin: https:\/\/game\.example creditCost: 3/);
});

const grantGroupId = "11111111-1111-4111-8111-111111111111";
const grantFlags = { address: `0x${"AB".repeat(20)}`, credits: "3", "idempotency-key": "campaign-wallet-001", reason: " Campaign allocation " };

test("grant normalizes recipient/reason, preserves the required retry key and renders a receipt", async () => {
  const calls: unknown[] = [];
  const grant = { id: "receipt", accountId: "account", operatorProfileId: "operator", createdAt: "2026-10-19T09:00:00Z", groupId: grantGroupId, address: grantFlags.address.toLowerCase(), credits: 3, idempotencyKey: grantFlags["idempotency-key"], reason: "Campaign allocation" };
  const client = { creditGroups: { grant: async (input: unknown) => { calls.push(input); return { grant }; } } } as unknown as ProfileClient;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await creditGroupCommand({ client, json: false, baseUrl: "", args: { positionals: ["credit-group", "grant", grantGroupId], flags: grantFlags } });
    assert.deepEqual(result.data, { grant });
    assert.match(result.human(result.data), /Granted 3 credits.*Receipt: receipt.*key: campaign-wallet-001/);
  }
  assert.deepEqual(calls, Array.from({ length: 2 }, () => ({
    groupId: grantGroupId, address: grant.address, credits: 3, idempotencyKey: grant.idempotencyKey, reason: grant.reason,
  })));
});

test("grant rejects invalid boundaries before calling the SDK", async () => {
  const client = { creditGroups: { grant: async () => { assert.fail("invalid grant reached SDK"); } } } as unknown as ProfileClient;
  const invalid: Record<string, string | boolean | undefined>[] = [
    ...["0", "-1", "1.5", "1e3", "2147483648", "9007199254740993", "", "NaN"].map((credits) => ({ credits })),
    { address: "0x123" }, { address: true }, { "idempotency-key": undefined },
    { "idempotency-key": "short" }, { "idempotency-key": "-invalid-key" },
    { "idempotency-key": "a".repeat(129) }, { "idempotency-key": "invalid key" },
    { reason: "   " }, { reason: "a".repeat(501) }, { reason: undefined },
  ];
  for (const flags of invalid) {
    await assert.rejects(creditGroupCommand({ client, json: true, baseUrl: "", args: { positionals: ["grant", grantGroupId], flags: { ...grantFlags, ...flags } } }), { name: "UsageError" });
  }
  for (const id of [undefined, "not-a-uuid"]) {
    await assert.rejects(creditGroupCommand({ client, json: true, baseUrl: "", args: { positionals: id ? ["grant", id] : ["grant"], flags: grantFlags } }), { name: "UsageError" });
  }
});

test("grant accepts integer/key/reason limits and propagates API conflicts unchanged", async () => {
  let received: unknown;
  const conflict = Object.assign(new Error("Idempotency conflict"), { name: "ProfileApiError", status: 409 });
  const client = { creditGroups: { grant: async (input: unknown) => { received = input; throw conflict; } } } as unknown as ProfileClient;
  await assert.rejects(creditGroupCommand({ client, json: true, baseUrl: "", args: { positionals: ["grant", grantGroupId], flags: { ...grantFlags, credits: "2147483647", "idempotency-key": "a".repeat(128), reason: "r".repeat(500) } } }), (error: unknown) => error === conflict);
  assert.ok(received && typeof received === "object" && "credits" in received);
  assert.equal(received.credits, 2147483647);
});

const usageFlags = { from: "2026-10-19T05:30:00+05:30", to: "2026-10-26T00:00:00Z", limit: "1", after: "22222222-2222-4222-8222-222222222222" };
const usageReport: CreditGroupUsageResult = {
  groupId: grantGroupId, from: "2026-10-19T00:00:00.000Z", to: "2026-10-26T00:00:00.000Z",
  totals: { capturedPlays: "9007199254740993", creditsConsumed: "27021597764222979", completedPlays: "2" },
  games: [{ appId: "33333333-3333-4333-8333-333333333333", title: "Second game", capturedPlays: "3", creditsConsumed: "9", completedPlays: "1" }],
  page: { hasMore: true, nextCursor: "33333333-3333-4333-8333-333333333333" },
};

test("usage normalizes explicit offsets and distinguishes whole-range totals from a single page", async () => {
  const requests: unknown[] = [];
  const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async (url, init) => {
    if (!String(url).endsWith("/api/commerce")) return Response.json({ sessionToken: "jwt" });
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(usageReport);
  } });
  const result = await creditGroupCommand({ client, json: false, baseUrl: "", args: { positionals: ["credit-group", "usage", grantGroupId], flags: usageFlags } });
  assert.deepEqual(requests, [{ action: "get-credit-group-usage", groupId: grantGroupId, from: usageReport.from, to: usageReport.to, limit: 1, afterAppId: usageFlags.after }]);
  assert.deepEqual(result.data, usageReport);
  const output = result.human(result.data);
  assert.match(output, /Whole interval totals: capturedPlays: 9007199254740993; creditsConsumed: 27021597764222979/);
  assert.match(output, /Current page: 1 games/);
  assert.match(output, /Second game; capturedPlays: 3; creditsConsumed: 9; completedPlays: 1/);
  assert.match(output, /hasMore: true; nextCursor: 33333333.*use --after/);
  assert.match(output, /Completed counts reflect current completion status/);
  assert.match(output, /Credits are not revenue or a free\/paid breakdown/);
});

test("usage requires a strict explicit range and bounded pagination before HTTP", async () => {
  let calls = 0;
  const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async () => { calls++; return Response.json(usageReport); } });
  const invalid: Record<string, string | boolean | undefined>[] = [
    { from: undefined }, { to: undefined }, { from: true },
    ...["2026-10-19", "2026-10-19T00:00:00", "2026-02-30T00:00:00Z", "2025-02-29T00:00:00Z", "2026-13-01T00:00:00Z", "2026-10-19T24:00:00Z", "2026-10-19T00:00:00+24:00", "2026-10-19T00:00:00+01:60", "2026-10-19T00:00:00+0100"].map((from) => ({ from })),
    { from: usageFlags.to }, { from: "2026-10-27T00:00:00Z" },
    ...["0", "-1", "1.5", "101", "1e2", ""].map((limit) => ({ limit })),
    { limit: true }, { after: "bad" }, { after: true },
  ];
  for (const patch of invalid) {
    await assert.rejects(creditGroupCommand({ client, json: true, baseUrl: "", args: { positionals: ["usage", grantGroupId], flags: { ...usageFlags, ...patch } } }), { name: "UsageError" });
  }
  for (const positionals of [["usage"], ["usage", "bad"]]) {
    await assert.rejects(creditGroupCommand({ client, json: true, baseUrl: "", args: { positionals, flags: usageFlags } }), { name: "UsageError" });
  }
  assert.equal(calls, 0);
});

test("usage accepts leap day and maximum page size, and leaves API errors intact", async () => {
  const requests: unknown[] = [];
  const client = createProfileClient({ baseUrl: "https://studio.example", token: "pat", fetchImpl: async (url, init) => {
    if (!String(url).endsWith("/api/commerce")) return Response.json({ sessionToken: "jwt" });
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ error: "Group not found" }, { status: 404 });
  } });
  await assert.rejects(creditGroupCommand({ client, json: true, baseUrl: "", args: { positionals: ["usage", grantGroupId], flags: { from: "2024-02-29T00:00:00Z", to: "2024-03-01T00:00:00Z", limit: "100" } } }), { name: "ProfileApiError", status: 404 });
  assert.deepEqual(requests, [{ action: "get-credit-group-usage", groupId: grantGroupId, from: "2024-02-29T00:00:00.000Z", to: "2024-03-01T00:00:00.000Z", limit: 100 }]);
});
