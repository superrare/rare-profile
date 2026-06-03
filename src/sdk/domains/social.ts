import { z } from "zod";
import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeSocialDomain(t: Transport) {
  return {
    /** Follow a user by their ID. */
    follow: (input: { targetId: string }) =>
      t.post("follow", input, AckSchema),

    /** Unfollow a user by their ID. */
    unfollow: (input: { targetId: string }) =>
      t.post("unfollow", input, AckSchema),

    /** Check whether the authenticated user is following a target. */
    isFollowing: (input: { targetId: string }) =>
      t.post("is-following", input, z.object({ isFollowing: z.boolean() }).passthrough()),

    /** Get followers, optionally for a specific user. */
    followers: (input: { userId?: string } = {}) =>
      t.post("followers", input, AckSchema),

    /** Get accounts the user is following. */
    following: (input: { userId?: string } = {}) =>
      t.post("following", input, AckSchema),

    /** Get the authenticated user's social feed. */
    feed: (input: { limit?: number } = {}) =>
      t.post("feed", input, AckSchema),
  };
}
