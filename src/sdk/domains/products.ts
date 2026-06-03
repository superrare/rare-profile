import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeProductsDomain(t: Transport) {
  return {
    /** Add a product with an optional pre-staged file path. */
    add: (input: { storefrontId: string; title: string; price: string; description?: string; listingType?: string; contentType?: string; metadata?: object; stagedFilePath?: string; stagedPreviewPath?: string; fileSizeBytes?: number }) =>
      t.post("add-product", input, AckSchema),

    /** Add a product and upload its file in one call (base64-encodes raw bytes). */
    addWithFile: (input: { storefrontId: string; title: string; price: string; fileName: string; bytes: Uint8Array; mimeType?: string; description?: string; listingType?: string; contentType?: string }) => {
      const { bytes, fileName, mimeType, storefrontId, title, price, description, listingType, contentType } = input;
      const params: Record<string, unknown> = {
        storefrontId,
        title,
        price,
        fileContent: Buffer.from(bytes).toString("base64"),
        fileName,
      };
      if (description !== undefined) params.description = description;
      if (listingType !== undefined) params.listingType = listingType;
      if (contentType !== undefined) params.contentType = contentType;
      if (mimeType !== undefined) params.mimeType = mimeType;
      return t.post("add-product", params, AckSchema);
    },

    /** Stage a file for later attachment to a product. */
    stageFile: (input: { storefrontId: string; fileName: string; bytes: Uint8Array; contentType: string; mimeType?: string }) => {
      const { bytes, fileName, storefrontId, contentType, mimeType } = input;
      const params: Record<string, unknown> = {
        storefrontId,
        fileName,
        fileContent: Buffer.from(bytes).toString("base64"),
        contentType,
      };
      if (mimeType !== undefined) params.mimeType = mimeType;
      return t.post("stage-product-file", params, AckSchema);
    },

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
