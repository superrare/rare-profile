import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTransport } from "../src/sdk/transport.js";
import { ProfileApiError } from "../src/sdk/errors.js";
import { makeAppsDomain, parseAppSourceHeaders } from "../src/sdk/domains/apps.js";
import { appCommand, formatCollaborators } from "../src/cli/commands/app.js";
import { UsageError } from "../src/cli/commands/registry.js";

const zip = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
const listing = {
  role: "owner",
  collaborators: [{ username: "alice", displayName: "Alice", addedAt: "2026-11-04T00:00:00Z" }],
};

function studio(responses: Array<() => Response>) {
  const calls: Array<{ url: string; method: string; body: unknown; authorization: string | null }> = [];
  let index = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    calls.push({
      url,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      authorization: headers.get("authorization"),
    });
    const respond = responses[Math.min(index, responses.length - 1)]!;
    index++;
    return respond();
  }) as unknown as typeof fetch;
  let token = "jwt-1";
  const transport = createTransport({ baseUrl: "https://studio.test", fetchImpl, getToken: () => token, refresh: async () => (token = "jwt-2") });
  return { apps: makeAppsDomain(transport), calls };
}

const zipResponse = (headers: Record<string, string>) => () => new Response(zip, { status: 200, headers: { "content-type": "application/zip", ...headers } });
const json = (status: number, body: unknown) => () => Response.json(body, { status });

test("apps.download returns the ZIP bytes and the metadata Studio sends with them", async () => {
  const { apps, calls } = studio([zipResponse({
    "content-disposition": 'attachment; filename="team-game-v4.zip"',
    "x-studio-source": "original",
    "x-studio-deployment-version": "4",
  })]);
  const download = await apps.download({ productId: "app/1" });
  assert.deepEqual(download.bytes, zip);
  assert.equal(download.fileName, "team-game-v4.zip");
  assert.equal(download.version, 4);
  assert.equal(download.rebuilt, false);
  assert.equal(calls[0]!.url, "https://studio.test/api/apps/app%2F1/source");
  assert.equal(calls[0]!.authorization, "Bearer jwt-1");
});

test("apps.download refreshes an expired session once", async () => {
  const { apps, calls } = studio([json(401, { error: "Unauthorized" }), zipResponse({})]);
  const download = await apps.download({ productId: "app-1" });
  assert.deepEqual(download.bytes, zip);
  assert.deepEqual(calls.map((call) => call.authorization), ["Bearer jwt-1", "Bearer jwt-2"]);
});

test("apps.download surfaces Studio's error message", async () => {
  const { apps } = studio([json(404, { error: "App not found or not yours" })]);
  await assert.rejects(apps.download({ productId: "app-1" }), (error: unknown) =>
    error instanceof ProfileApiError && error.status === 404 && error.message.includes("App not found or not yours"));
});

test("parseAppSourceHeaders falls back to a safe file name and flags rebuilt ZIPs", () => {
  const headers = new Headers({ "content-disposition": 'attachment; filename="../evil.zip"', "x-studio-source": "rebuilt" });
  assert.deepEqual(parseAppSourceHeaders("app-1", headers), { fileName: "app-app-1.zip", version: null, rebuilt: true });
});

test("collaborator methods call the collaborators endpoint with the right verbs", async () => {
  const { apps, calls } = studio([json(200, listing)]);
  assert.deepEqual(await apps.collaborators.list({ productId: "app-1" }), listing);
  await apps.collaborators.add({ productId: "app-1", username: "alice" });
  await apps.collaborators.remove({ productId: "app-1", username: "alice" });
  assert.deepEqual(calls.map(({ method, url, body }) => [method, url, body]), [
    ["GET", "https://studio.test/api/apps/app-1/collaborators", undefined],
    ["POST", "https://studio.test/api/apps/app-1/collaborators", { username: "alice" }],
    ["DELETE", "https://studio.test/api/apps/app-1/collaborators", { username: "alice" }],
  ]);
});

test("formatCollaborators lists usernames or says there are none", () => {
  assert.equal(formatCollaborators({ role: "owner", collaborators: [] }), "No collaborators yet.");
  assert.equal(formatCollaborators({ role: "owner", collaborators: [
    { username: "alice", displayName: "Alice", addedAt: "x" },
    { username: null, displayName: null, addedAt: "y" },
  ] }), "@alice (Alice)\n(former user)");
});

function fakeClient() {
  const calls: Array<{ name: string; input: unknown }> = [];
  const client = {
    apps: {
      download: async (input: unknown) => {
        calls.push({ name: "download", input });
        return { bytes: zip, fileName: "team-game-v4.zip", version: 4, rebuilt: false };
      },
      collaborators: {
        list: async (input: unknown) => { calls.push({ name: "list", input }); return listing; },
        add: async (input: unknown) => { calls.push({ name: "add", input }); return listing; },
        remove: async (input: unknown) => { calls.push({ name: "remove", input }); return listing; },
      },
    },
  };
  return { client, calls };
}

const ctx = (client: unknown, positionals: string[], flags: Record<string, string | boolean> = {}) => ({
  client: client as Parameters<typeof appCommand>[0]["client"],
  args: { positionals, flags },
  json: true,
  baseUrl: "https://studio.test",
});

test("app download writes the ZIP and refuses to overwrite without --force", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rare-test-download-"));
  const out = join(dir, "current.zip");
  try {
    const { client, calls } = fakeClient();
    const result = await appCommand(ctx(client, ["app", "download", "app-1"], { out }));
    assert.deepEqual(calls[0], { name: "download", input: { productId: "app-1" } });
    assert.deepEqual(new Uint8Array(readFileSync(out)), zip);
    assert.deepEqual(result.data, { productId: "app-1", path: out, bytes: zip.byteLength, version: 4, rebuilt: false });
    writeFileSync(out, "keep me");
    await assert.rejects(appCommand(ctx(client, ["app", "download", "app-1"], { out })), UsageError);
    assert.equal(readFileSync(out, "utf8"), "keep me");
    await appCommand(ctx(client, ["app", "download", "app-1"], { out, force: true }));
    assert.deepEqual(new Uint8Array(readFileSync(out)), zip);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("app download requires a product ID", async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(appCommand(ctx(client, ["app", "download"])), UsageError);
  assert.equal(calls.length, 0);
});

test("app collaborator routes list, add and remove", async () => {
  const { client, calls } = fakeClient();
  await appCommand(ctx(client, ["app", "collaborator", "list", "app-1"]));
  await appCommand(ctx(client, ["app", "collaborator", "add", "app-1", "alice"]));
  await appCommand(ctx(client, ["app", "collaborator", "remove", "app-1", "alice"]));
  assert.deepEqual(calls, [
    { name: "list", input: { productId: "app-1" } },
    { name: "add", input: { productId: "app-1", username: "alice" } },
    { name: "remove", input: { productId: "app-1", username: "alice" } },
  ]);
});

for (const positionals of [
  ["app", "collaborator", "list"],
  ["app", "collaborator", "add", "app-1"],
  ["app", "collaborator", "invite", "app-1", "alice"],
]) test(`app ${positionals.slice(1).join(" ")} is a usage error`, async () => {
  const { client, calls } = fakeClient();
  await assert.rejects(appCommand(ctx(client, positionals)), UsageError);
  assert.equal(calls.length, 0);
});
