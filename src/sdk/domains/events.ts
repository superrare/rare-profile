import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeEventsDomain(t: Transport) {
  return {
    /** List events, optionally filtering to unread only. */
    list: (input: { unreadOnly?: boolean } = {}) =>
      t.post("events", input, AckSchema),

    /** Mark events as read. */
    markRead: (input: { eventIds?: string[] } = {}) =>
      t.post("mark-read", input, AckSchema),
  };
}
