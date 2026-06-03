import { z } from "zod";
import type { Transport } from "../transport.js";
import { LinkSchema, AckSchema } from "../types.js";

export function makeLinksDomain(t: Transport) {
  return {
    /** Add a new link to the authenticated user's profile or storefront. */
    add: (input: { title: string; url: string; icon?: string; storefrontId?: string }) =>
      t.post("add-link", input, LinkSchema),

    /** Update an existing link's fields. */
    update: (input: { linkId: string; title?: string; url?: string; icon?: string; active?: boolean; sort_order?: number }) =>
      t.post("update-link", input, LinkSchema),

    /** Delete a link by ID. */
    delete: (input: { linkId: string }) =>
      t.post("delete-link", input, AckSchema),

    /** Sync (upsert/replace) a set of links, optionally scoped to a storefront. */
    sync: (input: { links: Array<{ id?: string; title: string; url: string; icon?: string }>; storefrontId?: string }) =>
      t.post("sync-links", input, z.object({ links: z.array(LinkSchema) }).passthrough()),

    /** Reorder links by providing an ordered array of link IDs. */
    reorder: (input: { linkIds: string[] }) =>
      t.post("reorder-links", input, AckSchema),

    /** List links, optionally filtered by profile or storefront. */
    list: (input: { profileId?: string; storefrontId?: string } = {}) =>
      t.post("get-links", input, z.object({ links: z.array(LinkSchema) }).passthrough()),
  };
}
