import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";
import { encodeBase64, setIfDefined } from "../media.js";

export interface AddAppInput {
  storefrontId: string; title: string; price: string; entryPoint?: string; bytes: Uint8Array;
}

export interface UpdateAppInput {
  productId: string; bytes: Uint8Array; entryPoint?: string;
}

/** Pure: build streamed app deployment query parameters (no I/O). */
export function buildAddAppParams(input: AddAppInput): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {
    storefrontId: input.storefrontId,
    title: input.title,
    price: input.price,
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
    /** Add an app to a storefront using Studio's streamed ZIP endpoint. */
    add: (input: AddAppInput) =>
      t.postArchive("/api/app-deploy", buildAddAppParams(input), input.bytes, AckSchema),

    /** Update an app's file, optionally changing the entry point. */
    update: (input: UpdateAppInput) =>
      t.post("update-app", buildUpdateAppParams(input), AckSchema),

    /** Grant a token for accessing an app product. */
    grantToken: (input: { productId: string }) =>
      t.post("grant-app-token", input, AckSchema),
  };
}
