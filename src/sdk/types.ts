import { z } from "zod";

export const CreditGroupAppSchema = z.object({ productId: z.string(), origin: z.string(), creditCost: z.number().int() }).passthrough();
export const CreditGroupSchema = z.object({
  id: z.string(), slug: z.string(), displayName: z.string(), chainId: z.number().int(),
  currency: z.enum(["ETH", "USDC"]), tokenAddress: z.string().nullable(),
  treasuryAddress: z.string(), packPriceAtomic: z.string(), packCredits: z.number().int(),
  purchasesPaused: z.boolean(), newUsesPaused: z.boolean(), paymentConfigId: z.string().nullable(), apps: z.array(CreditGroupAppSchema),
}).passthrough();
export const CreditGroupSummarySchema = z.object({ id: z.string(), slug: z.string(), displayName: z.string(), chainId: z.number().int(), apps: z.array(CreditGroupAppSchema) }).passthrough();
export const CreditGroupResultSchema = z.object({ group: CreditGroupSchema });
export const CreditGroupsResultSchema = z.object({ groups: z.array(CreditGroupSummarySchema) });
export const CreditGroupAppResultSchema = z.object({ groupId: z.string(), app: CreditGroupAppSchema });
export type CreditGroup = z.infer<typeof CreditGroupSchema>;
export type CreditGroupSummary = z.infer<typeof CreditGroupSummarySchema>;
export type CreditGroupApp = z.infer<typeof CreditGroupAppSchema>;

export const CreditGroupGrantSchema = z.object({
  id: z.string().uuid(), groupId: z.string().uuid(), accountId: z.string().uuid(),
  address: z.string().regex(/^0x[0-9a-f]{40}$/),
  credits: z.number().int().positive().max(2147483647),
  operatorProfileId: z.string().uuid(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  reason: z.string().min(1).max(500).refine((value) => value === value.trim()),
  createdAt: z.string().datetime({ offset: true }),
});
export const CreditGroupGrantResultSchema = z.object({ grant: CreditGroupGrantSchema });
export type CreditGroupGrant = z.infer<typeof CreditGroupGrantSchema>;
export type CreditGroupGrantResult = z.infer<typeof CreditGroupGrantResultSchema>;

const CreditGroupUsageCountersSchema = z.object({
  capturedPlays: z.string().regex(/^\d+$/),
  creditsConsumed: z.string().regex(/^\d+$/),
  completedPlays: z.string().regex(/^\d+$/),
});
export const CreditGroupUsageGameSchema = CreditGroupUsageCountersSchema.extend({
  appId: z.string().uuid(),
  title: z.string(),
});
export const CreditGroupUsageResultSchema = z.object({
  groupId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  totals: CreditGroupUsageCountersSchema,
  games: z.array(CreditGroupUsageGameSchema),
  page: z.object({ hasMore: z.boolean(), nextCursor: z.string().uuid().nullable() }),
});
export type CreditGroupUsageGame = z.infer<typeof CreditGroupUsageGameSchema>;
export type CreditGroupUsageResult = z.infer<typeof CreditGroupUsageResultSchema>;

/** Most write endpoints return the full row; we validate the fields we rely on and allow extras. */
export const ProfileSchema = z.object({
  id: z.string(),
  username: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  banner_url: z.string().nullable().optional(),
  rare_name: z.string().nullable().optional(),
  follower_count: z.number().nullable().optional(),
  following_count: z.number().nullable().optional(),
}).passthrough();
export type Profile = z.infer<typeof ProfileSchema>;

export const LinkSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  active: z.boolean().nullable().optional(),
  sort_order: z.number().nullable().optional(),
}).passthrough();
export type Link = z.infer<typeof LinkSchema>;

/**
 * Generic acknowledgement payloads, e.g. { deleted: true } or array responses from
 * list endpoints. Intentionally permissive: it only guarantees the body is a JSON
 * object or array (rejecting scalar/garbage responses), NOT any particular shape.
 * Endpoints the CLI reads specific fields from (profile, links, username) use the
 * dedicated schemas above; everything else is pass-through until its response
 * contract is pinned down. Tighten per-endpoint here when a caller depends on fields.
 */
export const AckSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);
