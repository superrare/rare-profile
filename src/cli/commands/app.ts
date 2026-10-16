import { z } from "zod";
import type { PublishScoringInput } from "../../sdk/index.js";
import type { CommandHandler } from "./registry.js";
import { numFlag, UsageError, readFileBytes } from "./registry.js";
import { inspectScoringArchive } from "../game-scoring-archive.js";

interface ScoringOptions {
  config: Record<string, unknown>;
  maxAttempts: number;
  authPolicy: "authenticated" | "any";
}

const UploadedAppSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
}).passthrough();

const ProductsWithDeploymentSchema = z.object({
  products: z.array(z.object({
    id: z.string(),
    current_deployment_id: z.string().nullable().optional(),
  }).passthrough()),
}).passthrough();

function scoringOptions(flags: Record<string, string | boolean>, bytes: Uint8Array): ScoringOptions | undefined {
  const archive = inspectScoringArchive(bytes);
  if (archive.kind === "invalid") throw new UsageError(archive.message);

  const maxAttempts = numFlag(flags["max-attempts"], "max-attempts");
  const authPolicy = flags["auth-policy"];
  if (archive.kind === "not-game") {
    if (maxAttempts !== undefined || authPolicy !== undefined) {
      throw new UsageError("Scoring options require a ZIP with root server-verifier.js and scoring-config.json");
    }
    return undefined;
  }
  if (maxAttempts === undefined) {
    throw new UsageError("Server-scored game ZIPs require --max-attempts <1-10000>");
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10_000) {
    throw new UsageError("--max-attempts must be an integer from 1 to 10000");
  }
  if (authPolicy !== undefined && authPolicy !== "authenticated" && authPolicy !== "any") {
    throw new UsageError("--auth-policy must be authenticated or any");
  }
  return { config: archive.config, maxAttempts, authPolicy: authPolicy ?? "authenticated" };
}

function uploadedProductId(data: unknown): string {
  const result = UploadedAppSchema.safeParse(data);
  const productId = result.success ? result.data.id ?? result.data.product_id : undefined;
  if (!productId) {
    throw new Error("App upload succeeded, but Studio did not return its product ID; find it with `rare-profile product list`.");
  }
  return productId;
}

function currentDeploymentId(productsData: unknown, productId: string): string {
  const result = ProductsWithDeploymentSchema.safeParse(productsData);
  if (!result.success) {
    throw new Error("Studio returned an unexpected product list while resolving the current deployment.");
  }
  const product = result.data.products.find((item) => item.id === productId);
  if (typeof product?.current_deployment_id !== "string") {
    throw new Error(`Studio did not return a current deployment ID for app ${productId}.`);
  }
  return product.current_deployment_id;
}

async function publishCurrentScoring(
  client: Parameters<CommandHandler>[0]["client"],
  productId: string,
  options: ScoringOptions,
) {
  const products = await client.products.mine();
  const deploymentId = currentDeploymentId(products, productId);
  const scoringInput: PublishScoringInput = {
    productId,
    deploymentId,
    config: options.config,
    maxAttempts: options.maxAttempts,
    authPolicy: options.authPolicy,
  };
  return client.apps.publishScoring(scoringInput);
}

function withScoring(data: unknown, scoring: Awaited<ReturnType<typeof publishCurrentScoring>>): unknown {
  return { app: data, scoring };
}

export const appCommand: CommandHandler = async ({ client, args }) => {
  const sub = args.positionals[1];
  const flags = args.flags;

  switch (sub) {
    case "deploy": {
      const storefrontId = flags.store as string | undefined;
      const title = flags.title as string | undefined;
      const price = flags.price as string | undefined;
      const zipPath = flags.zip as string | undefined;
      if (!storefrontId || !title || !price || !zipPath) {
        throw new UsageError("app deploy requires --store, --title, --price, and --zip <path>");
      }
      const bytes = readFileBytes(zipPath);
      const scoring = scoringOptions(flags, bytes);
      const uploaded = await client.apps.add({
        storefrontId,
        title,
        price,
        entryPoint: flags.entry as string | undefined,
        bytes,
      });
      if (!scoring) return { data: uploaded, human: () => `Deployed app: ${title}` };
      const productId = uploadedProductId(uploaded);
      try {
        const result = await publishCurrentScoring(client, productId, scoring);
        return {
          data: withScoring(uploaded, result),
          human: () => `Deployed app and activated server scoring: ${title}`,
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `App ${productId} was deployed, but server scoring is incomplete. Retry without redeploying: rare-profile app scoring ${productId} --zip ${zipPath} --max-attempts ${scoring.maxAttempts}. ${detail}`,
          { cause: error },
        );
      }
    }

    case "update": {
      const id = args.positionals[2];
      const zipPath = flags.zip as string | undefined;
      if (!id) throw new UsageError("app update requires a product ID: rare-profile app update <id> --zip <path>");
      if (!zipPath) throw new UsageError("app update requires --zip <path>");
      const bytes = readFileBytes(zipPath);
      const scoring = scoringOptions(flags, bytes);
      const uploaded = await client.apps.update({
        productId: id,
        bytes,
        entryPoint: flags.entry as string | undefined,
      });
      if (!scoring) return { data: uploaded, human: () => "App updated." };
      try {
        const result = await publishCurrentScoring(client, id, scoring);
        return {
          data: withScoring(uploaded, result),
          human: () => `App updated and server scoring activated for ${id}.`,
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `App ${id} was updated, but server scoring is incomplete. Retry without redeploying: rare-profile app scoring ${id} --zip ${zipPath} --max-attempts ${scoring.maxAttempts}. ${detail}`,
          { cause: error },
        );
      }
    }

    case "scoring": {
      const id = args.positionals[2];
      const zipPath = flags.zip as string | undefined;
      if (!id) throw new UsageError("app scoring requires a product ID: rare-profile app scoring <id> --zip <path> --max-attempts <n>");
      if (!zipPath) throw new UsageError("app scoring requires --zip <path>");
      const bytes = readFileBytes(zipPath);
      const scoring = scoringOptions(flags, bytes);
      if (!scoring) throw new UsageError("app scoring requires a ZIP containing root server-verifier.js and scoring-config.json");
      const result = await publishCurrentScoring(client, id, scoring);
      return {
        data: result,
        human: () => `Server scoring is active for ${id} (event ${result.eventId}).`,
      };
    }

    case "token": {
      const id = args.positionals[2];
      if (!id) throw new UsageError("app token requires a product ID: rare-profile app token <id>");
      const data = await client.apps.grantToken({ productId: id });
      return { data, human: () => "App token granted." };
    }

    default:
      throw new UsageError(
        `Unknown app subcommand: ${String(sub)}. Valid subcommands: deploy, update, scoring, token`
      );
  }
};
