import { test } from "node:test";
import assert from "node:assert/strict";
import { statsCommand } from "../src/cli/commands/stats.js";
import { eventsCommand } from "../src/cli/commands/events.js";
import { studioCommand } from "../src/cli/commands/studio.js";
import { runTokens } from "../src/cli/commands/tokens.js";
import { UsageError } from "../src/cli/commands/registry.js";

function fakeClient() {
  const calls: { name: string; input: unknown }[] = [];
  const rec = (name: string) => async (input: unknown) => { calls.push({ name, input }); return {}; };
  const recNoArg = (name: string) => async () => { calls.push({ name, input: undefined }); return {}; };
  const client: unknown = {
    analytics: {
      links: recNoArg("analytics.links"),
      pageViews: recNoArg("analytics.pageViews"),
      creatorStats: recNoArg("analytics.creatorStats"),
    },
    events: {
      list: rec("events.list"),
      markRead: rec("events.markRead"),
    },
    studio: {
      generateImage: rec("studio.generateImage"),
      getRun: rec("studio.getRun"),
      listRuns: rec("studio.listRuns"),
      listAssets: rec("studio.listAssets"),
      createProject: rec("studio.createProject"),
      listProjects: recNoArg("studio.listProjects"),
    },
  };
  return { client, calls };
}

const ctx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof statsCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

// ---- stats ----

test("stats links calls analytics.links", async () => {
  const { client, calls } = fakeClient();
  const result = await statsCommand(ctx(client, ["stats", "links"]));
  assert.equal(calls[0].name, "analytics.links");
  assert.equal(result.human(result.data), "Link analytics.");
});

test("stats views calls analytics.pageViews", async () => {
  const { client, calls } = fakeClient();
  const result = await statsCommand(ctx(client, ["stats", "views"]));
  assert.equal(calls[0].name, "analytics.pageViews");
  assert.equal(result.human(result.data), "Page-view analytics.");
});

test("stats creator calls analytics.creatorStats", async () => {
  const { client, calls } = fakeClient();
  const result = await statsCommand(ctx(client, ["stats", "creator"]));
  assert.equal(calls[0].name, "analytics.creatorStats");
  assert.equal(result.human(result.data), "Creator stats.");
});

test("unknown stats subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => statsCommand(ctx(client, ["stats", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- events ----

test("events list calls events.list with no options", async () => {
  const { client, calls } = fakeClient();
  const result = await eventsCommand(ctx(client, ["events", "list"]));
  assert.equal(calls[0].name, "events.list");
  assert.deepEqual(calls[0].input, { unreadOnly: undefined });
  assert.equal(result.human(result.data), "Events.");
});

test("events list with --unread-only passes true", async () => {
  const { client, calls } = fakeClient();
  await eventsCommand(ctx(client, ["events", "list"], { "unread-only": true }));
  assert.equal(calls[0].name, "events.list");
  assert.deepEqual(calls[0].input, { unreadOnly: true });
});

test("events read with --ids a,b splits into eventIds array", async () => {
  const { client, calls } = fakeClient();
  const result = await eventsCommand(ctx(client, ["events", "read"], { ids: "a,b" }));
  assert.equal(calls[0].name, "events.markRead");
  assert.deepEqual(calls[0].input, { eventIds: ["a", "b"] });
  assert.equal(result.human(result.data), "Marked read.");
});

test("events read with no --ids calls markRead with empty object", async () => {
  const { client, calls } = fakeClient();
  await eventsCommand(ctx(client, ["events", "read"]));
  assert.equal(calls[0].name, "events.markRead");
  assert.deepEqual(calls[0].input, {});
});

test("unknown events subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => eventsCommand(ctx(client, ["events", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- studio ----

test("studio image without --prompt throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => studioCommand(ctx(client, ["studio", "image"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("studio image with --prompt calls generateImage", async () => {
  const { client, calls } = fakeClient();
  const result = await studioCommand(ctx(client, ["studio", "image"], { prompt: "a sunset" }));
  assert.equal(calls[0].name, "studio.generateImage");
  assert.deepEqual(calls[0].input, { prompt: "a sunset" });
  assert.equal(result.human(result.data), "Image run created.");
});

test("studio image maps all optional flags", async () => {
  const { client, calls } = fakeClient();
  await studioCommand(ctx(client, ["studio", "image"], {
    prompt: "a cat",
    aspect: "16:9",
    quality: "high",
    style: "cinematic",
    count: "3",
    project: "proj-1",
  }));
  assert.equal(calls[0].name, "studio.generateImage");
  assert.deepEqual(calls[0].input, {
    prompt: "a cat",
    aspectRatio: "16:9",
    quality: "high",
    stylePreset: "cinematic",
    count: 3,
    projectId: "proj-1",
  });
});

test("studio run calls getRun with runId from positionals[2]", async () => {
  const { client, calls } = fakeClient();
  const result = await studioCommand(ctx(client, ["studio", "run", "run-xyz"]));
  assert.equal(calls[0].name, "studio.getRun");
  assert.deepEqual(calls[0].input, { runId: "run-xyz" });
  assert.equal(result.human(result.data), "Run.");
});

test("studio run without runId throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => studioCommand(ctx(client, ["studio", "run"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("studio runs calls listRuns with no projectId", async () => {
  const { client, calls } = fakeClient();
  await studioCommand(ctx(client, ["studio", "runs"]));
  assert.equal(calls[0].name, "studio.listRuns");
  assert.deepEqual(calls[0].input, { projectId: undefined });
});

