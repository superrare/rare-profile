import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makePostsDomain(t: Transport) {
  return {
    /** Create a post, optionally with media content. */
    create: (input: { content?: string; storefrontId?: string; media?: { fileName: string; bytes: Uint8Array; mimeType: string } }) => {
      const { content, storefrontId, media } = input;
      const params: Record<string, unknown> = {};
      if (content !== undefined) params.content = content;
      if (storefrontId !== undefined) params.storefrontId = storefrontId;
      if (media !== undefined) {
        params.mediaContent = Buffer.from(media.bytes).toString("base64");
        params.mediaFileName = media.fileName;
        params.mediaMimeType = media.mimeType;
      }
      return t.post("create-post", params, AckSchema);
    },

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
