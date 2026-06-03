import { readFileSync } from "node:fs";
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

/** Parse a numeric flag value. Throws UsageError if the value is not a valid finite number. */
export function numFlag(v: string | boolean | undefined, name: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (typeof v === "boolean" || !Number.isFinite(n)) throw new UsageError(`--${name} must be a number`);
  return n;
}

/** Read a user-supplied file path as bytes. Throws UsageError with a clean message if the path cannot be read. */
export function readFileBytes(path: string): Uint8Array {
  try {
    return new Uint8Array(readFileSync(path));
  } catch (e) {
    throw new UsageError(`Cannot read file ${path}: ${(e as Error).message}`);
  }
}
