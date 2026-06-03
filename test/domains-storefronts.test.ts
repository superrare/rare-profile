import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStorefrontsDomain } from "../src/sdk/domains/storefronts.js";

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

test("storefronts.create → create-storefront with name", async () => {
  const { t, calls } = fakeTransport();
  await makeStorefrontsDomain(t).create({ name: "My Store" });
  assert.equal(calls[0].action, "create-storefront");
  assert.deepEqual(calls[0].params, { name: "My Store" });
});

test("storefronts.mine → my-storefronts with empty params", async () => {
  const { t, calls } = fakeTransport();
  await makeStorefrontsDomain(t).mine();
  assert.equal(calls[0].action, "my-storefronts");
  assert.deepEqual(calls[0].params, {});
});

test("storefronts.update → update-storefront with partial fields", async () => {
  const { t, calls } = fakeTransport();
  await makeStorefrontsDomain(t).update({ storefrontId: "sf_1", name: "New Name", bio: "Hello" });
  assert.equal(calls[0].action, "update-storefront");
  assert.deepEqual(calls[0].params, { storefrontId: "sf_1", name: "New Name", bio: "Hello" });
});

test("storefronts.get → get-storefront by slug", async () => {
  const { t, calls } = fakeTransport();
  await makeStorefrontsDomain(t).get({ slug: "cool-store" });
  assert.equal(calls[0].action, "get-storefront");
  assert.deepEqual(calls[0].params, { slug: "cool-store" });
});

test("storefronts.list → list-storefronts with empty params", async () => {
  const { t, calls } = fakeTransport();
  await makeStorefrontsDomain(t).list();
  assert.equal(calls[0].action, "list-storefronts");
  assert.deepEqual(calls[0].params, {});
});
