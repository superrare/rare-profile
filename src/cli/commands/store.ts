import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

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
        human: (d) => {
          if (Array.isArray(d)) return `${d.length} storefronts`;
          return "Your storefronts.";
        },
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