test("studio runs with --project passes projectId", async () => {
  const { client, calls } = fakeClient();
  await studioCommand(ctx(client, ["studio", "runs"], { project: "proj-2" }));
  assert.equal(calls[0].name, "studio.listRuns");
  assert.deepEqual(calls[0].input, { projectId: "proj-2" });
});

test("studio assets calls listAssets with no projectId", async () => {
  const { client, calls } = fakeClient();
  const result = await studioCommand(ctx(client, ["studio", "assets"]));
  assert.equal(calls[0].name, "studio.listAssets");
  assert.deepEqual(calls[0].input, { projectId: undefined });
  assert.equal(result.human(result.data), "Assets.");
});

test("studio projects calls listProjects", async () => {
  const { client, calls } = fakeClient();
  const result = await studioCommand(ctx(client, ["studio", "projects"]));
  assert.equal(calls[0].name, "studio.listProjects");
  assert.equal(result.human(result.data), "Projects.");
});

test("studio new-project calls createProject with name", async () => {
  const { client, calls } = fakeClient();
  const result = await studioCommand(ctx(client, ["studio", "new-project", "My Project"]));
  assert.equal(calls[0].name, "studio.createProject");
  assert.deepEqual(calls[0].input, { name: "My Project" });
  assert.equal(result.human(result.data), "Created project: My Project");
});

test("studio new-project without name throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => studioCommand(ctx(client, ["studio", "new-project"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("unknown studio subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => studioCommand(ctx(client, ["studio", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- tokens ----

test("runTokens returns manageUrl containing /dashboard/cli", () => {
  const result = runTokens("https://rare.xyz", { positionals: ["tokens", "list"], flags: {} });
  const data = result.data as { manageUrl: string; action: string; note: string };
  assert.ok(data.manageUrl.endsWith("/dashboard/cli"), `expected manageUrl to end with /dashboard/cli, got: ${data.manageUrl}`);
  assert.equal(data.action, "list");
  assert.ok(data.note.length > 0);
});

test("runTokens strips trailing slash from baseUrl", () => {
  const result = runTokens("https://rare.xyz/", { positionals: ["tokens"], flags: {} });
  const data = result.data as { manageUrl: string };
  assert.equal(data.manageUrl, "https://rare.xyz/dashboard/cli");
});

test("runTokens human returns manage URL message", () => {
  const result = runTokens("https://rare.xyz", { positionals: ["tokens", "list"], flags: {} });
  const msg = result.human(result.data);
  assert.ok(msg.includes("/dashboard/cli"), `expected message to include /dashboard/cli, got: ${msg}`);
});

test("runTokens defaults sub to list when no positionals[1]", () => {
  const result = runTokens("https://rare.xyz", { positionals: ["tokens"], flags: {} });
  const data = result.data as { action: string };
  assert.equal(data.action, "list");
});
