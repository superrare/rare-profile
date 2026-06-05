import { z } from "zod";
import type { Transport } from "../transport.js";
import { ProfileSchema } from "../types.js";
import { encodeBase64 } from "../media.js";

const CheckUsernameSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  username: z.string().optional(),
}).passthrough();

const UsernameUpdateSchema = z.object({
  username: z.string(),
  slug: z.string(),
  previous_username: z.string().optional(),
  previous_slug: z.string().optional(),
}).passthrough();

export interface ProfileUpdate {
  bio?: string; website?: string; twitter?: string; instagram?: string;
  telegram?: string; farcaster?: string; theme?: string; display_name?: string;
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
        avatarContent: encodeBase64(input.bytes),
        avatarMimeType: input.mimeType ?? "image/png",
      }, ProfileSchema),
    /** Upload a banner from raw bytes. */
    setBanner: (input: { fileName: string; bytes: Uint8Array; mimeType?: string }) =>
      t.post("update-profile", {
        bannerFileName: input.fileName,
        bannerContent: encodeBase64(input.bytes),
        bannerMimeType: input.mimeType ?? "image/png",
      }, ProfileSchema),
    /** Feature an NFT on the profile (showcase metadata; no wallet/signing). */
    featureNft: (input: FeaturedNft) =>
      t.post("update-profile", { featured_nft: input }, ProfileSchema),
    /** Check username availability (public). */
    checkUsername: (input: { username: string }) =>
      t.post("check-username", input, CheckUsernameSchema),
    /**
     * Rename the public handle. The server keeps `username` and the URL `slug`
     * in sync (both updated together), enforces format `^[a-z0-9_-]{3,30}$`,
     * rejects reserved handles, and returns 409 on a uniqueness conflict.
     * Distinct from `update`/update-profile, which deliberately ignores
     * username/slug — handle changes require this dedicated action.
     */
    updateUsername: (input: { username: string }) =>
      t.post("update-username", input, UsernameUpdateSchema),
  };
}
