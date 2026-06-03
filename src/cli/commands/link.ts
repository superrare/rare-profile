import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

export const linkCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "add": {
      const title = args.positionals[2];
      const url = args.positionals[3];
      if (!title || !url) throw new UsageError("link add requires: rare-profile link add <title> <url> [--icon <icon>]");
      const data = await client.links.add({ title, url, icon: flags.icon as string | undefined });
      return { data, human: () => `Added link: ${title}` };
    }

    case "list": {
      const data = await client.links.list({});
      return {
        data,
        human: (d) => {
          const res = d as { links?: unknown[] };
          return `${res.links?.length ?? 0} links`;
        },
      };
    }

    case "rm": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("link rm requires a link ID: rare-profile link rm <id>");
      const data = await client.links.delete({ linkId: id });
      return { data, human: () => "Link deleted." };
    }

    case "update": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("link update requires a link ID: rare-profile link update <id> [--title ...] [--url ...] [--icon ...]");
      const input: { linkId: string; title?: string; url?: string; icon?: string } = { linkId: id };
      if (flags.title !== undefined) input.title = flags.title as string;
      if (flags.url !== undefined) input.url = flags.url as string;
      if (flags.icon !== undefined) input.icon = flags.icon as string;
      const data = await client.links.update(input);
      return { data, human: () => "Link updated." };
    }

    case "reorder": {
      const ids = args.positionals.slice(2);
      if (ids.length === 0) throw new UsageError("link reorder requires at least one link ID: rare-profile link reorder <id1> [id2 ...]");
      const data = await client.links.reorder({ linkIds: ids });
      return { data, human: () => "Links reordered." };
    }

    default:
      throw new UsageError(
        `Unknown link subcommand: ${String(sub)}. Valid subcommands: add, list, rm, update, reorder`
      );
  }
};
