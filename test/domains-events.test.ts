import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEventsDomain } from "../src/sdk/domains/events.js";

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

test("events.list defaults to empty params → events", async () => {
  const { t, calls } = fakeTransport();
  await makeEventsDomain(t).list();
  assert.equal(calls[0].action, "events");
  assert.deepEqual(calls[0].params, {});
});

test("events.list with unreadOnly → events with unreadOnly param", async () => {
  const { t, calls } = fakeTransport();
  await makeEventsDomain(t).list({ unreadOnly: true });
  assert.equal(calls[0].action, "events");
  assert.deepEqual(calls[0].params, { unreadOnly: true });
});

test("events.markRead defaults to empty params → mark-read", async () => {
  const { t, calls } = fakeTransport();
  await makeEventsDomain(t).markRead();
  assert.equal(calls[0].action, "mark-read");
  assert.deepEqual(calls[0].params, {});
});

test("events.markRead with eventIds → mark-read with eventIds param", async () => {
  const { t, calls } = fakeTransport();
  await makeEventsDomain(t).markRead({ eventIds: ["ev_1", "ev_2"] });
  assert.equal(calls[0].action, "mark-read");
  assert.deepEqual(calls[0].params, { eventIds: ["ev_1", "ev_2"] });
});
