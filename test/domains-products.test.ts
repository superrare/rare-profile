import { test } from "node:test";
import assert from "node:assert/strict";
import { makeProductsDomain } from "../src/sdk/domains/products.js";

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

test("products.add → add-product with required fields", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).add({ storefrontId: "sf_1", title: "My Product", price: "9.99" });
  assert.equal(calls[0].action, "add-product");
  assert.deepEqual(calls[0].params, { storefrontId: "sf_1", title: "My Product", price: "9.99" });
});

test("products.addWithFile → add-product with base64 fileContent, no bytes field", async () => {
  const { t, calls } = fakeTransport();
  const bytes = new Uint8Array([1, 2, 3]);
  await makeProductsDomain(t).addWithFile({ storefrontId: "s", title: "T", price: "1", fileName: "a.pdf", bytes });
  assert.equal(calls[0].action, "add-product");
  assert.equal(calls[0].params.fileContent, Buffer.from(bytes).toString("base64"));
  assert.equal(calls[0].params.fileName, "a.pdf");
  assert.ok(!("bytes" in calls[0].params), "bytes must not be present in params");
});

test("products.addWithFile includes mimeType only when provided", async () => {
  const { t, calls } = fakeTransport();
  const bytes = new Uint8Array([4, 5, 6]);
  await makeProductsDomain(t).addWithFile({ storefrontId: "s", title: "T", price: "1", fileName: "f.mp4", bytes, mimeType: "video/mp4" });
  assert.equal(calls[0].params.mimeType, "video/mp4");
});

test("products.addWithFile omits mimeType when not provided", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).addWithFile({ storefrontId: "s", title: "T", price: "1", fileName: "f.pdf", bytes: new Uint8Array([7]) });
  assert.ok(!("mimeType" in calls[0].params), "mimeType must be absent when not given");
});

test("products.stageFile → stage-product-file with base64 fileContent, no bytes field", async () => {
  const { t, calls } = fakeTransport();
  const bytes = new Uint8Array([10, 20, 30]);
  await makeProductsDomain(t).stageFile({ storefrontId: "sf_1", fileName: "asset.zip", bytes, contentType: "digital" });
  assert.equal(calls[0].action, "stage-product-file");
  assert.equal(calls[0].params.fileContent, Buffer.from(bytes).toString("base64"));
  assert.ok(!("bytes" in calls[0].params), "bytes must not be present in params");
  assert.equal(calls[0].params.contentType, "digital");
});

test("products.edit → edit-product with productId and optional fields", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).edit({ productId: "p_1", title: "Updated", price: "5.00" });
  assert.equal(calls[0].action, "edit-product");
  assert.deepEqual(calls[0].params, { productId: "p_1", title: "Updated", price: "5.00" });
});

test("products.unlist → unlist with productId", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).unlist({ productId: "p_1" });
  assert.equal(calls[0].action, "unlist");
  assert.deepEqual(calls[0].params, { productId: "p_1" });
});

test("products.delete → delete-product with productId", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).delete({ productId: "p_2" });
  assert.equal(calls[0].action, "delete-product");
  assert.deepEqual(calls[0].params, { productId: "p_2" });
});

test("products.browse defaults to empty params → browse", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).browse();
  assert.equal(calls[0].action, "browse");
  assert.deepEqual(calls[0].params, {});
});

test("products.mine → my-products with empty params", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).mine();
  assert.equal(calls[0].action, "my-products");
  assert.deepEqual(calls[0].params, {});
});

test("products.download → download with productId", async () => {
  const { t, calls } = fakeTransport();
  await makeProductsDomain(t).download({ productId: "p_3" });
  assert.equal(calls[0].action, "download");
  assert.deepEqual(calls[0].params, { productId: "p_3" });
});
