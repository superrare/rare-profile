import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuth } from "../src/sdk/auth.js";
import { ProfileAuthError } from "../src/sdk/errors.js";

function queueFetch(responses: Array<{ status: number; body: unknown }>) {
  let i = 0;
  return (async (_url: string, _init: RequestInit) => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

test("startDeviceFlow returns userCode + verificationUri and polls to approval", async () => {
  const fetchImpl = queueFetch([
    { status: 200, body: { deviceCode: "dev", userCode: "WXYZ-1234", verificationUri: "https://x.test/dashboard/cli", verificationUriComplete: "https://x.test/dashboard/cli?code=WXYZ-1234", interval: 0, expiresIn: 900 } },
    { status: 200, body: { status: "pending" } },
    { status: 200, body: { status: "approved", token: "slk_abc", scopes: ["profile"] } },
  ]);
  const auth = createAuth({ baseUrl: "https://x.test", fetchImpl });
  const flow = await auth.startDeviceFlow({ label: "test", scopes: ["profile"] });
  assert.equal(flow.userCode, "WXYZ-1234");
  assert.equal(flow.verificationUri, "https://x.test/dashboard/cli");
  const token = await flow.poll();
  assert.equal(token, "slk_abc");
});

test("poll rejects on denied", async () => {
  const fetchImpl = queueFetch([
    { status: 200, body: { deviceCode: "dev", userCode: "AAAA-1111", verificationUri: "u", verificationUriComplete: "u", interval: 0, expiresIn: 900 } },
    { status: 200, body: { status: "denied" } },
  ]);
  const auth = createAuth({ baseUrl: "https://x.test", fetchImpl });
  const flow = await auth.startDeviceFlow({ label: "t", scopes: ["profile"] });
  await assert.rejects(() => flow.poll(), (e: unknown) => e instanceof ProfileAuthError);
});

test("exchange returns a session JWT", async () => {
  const fetchImpl = queueFetch([{ status: 200, body: { sessionToken: "jwt-x", expiresIn: 900, scopes: ["profile"] } }]);
  const auth = createAuth({ baseUrl: "https://x.test", fetchImpl });
  const jwt = await auth.exchange("slk_abc");
  assert.equal(jwt, "jwt-x");
});

test("exchange throws ProfileAuthError on 401", async () => {
  const fetchImpl = queueFetch([{ status: 401, body: { error: "Invalid token" } }]);
  const auth = createAuth({ baseUrl: "https://x.test", fetchImpl });
  await assert.rejects(() => auth.exchange("slk_bad"), (e: unknown) => e instanceof ProfileAuthError);
});
