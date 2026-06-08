import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeBase64, setIfDefined } from "../src/sdk/media.js";
import { buildAddWithFileParams, buildStageFileParams } from "../src/sdk/domains/products.js";
import { buildAddAppParams, buildUpdateAppParams } from "../src/sdk/domains/apps.js";
import { buildCreatePostParams } from "../src/sdk/domains/posts.js";

test("encodeBase64 matches Buffer base64", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  assert.equal(encodeBase64(bytes), Buffer.from(bytes).toString("base64"));
});

test("setIfDefined assigns only defined values", () => {
  const o: Record<string, unknown> = {};
  setIfDefined(o, "a", "x");
  setIfDefined(o, "b", undefined);
  assert.deepEqual(o, { a: "x" });
});

test("buildAddWithFileParams base64-encodes bytes and drops the bytes field", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const params = buildAddWithFileParams({ storefrontId: "s", title: "T", price: "1", fileName: "a.pdf", bytes });
  assert.equal(params.fileContent, Buffer.from(bytes).toString("base64"));
  assert.equal(params.fileName, "a.pdf");
  assert.ok(!("bytes" in params));
});

test("buildAddWithFileParams includes optional fields only when provided", () => {
  const bytes = new Uint8Array([4]);
  const withMime = buildAddWithFileParams({ storefrontId: "s", title: "T", price: "1", fileName: "f.mp4", bytes, mimeType: "video/mp4", description: "d" });
  assert.equal(withMime.mimeType, "video/mp4");
  assert.equal(withMime.description, "d");
  const without = buildAddWithFileParams({ storefrontId: "s", title: "T", price: "1", fileName: "f.pdf", bytes });
  assert.ok(!("mimeType" in without));
  assert.ok(!("description" in without));
});

test("buildStageFileParams carries contentType and base64 content", () => {
  const bytes = new Uint8Array([10, 20, 30]);
  const params = buildStageFileParams({ storefrontId: "sf_1", fileName: "asset.zip", bytes, contentType: "digital" });
  assert.equal(params.fileContent, Buffer.from(bytes).toString("base64"));
  assert.equal(params.contentType, "digital");
  assert.ok(!("bytes" in params));
});

test("buildAddAppParams / buildUpdateAppParams base64 the file and gate entryPoint", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const add = buildAddAppParams({ storefrontId: "s", title: "T", price: "0", bytes });
  assert.equal(add.fileContent, Buffer.from(bytes).toString("base64"));
  assert.ok(!("bytes" in add));
  assert.ok(!("entryPoint" in add));
  const upd = buildUpdateAppParams({ productId: "p_1", bytes, entryPoint: "main.js" });
  assert.equal(upd.productId, "p_1");
  assert.equal(upd.entryPoint, "main.js");
});

test("buildCreatePostParams encodes media only when present", () => {
  const textOnly = buildCreatePostParams({ content: "hi" });
  assert.deepEqual(textOnly, { content: "hi" });
  const bytes = new Uint8Array([9]);
  const withMedia = buildCreatePostParams({ content: "hi", media: { fileName: "a.png", bytes, mimeType: "image/png" } });
  assert.equal(withMedia.mediaContent, Buffer.from(bytes).toString("base64"));
  assert.equal(withMedia.mediaFileName, "a.png");
  assert.equal(withMedia.mediaMimeType, "image/png");
});
