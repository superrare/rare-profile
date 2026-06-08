import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

export const statsCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];

  switch (sub) {
    case "links": {
      const data = await client.analytics.links();
      return { data, human: () => "Link analytics." };
    }

    case "views": {
      const data = await client.analytics.pageViews();
      return { data, human: () => "Page-view analytics." };
    }

    case "creator": {
      const data = await client.analytics.creatorStats();
      return { data, human: () => "Creator stats." };
    }

    default:
      throw new UsageError(
        `Unknown stats subcommand: ${String(sub)}. Valid subcommands: links, views, creator`
      );
  }
};
