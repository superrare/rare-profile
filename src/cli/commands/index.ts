import type { CommandHandler } from "./registry.js";
import type { ProfileClient } from "../../sdk/index.js";
import { profileCommand } from "./profile.js";
import { linkCommand } from "./link.js";
import { storeCommand } from "./store.js";
import { productCommand } from "./product.js";

const whoamiCommand: CommandHandler = async ({ client }) => {
  const data = await client.profile.get();
  return { data, human: (d) => { const p = d as { username?: string; id: string }; return `@${p.username ?? "?"} (${p.id})`; } };
};

/** Authenticated data commands. login/logout stay special-cased in bin.ts. */
export const dataCommands: Record<string, CommandHandler> = {
  whoami: whoamiCommand,
  profile: profileCommand,
  link: linkCommand,
  store: storeCommand,
  product: productCommand,
};
export type { ProfileClient };
