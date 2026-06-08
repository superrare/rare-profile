import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStudioDomain } from "../src/sdk/domains/studio.js";

function fakeTransport() {
  const calls: Array<{ path: string; action: string; params: any }> = [];
  const t = {
    post: async () => ({} as any),
    postAction: async (path: string, action: string, params: any) => { calls.push({ path, action, params }); return {} as any; },
  } as any;
  return { t, calls };
}

test("studio.generateImage → /api/studio create-image-run", async () => {
  const { t, calls } = fakeTransport();
  await makeStudioDomain(t).generateImage({ prompt: "a cat", aspectRatio: "1:1" });
  assert.equal(calls[0].path, "/api/studio");
  assert.equal(calls[0].action, "create-image-run");
  assert.deepEqual(calls[0].params, { prompt: "a cat", aspectRatio: "1:1" });
});

test("studio.listProjects → /api/studio list-projects with {}", async () => {
  const { t, calls } = fakeTransport();
  await makeStudioDomain(t).listProjects();
  assert.equal(calls[0].path, "/api/studio");
  assert.equal(calls[0].action, "list-projects");
  assert.deepEqual(calls[0].params, {});
});
