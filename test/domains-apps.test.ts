import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAppsDomain } from "../src/sdk/domains/apps.js";

function fakeTransport() {
  const calls: Array<{ action: string; params: any }> = [];
  const t = {
    post: async (action: string, params: any) => {
      calls.push({ action, params });
      return {} as any;
    },
  } as any;
  return { t, calls };
}

test("apps.add → add-app, base64 zip, no raw bytes", async () => {
  const { t, calls } = fakeTransport();
  await makeAppsDomain(t).add({ storefrontId: "s", title: "T", price: "0", bytes: new Uint8Array([1, 2, 3]) });
  assert.equal(calls[0].action, "add-app");
  assert.equal(calls[0].params.fileContent, Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"));
  assert.ok(!("bytes" in calls[0].params));
});

test("apps.add includes entryPoint only when provided", async () => {
  const { t, calls } = fakeTransport();
  await makeAppsDomain(t).add({ storefrontId: "s", title: "T", price: "0", bytes: new Uint8Array([1]), entryPoint: "index.js" });
  assert.equal(calls[0].params.entryPoint, "index.js");
});

test("apps.add omits entryPoint when not provided", async () => {
  const { t, calls } = fakeTransport();
  await makeAppsDomain(t).add({ storefrontId: "s", title: "T", price: "0", bytes: new Uint8Array([1]) });
  assert.ok(!("entryPoint" in calls[0].params));
});

test("apps.update → update-app, base64 file, no raw bytes", async () => {
  const { t, calls } = fakeTransport();
  const bytes = new Uint8Array([10, 20, 30]);
  await makeAppsDomain(t).update({ productId: "p_1", bytes });
  assert.equal(calls[0].action, "update-app");
  assert.equal(calls[0].params.fileContent, Buffer.from(bytes).toString("base64"));
  assert.equal(calls[0].params.productId, "p_1");
  assert.ok(!("bytes" in calls[0].params));
});

test("apps.update includes entryPoint only when provided", async () => {
  const { t, calls } = fakeTransport();
  await makeAppsDomain(t).update({ productId: "p_1", bytes: new Uint8Array([1]), entryPoint: "main.js" });
  assert.equal(calls[0].params.entryPoint, "main.js");
});

test("apps.grantToken → grant-app-token with productId", async () => {
  const { t, calls } = fakeTransport();
  await makeAppsDomain(t).grantToken({ productId: "p_2" });
  assert.equal(calls[0].action, "grant-app-token");
  assert.deepEqual(calls[0].params, { productId: "p_2" });
});
