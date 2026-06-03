import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileClient } from "../src/sdk/client.js";

test("client exposes profile domain and returns parsed data", async () => {
  let calls = 0;
  const fetchImpl = (async (url: string, _init: RequestInit) => {
    calls++;
    if (url.endsWith("/auth/cli/exchange")) {
      return new Response(JSON.stringify({ sessionToken: "jwt", expiresIn: 900, scopes: ["profile"] }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: "u1", username: "me" }), { status: 200 });
  }) as unknown as typeof fetch;

  const client = createProfileClient({ baseUrl: "https://x.test", token: "slk_x", fetchImpl });
  const me = await client.profile.get();
  assert.equal(me.id, "u1");
  assert.ok(calls >= 1);
});

test("money-moving and admin methods are absent from the facade", () => {
  const client = createProfileClient({ baseUrl: "https://x.test", token: "slk_x" });
  const forbidden = ["buy", "wallet", "purchase", "adminUsers", "adminCheck"];
  const surface = JSON.stringify(Object.keys(client).concat(Object.keys(client.profile)));
  for (const name of forbidden) assert.ok(!surface.includes(name), `facade must not expose ${name}`);
});
