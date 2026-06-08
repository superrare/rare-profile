import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appCommand } from "../src/cli/commands/app.js";
import { postCommand } from "../src/cli/commands/post.js";
import { socialCommand } from "../src/cli/commands/social.js";
import { msgCommand } from "../src/cli/commands/msg.js";
import { UsageError } from "../src/cli/commands/registry.js";

function fakeClient() {
  const calls: { name: string; input: unknown }[] = [];
  const rec = (name: string) => async (input: unknown) => { calls.push({ name, input }); return {}; };
  const client: unknown = {
    apps: {
      add: rec("apps.add"),
      update: rec("apps.update"),
      grantToken: rec("apps.grantToken"),
    },
    posts: {
      create: rec("posts.create"),
      delete: rec("posts.delete"),
      list: rec("posts.list"),
      comment: rec("posts.comment"),
      comments: rec("posts.comments"),
      deleteComment: rec("posts.deleteComment"),
    },
    social: {
      follow: rec("social.follow"),
      unfollow: rec("social.unfollow"),
      isFollowing: rec("social.isFollowing"),
      followers: rec("social.followers"),
      following: rec("social.following"),
      feed: rec("social.feed"),
    },
    messages: {
      send: rec("messages.send"),
      inbox: rec("messages.inbox"),
      conversation: rec("messages.conversation"),
      searchUsers: rec("messages.searchUsers"),
    },
  };
  return { client, calls };
}

const ctx = (client: unknown, positionals: string[], flags: Record<string, unknown> = {}) => ({
  client: client as Parameters<typeof appCommand>[0]["client"],
  args: { positionals, flags: flags as Record<string, string | boolean> },
  json: true,
  baseUrl: "https://x.test",
});

// ---- app ----

