import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

export const msgCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "send": {
      const recipient = args.positionals[2];
      const text = args.positionals[3];
      if (!recipient || !text) {
        throw new UsageError("msg send requires recipient and text: rare-profile msg send <recipient> <text>");
      }
      const data = await client.messages.send({ recipient, content: text });
      return { data, human: () => "Message sent." };
    }

    case "inbox": {
      const input: { limit?: number } = {};
      if (flags.limit !== undefined) input.limit = Number(flags.limit);
      const data = await client.messages.inbox(input);
      return { data, human: () => "Inbox." };
    }

    case "read": {
      const partnerId = args.positionals[2];
      if (!partnerId) throw new UsageError("msg read requires a partner ID: rare-profile msg read <partnerId>");
      const input: { partnerId: string; limit?: number } = { partnerId };
      if (flags.limit !== undefined) input.limit = Number(flags.limit);
      const data = await client.messages.conversation(input);
      return { data, human: () => "Conversation." };
    }

    case "find": {
      const query = args.positionals[2];
      if (!query) throw new UsageError("msg find requires a query: rare-profile msg find <query>");
      const data = await client.messages.searchUsers({ query });
      return { data, human: () => "Users." };
    }

    default:
      throw new UsageError(
        `Unknown msg subcommand: ${String(sub)}. Valid subcommands: send, inbox, read, find`
      );
  }
};
