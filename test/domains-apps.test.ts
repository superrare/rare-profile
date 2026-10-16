import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileApiError } from "../src/sdk/errors.js";
import type { Transport } from "../src/sdk/transport.js";
import { makeAppsDomain } from "../src/sdk/domains/apps.js";

function fakeTransport() {
  const calls: Array<{ action: string; params: any; bytes?: Uint8Array }> = [];
  const t = {
    post: async (action: string, params: any) => {
      calls.push({ action, params });
      return {} as any;
    },
    postArchive: async (path: string, params: any, bytes: Uint8Array) => {
      calls.push({ action: path, params, bytes });
      return {} as any;
    },
  } as any;
  return { t, calls };
}

test("apps.add streams raw ZIP bytes to the Studio deployment endpoint", async () => {
  const { t, calls } = fakeTransport();
  const bytes = new Uint8Array([1, 2, 3]);
  await makeAppsDomain(t).add({ storefrontId: "s", title: "T", price: "0", bytes });
  assert.equal(calls[0].action, "/api/app-deploy");
  assert.deepEqual(calls[0].params, { storefrontId: "s", title: "T", price: "0" });
  assert.deepEqual(calls[0].bytes, bytes);
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
test("apps.publishScoring registers a conforming verifier, publishes an event, and verifies activation", async () => {
  const calls: Array<{ method: string; path: string; body?: object }> = [];
  let activeReads = 0;
  const t: Transport = {
    post: async () => { throw new Error("Unexpected action POST"); },
    postAction: async () => { throw new Error("Unexpected action POST"); },
    postArchive: async () => { throw new Error("Unexpected archive POST"); },
    get: async <T>(path: string, action: string, schema: import("zod").ZodType<T>): Promise<T> => {
      calls.push({ method: "GET", path });
      activeReads += 1;
      if (activeReads === 1) throw new ProfileApiError(action, 404, "No active scoring event for this deployment", "GAME_NOT_FOUND");
      return schema.parse({ version: "1", eventId: "event-1" });
    },
    postJson: async <T>(path: string, action: string, body: object, schema: import("zod").ZodType<T>): Promise<T> => {
      calls.push({ method: "POST", path, body });
      if (action === "game-scoring-create-verifier-version") {
        return schema.parse({ version: "1", verifierVersion: { id: "verifier-1", conformance_status: "passed" } });
      }
      return schema.parse({ version: "1", event: { id: "event-1" } });
    },
  };
  const result = await makeAppsDomain(t).publishScoring({
    productId: "app-1",
    deploymentId: "deployment-1",
    config: { game: "flappy-bird", maxTicks: 1400 },
    maxAttempts: 20,
  });
  assert.deepEqual(result, {
    deploymentId: "deployment-1",
    verifierVersionId: "verifier-1",
    eventId: "event-1",
    alreadyActive: false,
  });
  assert.deepEqual(calls.map(({ method, path }) => [method, path]), [
    ["GET", "/api/v1/games/app-1/scoring/active-event"],
    ["POST", "/api/v1/games/app-1/scoring/versions"],
    ["POST", "/api/v1/games/app-1/scoring/events"],
    ["GET", "/api/v1/games/app-1/scoring/active-event"],
  ]);
  assert.deepEqual(calls[1]?.body, {
    deploymentId: "deployment-1",
    config: { game: "flappy-bird", maxTicks: 1400 },
  });
  assert.deepEqual(calls[2]?.body, {
    verifierVersionId: "verifier-1",
    maxAttempts: 20,
    authPolicy: "authenticated",
  });
});

test("apps.publishScoring avoids duplicate events when the deployment already has one", async () => {
  const calls: string[] = [];
  const t: Transport = {
    post: async () => { throw new Error("Unexpected action POST"); },
    postAction: async () => { throw new Error("Unexpected action POST"); },
    postArchive: async () => { throw new Error("Unexpected archive POST"); },
    get: async <T>(_path: string, _action: string, schema: import("zod").ZodType<T>): Promise<T> => {
      calls.push("GET");
      return schema.parse({ version: "1", eventId: "existing-event" });
    },
    postJson: async () => { calls.push("POST"); throw new Error("must not create another scoring event"); },
  };
  const result = await makeAppsDomain(t).publishScoring({
    productId: "app-1",
    deploymentId: "deployment-1",
    config: { maxTicks: 1400 },
    maxAttempts: 20,
  });
  assert.equal(result.eventId, "existing-event");
  assert.equal(result.alreadyActive, true);
  assert.deepEqual(calls, ["GET"]);
});

test("apps.publishScoring does not mistake other 404s for a missing event", async () => {
  const calls: string[] = [];
  const t: Transport = {
    post: async () => { throw new Error("Unexpected action POST"); },
    postAction: async () => { throw new Error("Unexpected action POST"); },
    postArchive: async () => { throw new Error("Unexpected archive POST"); },
    get: async () => { throw new ProfileApiError("active-event", 404, "Published game not found", "GAME_NOT_FOUND"); },
    postJson: async () => { calls.push("POST"); throw new Error("Unexpected scorer mutation"); },
  };
  await assert.rejects(
    () => makeAppsDomain(t).publishScoring({
      productId: "app-1",
      deploymentId: "deployment-1",
      config: { maxTicks: 1400 },
      maxAttempts: 20,
    }),
    (error: unknown) => error instanceof ProfileApiError && error.message === "Published game not found",
  );
  assert.deepEqual(calls, []);
});
