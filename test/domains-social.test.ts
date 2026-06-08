import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSocialDomain } from "../src/sdk/domains/social.js";

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

test("social.follow → follow with targetId", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).follow({ targetId: "u_1" });
  assert.equal(calls[0].action, "follow");
  assert.deepEqual(calls[0].params, { targetId: "u_1" });
});

test("social.unfollow → unfollow with targetId", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).unfollow({ targetId: "u_2" });
  assert.equal(calls[0].action, "unfollow");
  assert.deepEqual(calls[0].params, { targetId: "u_2" });
});

test("social.isFollowing → is-following with targetId", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).isFollowing({ targetId: "u_3" });
  assert.equal(calls[0].action, "is-following");
  assert.deepEqual(calls[0].params, { targetId: "u_3" });
});

test("social.followers defaults to empty params → followers", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).followers();
  assert.equal(calls[0].action, "followers");
  assert.deepEqual(calls[0].params, {});
});

test("social.following defaults to empty params → following", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).following();
  assert.equal(calls[0].action, "following");
  assert.deepEqual(calls[0].params, {});
});

test("social.feed defaults to empty params → feed", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).feed();
  assert.equal(calls[0].action, "feed");
  assert.deepEqual(calls[0].params, {});
});

test("social.feed with limit → feed with limit param", async () => {
  const { t, calls } = fakeTransport();
  await makeSocialDomain(t).feed({ limit: 20 });
  assert.equal(calls[0].action, "feed");
  assert.deepEqual(calls[0].params, { limit: 20 });
});
