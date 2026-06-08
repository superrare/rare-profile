import { test } from "node:test";
import assert from "node:assert/strict";
import { makeMessagesDomain } from "../src/sdk/domains/messages.js";

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

test("messages.send → send-message with recipient and content", async () => {
  const { t, calls } = fakeTransport();
  await makeMessagesDomain(t).send({ recipient: "user_1", content: "hello" });
  assert.equal(calls[0].action, "send-message");
  assert.deepEqual(calls[0].params, { recipient: "user_1", content: "hello" });
});

test("messages.inbox defaults to empty params → inbox", async () => {
  const { t, calls } = fakeTransport();
  await makeMessagesDomain(t).inbox();
  assert.equal(calls[0].action, "inbox");
  assert.deepEqual(calls[0].params, {});
});

test("messages.inbox with limit → inbox with limit param", async () => {
  const { t, calls } = fakeTransport();
  await makeMessagesDomain(t).inbox({ limit: 10 });
  assert.equal(calls[0].action, "inbox");
  assert.deepEqual(calls[0].params, { limit: 10 });
});

test("messages.conversation → get-conversation with partnerId", async () => {
  const { t, calls } = fakeTransport();
  await makeMessagesDomain(t).conversation({ partnerId: "user_2" });
  assert.equal(calls[0].action, "get-conversation");
  assert.deepEqual(calls[0].params, { partnerId: "user_2" });
});

test("messages.searchUsers → search-users with query", async () => {
  const { t, calls } = fakeTransport();
  await makeMessagesDomain(t).searchUsers({ query: "alice" });
  assert.equal(calls[0].action, "search-users");
  assert.deepEqual(calls[0].params, { query: "alice" });
});
