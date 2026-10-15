import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileClient } from "../src/sdk/index.js";
import { startMockServer } from "./helpers/mock-server.js";

test("credit group create preserves atomic price as a string and validates returned configuration", async () => {
  const server = await startMockServer({
    "/api/commerce": (body) => {
      assert.equal(body.action, "create-credit-group");
      assert.equal(body.packPriceAtomic, "99999999999999999999999999999999999999999999999999999999999999999999999999999999");
      assert.equal(body.treasuryAddress, "0xABC");
      return { status: 201, json: { group: {
        id: "group-id", slug: "arcade", displayName: "Arcade", chainId: 1, treasuryAddress: "0xabc", usdcAddress: "0xdef",
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
    const result = await client.creditGroups.create({ slug: "arcade", displayName: "Arcade", chainId: 1, treasuryAddress: "0xABC", usdcAddress: "0xDEF", packPriceAtomic: "99999999999999999999999999999999999999999999999999999999999999999999999999999999", packCredits: 20 });
    assert.equal(result.group.packPriceAtomic, "99999999999999999999999999999999999999999999999999999999999999999999999999999999");
    assert.equal(result.group.apps[0]?.productId, "app-id");
    assert.equal(server.requests[0]?.body.action, "create-credit-group");
  } finally { await server.close(); }
});
