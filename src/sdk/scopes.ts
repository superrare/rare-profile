// VENDORED COPY of superlinks app/lib/cli-scopes.ts (the server is the source of truth).
// When bumping against a new server version, re-sync this union and DEFAULT_CLI_SCOPES.
// Upstream: superlinks repo, app/lib/cli-scopes.ts.
export type CliScope =
  | "profile" | "links" | "storefronts" | "products" | "apps" | "posts"
  | "social" | "messages" | "analytics" | "events" | "studio"
  | "purchase" | "wallet";

/** Default scopes requested at login — everything except money movement. */
export const DEFAULT_CLI_SCOPES: readonly CliScope[] = [
  "profile", "links", "storefronts", "products", "apps", "posts",
  "social", "messages", "analytics", "events", "studio",
];
