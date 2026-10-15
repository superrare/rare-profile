import { test } from "node:test";
import assert from "node:assert/strict";
import { creditGroupCommand } from "../src/cli/commands/credit-group.js";
import type { ProfileClient } from "../src/sdk/index.js";
import type { ParsedArgs } from "../src/cli/args.js";

const group = {
  id: "group-1", slug: "arcade", displayName: "Arcade", chainId: 1, treasuryAddress: "0xabc", usdcAddress: "0xdef",
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

test("credit-group add-game does not promise purchases remain paused", async () => {
  const client = { creditGroups: { addApp: async () => ({
    groupId: "group-1",
    app: { productId: "app-1", origin: "https://game.example", creditCost: 3 },
  }) } } as unknown as ProfileClient;
  const result = await creditGroupCommand({
    client,
    json: false,
    baseUrl: "",
    args: { positionals: ["add-game", "group-1"], flags: { app: "app-1", origin: "https://game.example", credits: "3" } } as ParsedArgs,
  });
  const output = result.human(result.data);
  assert.match(output, /Approved registrations on active groups gate unpaid starts/);
  assert.doesNotMatch(output, /purchases remain paused/i);
});
