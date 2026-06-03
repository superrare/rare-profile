import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeStorefrontsDomain(t: Transport) {
  return {
    /** Create a new storefront. */
    create: (input: { name: string; description?: string }) =>
      t.post("create-storefront", input, AckSchema),

    /** List the authenticated user's storefronts. */
    mine: () =>
      t.post("my-storefronts", {}, AckSchema),

    /** Update an existing storefront's fields. */
    update: (input: { storefrontId: string; name?: string; description?: string; bio?: string; website?: string; twitter?: string; telegram?: string; farcaster?: string; theme?: string }) =>
      t.post("update-storefront", input, AckSchema),

    /** Get a storefront by slug or ID. */
    get: (input: { slug?: string; storefrontId?: string }) =>
      t.post("get-storefront", input, AckSchema),

    /** List all public storefronts. */
    list: () =>
      t.post("list-storefronts", {}, AckSchema),
  };
}
