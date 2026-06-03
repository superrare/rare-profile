import type { ParsedArgs } from "../args.js";

/** Token list/revoke have no API action — they are dashboard-only DB ops.
 * We print guidance pointing at the web dashboard. Still --json-shaped via bin. */
export function runTokens(baseUrl: string, args: ParsedArgs): { data: unknown; human: (d: unknown) => string } {
  const sub = args.positionals[1] ?? "list";
  const manageUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/cli`;
  return {
    data: { action: sub, manageUrl, note: "Manage CLI tokens (create/list/revoke) in the web dashboard." },
    human: () => `Manage CLI tokens at: ${manageUrl}`,
  };
}
