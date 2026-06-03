import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

export const postCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "create": {
      const text = flags.text as string | undefined;
      const mediaPath = flags.media as string | undefined;
      if (!text && !mediaPath) {
        throw new UsageError("post create requires at least --text <content> or --media <path>");
      }
      const input: {
        content?: string;
        storefrontId?: string;
        media?: { fileName: string; bytes: Uint8Array; mimeType: string };
      } = {};
      if (text !== undefined) input.content = text;
      if (flags.store !== undefined) input.storefrontId = flags.store as string;
      if (mediaPath !== undefined) {
        const bytes = new Uint8Array(readFileSync(mediaPath));
        input.media = {
          fileName: basename(mediaPath),
          bytes,
          mimeType: (flags["media-type"] as string) ?? "application/octet-stream",
        };
      }
      const data = await client.posts.create(input);
      return { data, human: () => "Post created." };
    }

    case "rm": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("post rm requires a post ID: rare-profile post rm <id>");
      const data = await client.posts.delete({ postId: id });
      return { data, human: () => "Post deleted." };
    }

    case "list": {
      const input: { storefrontId?: string; profileId?: string; limit?: number } = {};
      if (flags.store !== undefined) input.storefrontId = flags.store as string;
      if (flags.profile !== undefined) input.profileId = flags.profile as string;
      if (flags.limit !== undefined) input.limit = Number(flags.limit);
      const data = await client.posts.list(input);
      return { data, human: () => "Posts." };
    }

    case "comment": {
      const postId = args.positionals[2];
      const text = args.positionals[3];
      if (!postId || !text) {
        throw new UsageError("post comment requires a post ID and text: rare-profile post comment <postId> <text>");
      }
      const data = await client.posts.comment({ postId, content: text });
      return { data, human: () => "Comment added." };
    }

    case "comments": {
      const postId = args.positionals[2];
      if (!postId) throw new UsageError("post comments requires a post ID: rare-profile post comments <postId>");
      const data = await client.posts.comments({ postId });
      return { data, human: () => "Comments." };
    }

    default:
      throw new UsageError(
        `Unknown post subcommand: ${String(sub)}. Valid subcommands: create, rm, list, comment, comments`
      );
  }
};
