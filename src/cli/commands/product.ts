import { basename } from "node:path";
import type { CommandHandler } from "./registry.js";
import { UsageError, readFileBytes } from "./registry.js";

export const productCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "add": {
      const storefrontId = flags.store as string | undefined;
      const title = flags.title as string | undefined;
      const price = flags.price as string | undefined;
      if (!storefrontId || !title || !price) {
        throw new UsageError("product add requires --store, --title, and --price");
      }
      const filePath = flags.file as string | undefined;
      let data: unknown;
      if (filePath) {
        const bytes = readFileBytes(filePath);
        data = await client.products.addWithFile({
          storefrontId,
          title,
          price,
          fileName: basename(filePath),
          bytes,
          description: flags.description as string | undefined,
        });
      } else {
        data = await client.products.add({
          storefrontId,
          title,
          price,
          description: flags.description as string | undefined,
        });
      }
      return { data, human: () => `Added product: ${title}` };
    }

    case "list": {
      const data = await client.products.mine();
      return { data, human: () => "Your products." };
    }

    case "unlist": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("product unlist requires a product ID: rare-profile product unlist <id>");
      const data = await client.products.unlist({ productId: id });
      return { data, human: () => "Product unlisted." };
    }

    case "rm": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("product rm requires a product ID: rare-profile product rm <id>");
      const data = await client.products.delete({ productId: id });
      return { data, human: () => "Product deleted." };
    }

    case "edit": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("product edit requires a product ID: rare-profile product edit <id> [--title ...] [--price ...] [--description ...]");
      const input: { productId: string; title?: string; description?: string; price?: string } = { productId: id };
      if (flags.title !== undefined) input.title = flags.title as string;
      if (flags.price !== undefined) input.price = flags.price as string;
      if (flags.description !== undefined) input.description = flags.description as string;
      const data = await client.products.edit(input);
      return { data, human: () => "Product updated." };
    }

    case "browse": {
      const browseInput: { filter?: string; contentType?: string; listingType?: string } = {};
      if (flags.filter !== undefined) browseInput.filter = flags.filter as string;
      if (flags["content-type"] !== undefined) browseInput.contentType = flags["content-type"] as string;
      if (flags["listing-type"] !== undefined) browseInput.listingType = flags["listing-type"] as string;
      const data = await client.products.browse(browseInput);
      return { data, human: () => "Products." };
    }

    default:
      throw new UsageError(
        `Unknown product subcommand: ${String(sub)}. Valid subcommands: add, list, unlist, rm, edit, browse`
      );
  }
};
