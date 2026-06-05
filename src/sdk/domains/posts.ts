import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";
import { encodeBase64, setIfDefined } from "../media.js";

export interface CreatePostInput {
  content?: string;
  storefrontId?: string;
  media?: { fileName: string; bytes: Uint8Array; mimeType: string };
}

/** Pure: build the create-post request body, base64-encoding media when present (no I/O). */
export function buildCreatePostParams(input: CreatePostInput): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  setIfDefined(params, "content", input.content);
  setIfDefined(params, "storefrontId", input.storefrontId);
  if (input.media !== undefined) {
    params.mediaContent = encodeBase64(input.media.bytes);
    params.mediaFileName = input.media.fileName;
    params.mediaMimeType = input.media.mimeType;
  }
  return params;
}

export function makePostsDomain(t: Transport) {
  return {
    /** Create a post, optionally with media content. */
    create: (input: CreatePostInput) =>
      t.post("create-post", buildCreatePostParams(input), AckSchema),

    /** Delete a post by ID. */
    delete: (input: { postId: string }) =>
      t.post("delete-post", input, AckSchema),

    /** List posts, optionally filtered by storefront or profile. */
    list: (input: { storefrontId?: string; profileId?: string; limit?: number } = {}) =>
      t.post("get-posts", input, AckSchema),

    /** Add a comment to a post. */
    comment: (input: { postId: string; content: string }) =>
      t.post("create-comment", input, AckSchema),

    /** Get comments for a post. */
    comments: (input: { postId: string }) =>
      t.post("get-comments", input, AckSchema),

    /** Delete a comment by ID. */
    deleteComment: (input: { commentId: string }) =>
      t.post("delete-comment", input, AckSchema),
  };
}
