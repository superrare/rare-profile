import type { CommandHandler } from "./registry.js";
import { UsageError } from "./registry.js";

export const studioCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "image": {
      const prompt = flags.prompt as string | undefined;
      if (!prompt) {
        throw new UsageError("studio image requires --prompt <p>");
      }
      const input: {
        prompt: string;
        aspectRatio?: string;
        quality?: string;
        stylePreset?: string;
        count?: number;
        projectId?: string;
      } = { prompt };
      if (flags.aspect !== undefined) input.aspectRatio = flags.aspect as string;
      if (flags.quality !== undefined) input.quality = flags.quality as string;
      if (flags.style !== undefined) input.stylePreset = flags.style as string;
      if (flags.count !== undefined) input.count = Number(flags.count);
      if (flags.project !== undefined) input.projectId = flags.project as string;
      const data = await client.studio.generateImage(input);
      return { data, human: () => "Image run created." };
    }

    case "run": {
      const runId = args.positionals[2];
      if (!runId) throw new UsageError("studio run requires a run ID: rare-profile studio run <runId>");
      const data = await client.studio.getRun({ runId });
      return { data, human: () => "Run." };
    }

    case "runs": {
      const data = await client.studio.listRuns({
        projectId: flags.project as string | undefined,
      });
      return { data, human: () => "Runs." };
    }

    case "assets": {
      const data = await client.studio.listAssets({
        projectId: flags.project as string | undefined,
      });
      return { data, human: () => "Assets." };
    }

    case "projects": {
      const data = await client.studio.listProjects();
      return { data, human: () => "Projects." };
    }

    case "new-project": {
      const name = args.positionals[2];
      if (!name) throw new UsageError("studio new-project requires a name: rare-profile studio new-project <name>");
      const data = await client.studio.createProject({ name });
      return { data, human: () => `Created project: ${name}` };
    }

    default:
      throw new UsageError(
        `Unknown studio subcommand: ${String(sub)}. Valid subcommands: image, run, runs, assets, projects, new-project`
      );
  }
};
