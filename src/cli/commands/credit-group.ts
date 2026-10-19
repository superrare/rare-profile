import { z } from "zod";
import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";
import type { CreditGroup, CreditGroupSummary, CreditGroupGrantResult } from "../../sdk/index.js";

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
    `chainId: ${group.chainId} currency: ${group.currency} packPriceAtomic: ${group.packPriceAtomic} packCredits: ${group.packCredits}`,
    `treasuryAddress: ${group.treasuryAddress} tokenAddress: ${String(group.tokenAddress)}`,
    `purchasesPaused: ${group.purchasesPaused} newUsesPaused: ${group.newUsesPaused} paymentConfigId: ${String(group.paymentConfigId)}`,
    ...group.apps.map((app) => `appId: ${app.productId} appOrigin: ${app.origin} creditCost: ${app.creditCost}`),
  ].join("\n");
}

function currency(value: string | boolean | undefined): "ETH" | "USDC" {
  if (value !== "ETH" && value !== "USDC") throw new UsageError("--currency must be ETH or USDC");
  return value;
}

function paymentTerms(args: { flags: Record<string, string | boolean | undefined> }) {
  const selectedCurrency = currency(args.flags.currency);
  const suppliedToken = args.flags["token-address"];
  if (selectedCurrency === "ETH" && suppliedToken !== undefined) {
    throw new UsageError("--token-address is only valid with --currency USDC");
  }
  const tokenAddress = selectedCurrency === "USDC" ? required(suppliedToken, "token-address").toLowerCase() : null;
  return {
    currency: selectedCurrency,
    tokenAddress,
    treasuryAddress: required(args.flags.treasury, "treasury").toLowerCase(),
    packPriceAtomic: required(args.flags["pack-price-atomic"], "pack-price-atomic"),
    packCredits: positiveInt(args.flags["pack-credits"], "pack-credits"),
  };
}

const usageDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/).datetime({ offset: true });
function usageRangeValue(value: string | boolean | undefined, name: string): string {
  const text = required(value, name);
  if (!usageDateTime.safeParse(text).success) throw new UsageError(`--${name} must be a valid RFC3339 date-time with Z or an explicit numeric offset`);
  return new Date(text).toISOString();
}

export const creditGroupCommand: CommandHandler = async ({ client, args }) => {
  const offset = args.positionals[0] === "credit-group" ? 1 : 0;
  const sub = args.positionals[offset];
  const id = args.positionals[offset + 1];
  switch (sub) {
    case "usage": {
      if (!id || !z.string().uuid().safeParse(id).success) throw new UsageError("credit-group usage requires a UUID GROUP_ID");
      const from = usageRangeValue(args.flags.from, "from");
      const to = usageRangeValue(args.flags.to, "to");
      if (Date.parse(from) >= Date.parse(to)) throw new UsageError("--from must be earlier than --to");
      const limit = args.flags.limit === undefined ? undefined : positiveInt(args.flags.limit, "limit");
      if (limit !== undefined && limit > 100) throw new UsageError("--limit must be at most 100");
      const afterAppId = args.flags.after === undefined ? undefined : required(args.flags.after, "after");
      if (afterAppId !== undefined && !z.string().uuid().safeParse(afterAppId).success) throw new UsageError("--after must be an app UUID");
      const data = await client.creditGroups.usage({ groupId: id, from, to, limit, afterAppId });
      return { data, human: () => [
        `Usage for group ${data.groupId}: [${data.from}, ${data.to})`,
        `Whole interval totals: capturedPlays: ${data.totals.capturedPlays}; creditsConsumed: ${data.totals.creditsConsumed}; completedPlays: ${data.totals.completedPlays}`,
        `Current page: ${data.games.length} games (app UUID ascending)`,
        ...data.games.map((game) => `appId: ${game.appId} title: ${game.title}; capturedPlays: ${game.capturedPlays}; creditsConsumed: ${game.creditsConsumed}; completedPlays: ${game.completedPlays}`),
        `hasMore: ${data.page.hasMore}; nextCursor: ${data.page.nextCursor ?? "none"}${data.page.nextCursor ? ` (use --after ${data.page.nextCursor} with the same range)` : ""}`,
        "Capture cohort: charged captures in [from,to), not reservations, cancellations, grants or purchases. Completed counts reflect current completion status and may change as runs finish. Credits are not revenue or a free/paid breakdown.",
      ].join("\n") };
    }
    case "grant": {
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new UsageError("credit-group grant requires a UUID GROUP_ID");
      const address = required(args.flags.address, "address");
      if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new UsageError("--address must be an EVM wallet address");
      const credits = positiveInt(args.flags.credits, "credits");
      if (credits > 2147483647) throw new UsageError("--credits must be at most 2147483647");
      const idempotencyKey = required(args.flags["idempotency-key"], "idempotency-key");
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) throw new UsageError("--idempotency-key must be 8..128 characters: letters, digits, dots, underscores, colons or hyphens, starting with a letter or digit");
      const reason = required(args.flags.reason, "reason").trim();
      if (!reason || reason.length > 500) throw new UsageError("--reason must be 1..500 characters after trimming");
      const data = await client.creditGroups.grant({ groupId: id, address: address.toLowerCase(), credits, idempotencyKey, reason });
      return { data, human: (value) => {
        const { grant } = value as CreditGroupGrantResult;
        return `Granted ${grant.credits} credits to ${grant.address} in group ${grant.groupId}. Receipt: ${grant.id}; account: ${grant.accountId}; operator: ${grant.operatorProfileId}; key: ${grant.idempotencyKey}; reason: ${grant.reason}; created: ${grant.createdAt}`;
      } };
    }
    case "create": {
      const data = await client.creditGroups.create({
        slug: required(args.flags.slug, "slug"), displayName: required(args.flags.name, "name"),
        chainId: positiveInt(args.flags["chain-id"], "chain-id"),
        ...paymentTerms(args),
      });
      return { data, human: (d) => {
        const result = d as { group: { id: string; purchasesPaused: boolean } };
        return `Created credit group ${result.group.id}. Purchases are ${result.group.purchasesPaused ? "paused" : "enabled"}. Attaching an approved game gates unpaid starts.`;
      } };
    }
    case "update": {
      if (!id) throw new UsageError("credit-group update requires GROUP_ID");
      const data = await client.creditGroups.updatePayment({ groupId: id, ...paymentTerms(args) });
      return { data, human: (d) => `Updated future payment terms for credit group ${(d as { group: { id: string } }).group.id}; purchases are paused pending explicit resume.` };
    }
    case "resume-purchases": {
      if (!id) throw new UsageError("credit-group resume-purchases requires GROUP_ID");
      const data = await client.creditGroups.resumePurchases({ groupId: id });
      return { data, human: (d) => `Resumed purchases for credit group ${(d as { group: { id: string } }).group.id}.` };
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
    default: throw new UsageError(`Unknown credit-group subcommand "${sub ?? ""}". Valid subcommands: create, update, resume-purchases, list, get, usage, add-game, grant`);
  }
};
