import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

export const eventsCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "list": {
      const data = await client.events.list({
        unreadOnly: flags["unread-only"] === true ? true : undefined,
      });
      return { data, human: () => "Events." };
    }

    case "read": {
      const idsFlag = flags["ids"] as string | undefined;
      const input: { eventIds?: string[] } = {};
      if (idsFlag) {
        input.eventIds = idsFlag.split(",");
      }
      const data = await client.events.markRead(input);
      return { data, human: () => "Marked read." };
    }

    default:
      throw new UsageError(
        `Unknown events subcommand: ${String(sub)}. Valid subcommands: list, read`
      );
  }
};
