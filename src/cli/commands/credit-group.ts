import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";
import type { CreditGroup, CreditGroupSummary } from "../../sdk/index.js";

const required = (value: string | boolean | undefined, name: string): string => {
  if (typeof value !== "string" || !value) throw new UsageError(`--${name} is required`);
  return value;
};
const positiveInt = (value: string | boolean | undefined, name: string): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new UsageError(`--${name} must be a positive integer`);
  return Number(value);
};
function formatCreditGroupList(value: unknown): string {
  // `client.creditGroups.list` validates this payload against its public schema.
  const result = value as { groups: CreditGroupSummary[] };
  return result.groups.length === 0 ? "No credit groups found." : result.groups.map((group) => [
    `${group.displayName} (${group.slug})`,
    `  groupId: ${group.id}`,
    ...group.apps.map((app) => `  appId: ${app.productId} origin: ${app.origin} creditCost: ${app.creditCost}`),
  ].join("\n")).join("\n");
}

function formatCreditGroup(value: unknown): string {
  // `client.creditGroups.get` validates this payload against its public schema.
  const result = value as { group: CreditGroup };
  const group = result.group;
  return [
    `name: ${group.displayName} slug: ${group.slug}`,
    `groupId: ${group.id}`,
    `chainId: ${group.chainId} packPriceAtomic: ${group.packPriceAtomic} packCredits: ${group.packCredits}`,
    `treasuryAddress: ${group.treasuryAddress} usdcAddress: ${group.usdcAddress}`,
    `purchasesPaused: ${group.purchasesPaused} newUsesPaused: ${group.newUsesPaused} paymentConfigId: ${String(group.paymentConfigId)}`,
    ...group.apps.map((app) => `appId: ${app.productId} appOrigin: ${app.origin} creditCost: ${app.creditCost}`),
  ].join("\n");
}

export const creditGroupCommand: CommandHandler = async ({ client, args }) => {
  const offset = args.positionals[0] === "credit-group" ? 1 : 0;
  const sub = args.positionals[offset];
  const id = args.positionals[offset + 1];
  switch (sub) {
    case "create": {
      const data = await client.creditGroups.create({
        slug: required(args.flags.slug, "slug"), displayName: required(args.flags.name, "name"),
        chainId: positiveInt(args.flags["chain-id"], "chain-id"),
        treasuryAddress: required(args.flags.treasury, "treasury").toLowerCase(),
        usdcAddress: required(args.flags.usdc, "usdc").toLowerCase(),
        packPriceAtomic: required(args.flags["pack-price-atomic"], "pack-price-atomic"),
        packCredits: positiveInt(args.flags["pack-credits"], "pack-credits"),
      });
      return { data, human: (d) => {
        const result = d as { group: { id: string; purchasesPaused: boolean } };
        return `Created credit group ${result.group.id}. Purchases are ${result.group.purchasesPaused ? "paused" : "enabled"}. Attaching an approved game gates unpaid starts.`;
      } };
    }
    case "list": {
      const data = await client.creditGroups.list({ appId: typeof args.flags.app === "string" ? args.flags.app : undefined });
      return { data, human: formatCreditGroupList };
    }
    case "get": {
      if (!id) throw new UsageError("credit-group get requires GROUP_ID");
      const data = await client.creditGroups.get({ groupId: id });
      return { data, human: formatCreditGroup };
    }
    case "add-game": {
      if (!id) throw new UsageError("credit-group add-game requires GROUP_ID");
      const origin = required(args.flags.origin, "origin");
      const data = await client.creditGroups.addApp({ groupId: id, appId: required(args.flags.app, "app"), origin, creditCost: args.flags.credits === undefined ? undefined : positiveInt(args.flags.credits, "credits") });
      return { data, human: (d) => { const result = d as {groupId:string;app:{productId:string;origin:string;creditCost:number}}; return `Added app ${result.app.productId} to group ${result.groupId}: ${result.app.origin} (creditCost ${result.app.creditCost}). Approved registrations on active groups gate unpaid starts.`; } };
    }
    default: throw new UsageError(`Unknown credit-group subcommand "${sub ?? ""}". Valid subcommands: create, list, get, add-game`);
  }
};
