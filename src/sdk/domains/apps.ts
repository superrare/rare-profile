import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";
import { encodeBase64, setIfDefined } from "../media.js";

export interface AddAppInput {
  storefrontId: string; title: string; price: string; entryPoint?: string; bytes: Uint8Array;
}

export interface UpdateAppInput {
  productId: string; bytes: Uint8Array; entryPoint?: string;
}

/** Pure: build the add-app request body (no I/O). */
export function buildAddAppParams(input: AddAppInput): Record<string, unknown> {
  const params: Record<string, unknown> = {
    storefrontId: input.storefrontId,
    title: input.title,
    price: input.price,
    fileContent: encodeBase64(input.bytes),
  };
  setIfDefined(params, "entryPoint", input.entryPoint);
  return params;
}

/** Pure: build the update-app request body (no I/O). */
export function buildUpdateAppParams(input: UpdateAppInput): Record<string, unknown> {
  const params: Record<string, unknown> = {
    productId: input.productId,
    fileContent: encodeBase64(input.bytes),
  };
  setIfDefined(params, "entryPoint", input.entryPoint);
  return params;
}

export function makeAppsDomain(t: Transport) {
  return {
    /** Add an app to a storefront, uploading its file as base64. */
    add: (input: AddAppInput) =>
      t.post("add-app", buildAddAppParams(input), AckSchema),

    /** Update an app's file, optionally changing the entry point. */
    update: (input: UpdateAppInput) =>
      t.post("update-app", buildUpdateAppParams(input), AckSchema),

    /** Grant a token for accessing an app product. */
    grantToken: (input: { productId: string }) =>
      t.post("grant-app-token", input, AckSchema),
  };
}