test("app deploy reads zip bytes and calls apps.add", async () => {
  const { client, calls } = fakeClient();
  const dir = mkdtempSync(join(tmpdir(), "rare-test-app-"));
  const zipPath = join(dir, "app.zip");
  const content = Buffer.from("fake-zip-content");
  writeFileSync(zipPath, content);
  try {
    await appCommand(ctx(client, ["app", "deploy"], {
      store: "store-abc", title: "My App", price: "9.99", zip: zipPath,
    }));
    assert.equal(calls[0].name, "apps.add");
    const input = calls[0].input as {
      storefrontId: string; title: string; price: string;
      bytes: Uint8Array; entryPoint: undefined;
    };
    assert.equal(input.storefrontId, "store-abc");
    assert.equal(input.title, "My App");
    assert.equal(input.price, "9.99");
    assert.ok(input.bytes instanceof Uint8Array, "bytes should be Uint8Array");
    assert.ok(input.bytes.length > 0, "bytes should be non-empty");
    assert.equal(input.entryPoint, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("app deploy with entryPoint flag passes it through", async () => {
  const { client, calls } = fakeClient();
  const dir = mkdtempSync(join(tmpdir(), "rare-test-app-"));
  const zipPath = join(dir, "app.zip");
  writeFileSync(zipPath, Buffer.from("zip"));
  try {
    await appCommand(ctx(client, ["app", "deploy"], {
      store: "s1", title: "T", price: "0", zip: zipPath, entry: "index.js",
    }));
    assert.equal(calls[0].name, "apps.add");
    const input = calls[0].input as { entryPoint: string };
    assert.equal(input.entryPoint, "index.js");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("app deploy without required flags throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => appCommand(ctx(client, ["app", "deploy"], { store: "s1", title: "T" })),
    (e: unknown) => e instanceof UsageError,
  );
});

test("app update reads zip bytes and calls apps.update", async () => {
  const { client, calls } = fakeClient();
  const dir = mkdtempSync(join(tmpdir(), "rare-test-app-"));
  const zipPath = join(dir, "update.zip");
  writeFileSync(zipPath, Buffer.from("updated-zip"));
  try {
    await appCommand(ctx(client, ["app", "update", "prod-123"], { zip: zipPath }));
    assert.equal(calls[0].name, "apps.update");
    const input = calls[0].input as { productId: string; bytes: Uint8Array };
    assert.equal(input.productId, "prod-123");
    assert.ok(input.bytes.length > 0, "bytes should be non-empty");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("app update without id throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => appCommand(ctx(client, ["app", "update"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("app token calls apps.grantToken with id", async () => {
  const { client, calls } = fakeClient();
  await appCommand(ctx(client, ["app", "token", "prod-456"]));
  assert.equal(calls[0].name, "apps.grantToken");
  assert.deepEqual(calls[0].input, { productId: "prod-456" });
});

test("app token without id throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => appCommand(ctx(client, ["app", "token"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("unknown app subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => appCommand(ctx(client, ["app", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- post ----

test("post create with text calls posts.create", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "create"], { text: "Hello world" }));
  assert.equal(calls[0].name, "posts.create");
  assert.deepEqual(calls[0].input, { content: "Hello world" });
});

test("post create with text and store", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "create"], { text: "Hi", store: "store-x" }));
  assert.equal(calls[0].name, "posts.create");
  assert.deepEqual(calls[0].input, { content: "Hi", storefrontId: "store-x" });
});

test("post create with media reads bytes and uses fileName + mimeType", async () => {
  const { client, calls } = fakeClient();
  const dir = mkdtempSync(join(tmpdir(), "rare-test-post-"));
  const mediaPath = join(dir, "photo.jpg");
  writeFileSync(mediaPath, Buffer.from("fake-jpeg"));
  try {
    await postCommand(ctx(client, ["post", "create"], {
      media: mediaPath, "media-type": "image/jpeg",
    }));
    assert.equal(calls[0].name, "posts.create");
    const input = calls[0].input as {
      media: { fileName: string; bytes: Uint8Array; mimeType: string };
    };
    assert.equal(input.media.fileName, "photo.jpg");
    assert.equal(input.media.mimeType, "image/jpeg");
    assert.ok(input.media.bytes.length > 0, "bytes should be non-empty");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("post create with media uses default mimeType when not provided", async () => {
  const { client, calls } = fakeClient();
  const dir = mkdtempSync(join(tmpdir(), "rare-test-post-"));
  const mediaPath = join(dir, "file.bin");
  writeFileSync(mediaPath, Buffer.from("data"));
  try {
    await postCommand(ctx(client, ["post", "create"], { media: mediaPath }));
    const input = calls[0].input as { media: { mimeType: string } };
    assert.equal(input.media.mimeType, "application/octet-stream");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("post create without text or media throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => postCommand(ctx(client, ["post", "create"], {})),
    (e: unknown) => e instanceof UsageError,
  );
});

test("post rm calls posts.delete with id", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "rm", "post-789"]));
  assert.equal(calls[0].name, "posts.delete");
  assert.deepEqual(calls[0].input, { postId: "post-789" });
});

test("post rm without id throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => postCommand(ctx(client, ["post", "rm"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("post list with no filters calls posts.list with empty input", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "list"]));
  assert.equal(calls[0].name, "posts.list");
  assert.deepEqual(calls[0].input, {});
});

test("post list with filters passes them through", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "list"], { store: "s1", profile: "p1", limit: "10" }));
  assert.equal(calls[0].name, "posts.list");
  assert.deepEqual(calls[0].input, { storefrontId: "s1", profileId: "p1", limit: 10 });
});

test("post comment calls posts.comment with postId and text", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "comment", "post-1", "Great post!"]));
  assert.equal(calls[0].name, "posts.comment");
  assert.deepEqual(calls[0].input, { postId: "post-1", content: "Great post!" });
});

test("post comment without required args throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => postCommand(ctx(client, ["post", "comment", "post-1"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("post comments calls posts.comments with postId", async () => {
  const { client, calls } = fakeClient();
  await postCommand(ctx(client, ["post", "comments", "post-2"]));
  assert.equal(calls[0].name, "posts.comments");
  assert.deepEqual(calls[0].input, { postId: "post-2" });
});

