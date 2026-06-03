import { test } from "node:test";
import assert from "node:assert/strict";
import { makeLinksDomain } from "../src/sdk/domains/links.js";

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

test("links.add → add-link with params", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).add({ title: "Site", url: "https://x.com" });
  assert.equal(calls[0].action, "add-link");
  assert.deepEqual(calls[0].params, { title: "Site", url: "https://x.com" });
});

test("links.list defaults to empty params → get-links", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).list();
  assert.equal(calls[0].action, "get-links");
  assert.deepEqual(calls[0].params, {});
});

test("links.delete → delete-link with linkId", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).delete({ linkId: "lnk_1" });
  assert.equal(calls[0].action, "delete-link");
  assert.deepEqual(calls[0].params, { linkId: "lnk_1" });
});

test("links.update → update-link with all optional fields", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).update({ linkId: "lnk_1", title: "New Title", active: false });
  assert.equal(calls[0].action, "update-link");
  assert.deepEqual(calls[0].params, { linkId: "lnk_1", title: "New Title", active: false });
});

test("links.sync → sync-links with links array", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).sync({ links: [{ title: "A", url: "https://a.com" }] });
  assert.equal(calls[0].action, "sync-links");
  assert.deepEqual(calls[0].params, { links: [{ title: "A", url: "https://a.com" }] });
});

test("links.reorder → reorder-links with linkIds", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).reorder({ linkIds: ["lnk_2", "lnk_1"] });
  assert.equal(calls[0].action, "reorder-links");
  assert.deepEqual(calls[0].params, { linkIds: ["lnk_2", "lnk_1"] });
});

test("links.list with storefrontId → get-links with storefrontId", async () => {
  const { t, calls } = fakeTransport();
  await makeLinksDomain(t).list({ storefrontId: "sf_1" });
  assert.equal(calls[0].action, "get-links");
  assert.deepEqual(calls[0].params, { storefrontId: "sf_1" });
});
