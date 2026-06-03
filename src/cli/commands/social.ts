import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

// NOTE: social dispatches on positionals[0] (the group name is the verb itself)
export const socialCommand: CommandHandler = async ({ client, args }) => {
  const verb = args.positionals[0];
  const flags = args.flags;

  switch (verb) {
    case "follow": {
      const userId = args.positionals[1];
      if (!userId) throw new UsageError("follow requires a user ID: rare-profile follow <userId>");
      const data = await client.social.follow({ targetId: userId });
      return { data, human: () => "Followed." };
    }

    case "unfollow": {
      const userId = args.positionals[1];
      if (!userId) throw new UsageError("unfollow requires a user ID: rare-profile unfollow <userId>");
      const data = await client.social.unfollow({ targetId: userId });
      return { data, human: () => "Unfollowed." };
    }

    case "feed": {
      const input: { limit?: number } = {};
      if (flags.limit !== undefined) input.limit = Number(flags.limit);
      const data = await client.social.feed(input);
      return { data, human: () => "Feed." };
    }

    case "followers": {
      const data = await client.social.followers({ userId: flags.user as string | undefined });
      return { data, human: () => "Followers." };
    }

    case "following": {
      const data = await client.social.following({ userId: flags.user as string | undefined });
      return { data, human: () => "Following." };
    }

    default:
      throw new UsageError(
        `Unknown social command: ${String(verb)}. Valid commands: follow, unfollow, feed, followers, following`
      );
  }
};
