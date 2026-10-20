import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

const storefrontListKeys = ["storefronts", "stores", "data", "items", "results"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function storefrontItems(data: unknown): unknown[] | undefined {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return undefined;

  for (const key of storefrontListKeys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      const nested = storefrontItems(value);
      if (nested) return nested;
    }
  }

  return undefined;
}

function renderStorefront(item: unknown, index: number): string {
  if (!isRecord(item)) return `Storefront ${index + 1}`;

  const label = firstString(item, ["name", "display_name", "title", "slug", "id"]) ?? `Storefront ${index + 1}`;
  const slug = firstString(item, ["slug"]);
  const id = firstString(item, ["id", "storefrontId", "storefront_id"]);
  const details = [slug && slug !== label ? `/${slug}` : undefined, id && id !== label ? id : undefined]
    .filter(Boolean)
    .join(", ");

  return details ? `${label} (${details})` : label;
}

export function renderStorefrontList(data: unknown): string {
  const items = storefrontItems(data);
  if (!items) return "Your storefronts.";

  const noun = items.length === 1 ? "storefront" : "storefronts";
  if (items.length === 0) return `0 ${noun}`;
  return `${items.length} ${noun}: ${items.map(renderStorefront).join("; ")}`;
}

export const storeCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "create": {
      const name = args.positionals[2];
      if (!name) throw new UsageError("store create requires a name: rare-profile store create <name> [--description ...]");
      const data = await client.storefronts.create({ name, description: flags.description as string | undefined });
      return { data, human: () => `Created store: ${name}` };
    }

    case "list": {
      const data = await client.storefronts.mine();
      return {
        data,
        human: renderStorefrontList,
      };
    }

    case "get": {
      const slug = args.positionals[2];
      if (!slug) throw new UsageError("store get requires a slug: rare-profile store get <slug>");
      const data = await client.storefronts.get({ slug });
      return { data, human: () => `Store: ${slug}` };
    }

    case "update": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("store update requires a storefront ID: rare-profile store update <id> [--name ...] [--description ...] ...");
      const input: {
        storefrontId: string;
        name?: string;
        description?: string;
        bio?: string;
        website?: string;
        twitter?: string;
        telegram?: string;
        farcaster?: string;
        theme?: string;
      } = { storefrontId: id };
      if (flags.name !== undefined) input.name = flags.name as string;
      if (flags.description !== undefined) input.description = flags.description as string;
      if (flags.bio !== undefined) input.bio = flags.bio as string;
      if (flags.website !== undefined) input.website = flags.website as string;
      if (flags.twitter !== undefined) input.twitter = flags.twitter as string;
      if (flags.telegram !== undefined) input.telegram = flags.telegram as string;
      if (flags.farcaster !== undefined) input.farcaster = flags.farcaster as string;
      if (flags.theme !== undefined) input.theme = flags.theme as string;
      const data = await client.storefronts.update(input);
      return { data, human: () => "Store updated." };
    }

    default:
      throw new UsageError(
        `Unknown store subcommand: ${String(sub)}. Valid subcommands: create, list, get, update`
      );
  }
};
