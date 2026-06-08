import { test } from "node:test";
import assert from "node:assert/strict";
import { makePostsDomain } from "../src/sdk/domains/posts.js";

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

test("posts.create with only content sends { content }", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).create({ content: "Hello world" });
  assert.equal(calls[0].action, "create-post");
  assert.deepEqual(calls[0].params, { content: "Hello world" });
});

test("posts.create with media → base64 mediaContent, strips bytes", async () => {
  const { t, calls } = fakeTransport();
  const bytes = new Uint8Array([5, 10, 15]);
  await makePostsDomain(t).create({
    content: "Look at this",
    media: { fileName: "img.png", bytes, mimeType: "image/png" },
  });
  assert.equal(calls[0].action, "create-post");
  assert.equal(calls[0].params.mediaContent, Buffer.from(bytes).toString("base64"));
  assert.equal(calls[0].params.mediaFileName, "img.png");
  assert.equal(calls[0].params.mediaMimeType, "image/png");
  assert.ok(!("bytes" in calls[0].params));
  assert.ok(!("media" in calls[0].params));
});

test("posts.create with no args sends empty params", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).create({});
  assert.equal(calls[0].action, "create-post");
  assert.deepEqual(calls[0].params, {});
});

test("posts.delete → delete-post with postId", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).delete({ postId: "post_1" });
  assert.equal(calls[0].action, "delete-post");
  assert.deepEqual(calls[0].params, { postId: "post_1" });
});

test("posts.list defaults to empty params → get-posts", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).list();
  assert.equal(calls[0].action, "get-posts");
  assert.deepEqual(calls[0].params, {});
});

test("posts.comment → create-comment with postId and content", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).comment({ postId: "post_1", content: "Nice!" });
  assert.equal(calls[0].action, "create-comment");
  assert.deepEqual(calls[0].params, { postId: "post_1", content: "Nice!" });
});

test("posts.comments → get-comments with postId", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).comments({ postId: "post_2" });
  assert.equal(calls[0].action, "get-comments");
  assert.deepEqual(calls[0].params, { postId: "post_2" });
});

test("posts.deleteComment → delete-comment with commentId", async () => {
  const { t, calls } = fakeTransport();
  await makePostsDomain(t).deleteComment({ commentId: "c_1" });
  assert.equal(calls[0].action, "delete-comment");
  assert.deepEqual(calls[0].params, { commentId: "c_1" });
});
