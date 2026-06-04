import type { CommandHandler } from "./registry.js";
import { UsageError, readFileBytes } from "./registry.js";

export const appCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "deploy": {
      const storefrontId = flags.store as string | undefined;
      const title = flags.title as string | undefined;
      const price = flags.price as string | undefined;
      const zipPath = flags.zip as string | undefined;
      if (!storefrontId || !title || !price || !zipPath) {
        throw new UsageError("app deploy requires --store, --title, --price, and --zip <path>");
      }
      const bytes = readFileBytes(zipPath);
      const data = await client.apps.add({
        storefrontId,
        title,
        price,
        entryPoint: flags.entry as string | undefined,
        bytes,
      });
      return { data, human: () => `Deployed app: ${title}` };
    }

    case "update": {
      const id = args.positionals[2];
      const zipPath = flags.zip as string | undefined;
      if (!id) throw new UsageError("app update requires a product ID: rare-profile app update <id> --zip <path>");
      if (!zipPath) throw new UsageError("app update requires --zip <path>");
      const bytes = readFileBytes(zipPath);
      const data = await client.apps.update({
        productId: id,
        bytes,
        entryPoint: flags.entry as string | undefined,
      });
      return { data, human: () => "App updated." };
    }

    case "token": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("app token requires a product ID: rare-profile app token <id>");
      const data = await client.apps.grantToken({ productId: id });
      return { data, human: () => "App token granted." };
    }

    default:
      throw new UsageError(
        `Unknown app subcommand: ${String(sub)}. Valid subcommands: deploy, update, token`
      );
  }
};
