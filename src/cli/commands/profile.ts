import { basename } from "node:path";
import type { CommandHandler } from "./registry.js";
import { UsageError, readFileBytes } from "./registry.js";
import type { ProfileUpdate } from "../../sdk/domains/profile.js";

export const profileCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "show": {
      const data = await client.profile.get({ slug: flags.slug as string | undefined });
      return {
        data,
        human: (d) => {
          const p = d as { username?: string; display_name?: string };
          return `@${p.username ?? "?"} — ${p.display_name ?? ""}`;
        },
      };
    }

    case "set": {
      const update: ProfileUpdate = {};
      if (flags.bio !== undefined) update.bio = flags.bio as string;
      if (flags.website !== undefined) update.website = flags.website as string;
      if (flags["display-name"] !== undefined) update.display_name = flags["display-name"] as string;
      if (flags.twitter !== undefined) update.twitter = flags.twitter as string;
      if (flags.instagram !== undefined) update.instagram = flags.instagram as string;
      if (flags.telegram !== undefined) update.telegram = flags.telegram as string;
      if (flags.farcaster !== undefined) update.farcaster = flags.farcaster as string;
      if (flags.theme !== undefined) update.theme = flags.theme as string;
      if (Object.keys(update).length === 0) {
        throw new UsageError("No recognized flags provided. Supported: --bio, --website, --display-name, --twitter, --instagram, --telegram, --farcaster, --theme");
      }
      const data = await client.profile.update(update);
      return { data, human: () => "Profile updated." };
    }

    case "set-username": {
      const username = (args.positionals[2] ?? flags.username) as string | undefined;
      if (!username) {
        throw new UsageError("set-username requires a handle: rare-profile profile set-username <handle>");
      }
      const data = await client.profile.updateUsername({ username });
      return {
        data,
        human: (d) => {
          const r = d as { username: string; slug: string };
          return `Username updated to @${r.username}. Public URL: /${r.slug}`;
        },
      };
    }

    case "set-avatar": {
      const path = args.positionals[2];
      if (!path) throw new UsageError("set-avatar requires a file path: rare-profile profile set-avatar <path>");
      const bytes = readFileBytes(path);
      const data = await client.profile.setAvatar({ fileName: basename(path), bytes });
      return { data, human: () => "Avatar updated." };
    }

    case "set-banner": {
      const path = args.positionals[2];
      if (!path) throw new UsageError("set-banner requires a file path: rare-profile profile set-banner <path>");
      const bytes = readFileBytes(path);
      const data = await client.profile.setBanner({ fileName: basename(path), bytes });
      return { data, human: () => "Banner updated." };
    }

    case "feature-nft": {
      const chain = flags.chain as string | undefined;
      const contract = flags.contract as string | undefined;
      const tokenId = flags["token-id"] as string | undefined;
      if (!chain || !contract || !tokenId) {
        throw new UsageError("feature-nft requires --chain, --contract, and --token-id");
      }
      const data = await client.profile.featureNft({
        chain,
        contract,
        tokenId,
        imageUrl: flags["image-url"] as string | undefined,
      });
      return { data, human: () => "NFT featured on profile." };
    }

    default:
      throw new UsageError(
        `Unknown profile subcommand: ${String(sub)}. Valid subcommands: show, set, set-username, set-avatar, set-banner, feature-nft`
      );
  }
};
