import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeMessagesDomain(t: Transport) {
  return {
    /** Send a message to a recipient. */
    send: (input: { recipient: string; content: string }) =>
      t.post("send-message", input, AckSchema),

    /** Retrieve the authenticated user's inbox. */
    inbox: (input: { limit?: number } = {}) =>
      t.post("inbox", input, AckSchema),

    /** Get the conversation with a specific partner. */
    conversation: (input: { partnerId: string; limit?: number }) =>
      t.post("get-conversation", input, AckSchema),

    /** Search for users by query string. */
    searchUsers: (input: { query: string }) =>
      t.post("search-users", input, AckSchema),
  };
}
