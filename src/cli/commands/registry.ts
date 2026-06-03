import type { ProfileClient } from "../../sdk/index.js";
import type { ParsedArgs } from "../args.js";

export interface CommandContext {
  client: ProfileClient;
  args: ParsedArgs;            // args.positionals[0] = group, [1] = subcommand
  json: boolean;
  baseUrl: string;
}
export interface CommandResult { data: unknown; human: (data: unknown) => string }
export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

/** Thrown by a command for a usage error (bad/missing subcommand or arg). bin maps name "UsageError" → exit 2. */
export class UsageError extends Error {
  constructor(message: string) { super(message); this.name = "UsageError"; }
}
