export { createProfileClient, type ProfileClient, type ProfileClientOptions } from "./client.js";
export { ProfileApiError, ProfileAuthError } from "./errors.js";
export { DEFAULT_CLI_SCOPES, type CliScope } from "./scopes.js";
// Export only the public response model types. The Zod schemas (ProfileSchema,
// LinkSchema, AckSchema) are validation internals and deliberately stay unexported.
export type { Profile, Link } from "./types.js";
