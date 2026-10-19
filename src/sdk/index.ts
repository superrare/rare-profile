export { createProfileClient, type ProfileClient, type ProfileClientOptions } from "./client.js";
export { ProfileApiError, ProfileAuthError } from "./errors.js";
export { DEFAULT_CLI_SCOPES, type CliScope } from "./scopes.js";
// Export only the public response model types. The Zod schemas (ProfileSchema,
// LinkSchema, AckSchema) are validation internals and deliberately stay unexported.
export type { Profile, Link } from "./types.js";
export type { CreditGroup, CreditGroupSummary, CreditGroupApp } from "./types.js";
export type { CreditGroupGrant, CreditGroupGrantResult } from "./types.js";
export type { GrantCreditGroupCreditsInput } from "./domains/credit-groups.js";
export type { CreditGroupUsageGame, CreditGroupUsageResult } from "./types.js";
export type { CreditGroupUsageInput } from "./domains/credit-groups.js";
export type { PublishScoringInput, PublishScoringResult } from "./domains/apps.js";
