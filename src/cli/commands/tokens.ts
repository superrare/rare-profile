import type { ParsedArgs } from "../args.js";
import { UsageError } from "./registry.js";

/** Token list/revoke have no API action — they are dashboard-only DB ops.
 * We print guidance pointing at the web dashboard. Still --json-shaped via bin. */
export function runTokens(baseUrl: string, args: ParsedArgs): { data: unknown; human: (d: unknown) => string } {
  const sub = args.positionals[1] ?? "list";
  if (sub !== "list" && sub !== "revoke") {
    throw new UsageError(`Unknown tokens subcommand: ${sub}. Valid subcommands: list, revoke`);
  }
  const manageUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/cli`;
  const note =
    sub === "revoke"
      ? "Revoke CLI tokens in the web dashboard."
      : "Manage CLI tokens (create/list/revoke) in the web dashboard.";
  return {
    data: { action: sub, manageUrl, note },
    human: () => `Manage CLI tokens at: ${manageUrl}`,
  };
}
