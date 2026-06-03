import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeAppsDomain(t: Transport) {
  return {
    /** Add an app to a storefront, uploading its file as base64. */
    add: (input: { storefrontId: string; title: string; price: string; entryPoint?: string; bytes: Uint8Array }) => {
      const { bytes, storefrontId, title, price, entryPoint } = input;
      const params: Record<string, unknown> = {
        storefrontId,
        title,
        price,
        fileContent: Buffer.from(bytes).toString("base64"),
      };
      if (entryPoint !== undefined) params.entryPoint = entryPoint;
      return t.post("add-app", params, AckSchema);
    },

    /** Update an app's file, optionally changing the entry point. */
    update: (input: { productId: string; bytes: Uint8Array; entryPoint?: string }) => {
      const { bytes, productId, entryPoint } = input;
      const params: Record<string, unknown> = {
        productId,
        fileContent: Buffer.from(bytes).toString("base64"),
      };
      if (entryPoint !== undefined) params.entryPoint = entryPoint;
      return t.post("update-app", params, AckSchema);
    },

    /** Grant a token for accessing an app product. */
    grantToken: (input: { productId: string }) =>
      t.post("grant-app-token", input, AckSchema),
  };
}
