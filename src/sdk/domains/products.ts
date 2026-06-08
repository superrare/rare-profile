import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";
import { encodeBase64, setIfDefined } from "../media.js";

export interface AddWithFileInput {
  storefrontId: string; title: string; price: string; fileName: string; bytes: Uint8Array;
  mimeType?: string; description?: string; listingType?: string; contentType?: string;
}

export interface StageFileInput {
  storefrontId: string; fileName: string; bytes: Uint8Array; contentType: string; mimeType?: string;
}

/** Pure: build the add-product request body from a file upload (no I/O). */
export function buildAddWithFileParams(input: AddWithFileInput): Record<string, unknown> {
  const params: Record<string, unknown> = {
    storefrontId: input.storefrontId,
    title: input.title,
    price: input.price,
    fileContent: encodeBase64(input.bytes),
    fileName: input.fileName,
  };
  setIfDefined(params, "description", input.description);
  setIfDefined(params, "listingType", input.listingType);
  setIfDefined(params, "contentType", input.contentType);
  setIfDefined(params, "mimeType", input.mimeType);
  return params;
}

/** Pure: build the stage-product-file request body (no I/O). */
export function buildStageFileParams(input: StageFileInput): Record<string, unknown> {
  const params: Record<string, unknown> = {
    storefrontId: input.storefrontId,
    fileName: input.fileName,
    fileContent: encodeBase64(input.bytes),
    contentType: input.contentType,
  };
  setIfDefined(params, "mimeType", input.mimeType);
  return params;
}

export function makeProductsDomain(t: Transport) {
  return {
    /** Add a product with an optional pre-staged file path. */
    add: (input: { storefrontId: string; title: string; price: string; description?: string; listingType?: string; contentType?: string; metadata?: object; stagedFilePath?: string; stagedPreviewPath?: string; fileSizeBytes?: number }) =>
      t.post("add-product", input, AckSchema),

    /** Add a product and upload its file in one call (base64-encodes raw bytes). */
    addWithFile: (input: AddWithFileInput) =>
      t.post("add-product", buildAddWithFileParams(input), AckSchema),

    /** Stage a file for later attachment to a product. */
    stageFile: (input: StageFileInput) =>
      t.post("stage-product-file", buildStageFileParams(input), AckSchema),

    /** Edit a product's metadata fields. */
    edit: (input: { productId: string; title?: string; description?: string; price?: string; metadata?: object }) =>
      t.post("edit-product", input, AckSchema),

    /** Unlist a product (makes it no longer publicly available). */
    unlist: (input: { productId: string }) =>
      t.post("unlist", input, AckSchema),

    /** Permanently delete a product. */
    delete: (input: { productId: string }) =>
      t.post("delete-product", input, AckSchema),

    /** Browse the public product catalogue with optional filters. */
    browse: (input: { filter?: string; contentType?: string; listingType?: string } = {}) =>
      t.post("browse", input, AckSchema),

    /** List the authenticated user's own products. */
    mine: () =>
      t.post("my-products", {}, AckSchema),

    /** Get a download URL/payload for a purchased product. */
    download: (input: { productId: string }) =>
      t.post("download", input, AckSchema),
  };
}