test("post comments without id throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => postCommand(ctx(client, ["post", "comments"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("unknown post subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => postCommand(ctx(client, ["post", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- social ----
// NOTE: social dispatches on positionals[0], not positionals[1]

test("social follow maps positionals[1] to targetId", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["follow", "user-abc"]));
  assert.equal(calls[0].name, "social.follow");
  assert.deepEqual(calls[0].input, { targetId: "user-abc" });
});

test("social follow without userId throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => socialCommand(ctx(client, ["follow"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("social unfollow maps positionals[1] to targetId", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["unfollow", "user-xyz"]));
  assert.equal(calls[0].name, "social.unfollow");
  assert.deepEqual(calls[0].input, { targetId: "user-xyz" });
});

test("social unfollow without userId throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => socialCommand(ctx(client, ["unfollow"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("social feed calls social.feed with no args", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["feed"]));
  assert.equal(calls[0].name, "social.feed");
  assert.deepEqual(calls[0].input, {});
});

test("social feed with limit parses number", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["feed"], { limit: "20" }));
  assert.equal(calls[0].name, "social.feed");
  assert.deepEqual(calls[0].input, { limit: 20 });
});

test("social followers calls social.followers", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["followers"]));
  assert.equal(calls[0].name, "social.followers");
  assert.deepEqual(calls[0].input, { userId: undefined });
});

test("social followers with --user flag", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["followers"], { user: "u123" }));
  assert.equal(calls[0].name, "social.followers");
  assert.deepEqual(calls[0].input, { userId: "u123" });
});

test("social following calls social.following", async () => {
  const { client, calls } = fakeClient();
  await socialCommand(ctx(client, ["following"]));
  assert.equal(calls[0].name, "social.following");
  assert.deepEqual(calls[0].input, { userId: undefined });
});

test("unknown social command throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => socialCommand(ctx(client, ["bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});

// ---- msg ----

test("msg send maps recipient and text", async () => {
  const { client, calls } = fakeClient();
  await msgCommand(ctx(client, ["msg", "send", "alice", "Hello there!"]));
  assert.equal(calls[0].name, "messages.send");
  assert.deepEqual(calls[0].input, { recipient: "alice", content: "Hello there!" });
});

test("msg send without required args throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => msgCommand(ctx(client, ["msg", "send", "alice"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("msg send without any args throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => msgCommand(ctx(client, ["msg", "send"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("msg inbox calls messages.inbox with no args", async () => {
  const { client, calls } = fakeClient();
  await msgCommand(ctx(client, ["msg", "inbox"]));
  assert.equal(calls[0].name, "messages.inbox");
  assert.deepEqual(calls[0].input, {});
});

test("msg inbox with limit parses number", async () => {
  const { client, calls } = fakeClient();
  await msgCommand(ctx(client, ["msg", "inbox"], { limit: "5" }));
  assert.equal(calls[0].name, "messages.inbox");
  assert.deepEqual(calls[0].input, { limit: 5 });
});

test("msg read calls messages.conversation with partnerId", async () => {
  const { client, calls } = fakeClient();
  await msgCommand(ctx(client, ["msg", "read", "partner-99"]));
  assert.equal(calls[0].name, "messages.conversation");
  assert.deepEqual(calls[0].input, { partnerId: "partner-99" });
});

test("msg read with limit passes it through", async () => {
  const { client, calls } = fakeClient();
  await msgCommand(ctx(client, ["msg", "read", "partner-99"], { limit: "15" }));
  assert.equal(calls[0].name, "messages.conversation");
  assert.deepEqual(calls[0].input, { partnerId: "partner-99", limit: 15 });
});

test("msg read without partnerId throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => msgCommand(ctx(client, ["msg", "read"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("msg find calls messages.searchUsers with query", async () => {
  const { client, calls } = fakeClient();
  await msgCommand(ctx(client, ["msg", "find", "charlie"]));
  assert.equal(calls[0].name, "messages.searchUsers");
  assert.deepEqual(calls[0].input, { query: "charlie" });
});

test("msg find without query throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => msgCommand(ctx(client, ["msg", "find"])),
    (e: unknown) => e instanceof UsageError,
  );
});

test("unknown msg subcommand throws UsageError", async () => {
  const { client } = fakeClient();
  await assert.rejects(
    () => msgCommand(ctx(client, ["msg", "bogus"])),
    (e: unknown) => e instanceof UsageError,
  );
});
