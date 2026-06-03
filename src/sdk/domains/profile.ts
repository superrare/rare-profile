import { z } from "zod";
import type { Transport } from "../transport.js";
import { ProfileSchema } from "../types.js";

const CheckUsernameSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  username: z.string().optional(),
}).passthrough();

export interface ProfileUpdate {
  bio?: string; website?: string; twitter?: string; instagram?: string;
  telegram?: string; farcaster?: string; theme?: string; display_name?: string;
  [key: string]: unknown;
}

export interface FeaturedNft { chain: string; contract: string; tokenId: string; imageUrl?: string }

export function makeProfileDomain(t: Transport) {
  return {
    /** Get a profile by slug/rare_name/username, or the authenticated user when omitted. */
    get: (input: { slug?: string; profileId?: string } = {}) =>
      t.post("get-profile", input, ProfileSchema),
    /** Update profile text fields. */
    update: (input: ProfileUpdate) => t.post("update-profile", input, ProfileSchema),
    /** Upload an avatar from raw bytes (base64'd here). */
    setAvatar: (input: { fileName: string; bytes: Uint8Array; mimeType?: string }) =>
      t.post("update-profile", {
        avatarFileName: input.fileName,
        avatarContent: Buffer.from(input.bytes).toString("base64"),
        avatarMimeType: input.mimeType ?? "image/png",
      }, ProfileSchema),
    /** Upload a banner from raw bytes. */
    setBanner: (input: { fileName: string; bytes: Uint8Array; mimeType?: string }) =>
      t.post("update-profile", {
        bannerFileName: input.fileName,
        bannerContent: Buffer.from(input.bytes).toString("base64"),
        bannerMimeType: input.mimeType ?? "image/png",
      }, ProfileSchema),
    /** Feature an NFT on the profile (showcase metadata; no wallet/signing). */
    featureNft: (input: FeaturedNft) =>
      t.post("update-profile", { featured_nft: input }, ProfileSchema),
    /** Check username availability (public). */
    checkUsername: (input: { username: string }) =>
      t.post("check-username", input, CheckUsernameSchema),
  };
}
