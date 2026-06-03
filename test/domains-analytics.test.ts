import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAnalyticsDomain } from "../src/sdk/domains/analytics.js";

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

test("analytics.links → link-analytics with {}", async () => {
  const { t, calls } = fakeTransport();
  await makeAnalyticsDomain(t).links();
  assert.equal(calls[0].action, "link-analytics");
  assert.deepEqual(calls[0].params, {});
});

test("analytics.pageViews → page-view-analytics with {}", async () => {
  const { t, calls } = fakeTransport();
  await makeAnalyticsDomain(t).pageViews();
  assert.equal(calls[0].action, "page-view-analytics");
  assert.deepEqual(calls[0].params, {});
});

test("analytics.creatorStats → creator-stats with {}", async () => {
  const { t, calls } = fakeTransport();
  await makeAnalyticsDomain(t).creatorStats();
  assert.equal(calls[0].action, "creator-stats");
  assert.deepEqual(calls[0].params, {});
});
