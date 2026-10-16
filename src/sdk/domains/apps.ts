import { z } from "zod";
import { ProfileApiError } from "../errors.js";
import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";
import { encodeBase64, setIfDefined } from "../media.js";

export interface AddAppInput {
  storefrontId: string; title: string; price: string; entryPoint?: string; bytes: Uint8Array;
}

export interface UpdateAppInput {
  productId: string; bytes: Uint8Array; entryPoint?: string;
}
export interface PublishScoringInput {
  productId: string;
  deploymentId: string;
  config: Record<string, unknown>;
  maxAttempts: number;
  authPolicy?: "authenticated" | "any";
}

export interface PublishScoringResult {
  deploymentId: string;
  verifierVersionId: string | null;
  eventId: string;
  alreadyActive: boolean;
}

const ActiveEventSchema = z.object({ eventId: z.string() }).passthrough();
const VerifierVersionResponseSchema = z.object({
  verifierVersion: z.object({ id: z.string(), conformance_status: z.string() }).passthrough(),
}).passthrough();
const ScoreEventResponseSchema = z.object({
  event: z.object({ id: z.string() }).passthrough(),
}).passthrough();

/** Pure: build streamed app deployment query parameters (no I/O). */
export function buildAddAppParams(input: AddAppInput): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {
    storefrontId: input.storefrontId,
    title: input.title,
    price: input.price,
  };
  setIfDefined(params, "entryPoint", input.entryPoint);
  return params;
}

/** Pure: build the update-app request body (no I/O). */
export function buildUpdateAppParams(input: UpdateAppInput): Record<string, unknown> {
  const params: Record<string, unknown> = {
    productId: input.productId,
    fileContent: encodeBase64(input.bytes),
  };
  setIfDefined(params, "entryPoint", input.entryPoint);
  return params;
}
async function readActiveEvent(t: Transport, productId: string): Promise<{ eventId: string } | null> {
  try {
    return await t.get(`/api/v1/games/${encodeURIComponent(productId)}/scoring/active-event`, "game-scoring-active-event", ActiveEventSchema);
  } catch (error) {
    if (error instanceof ProfileApiError
      && error.status === 404
      && error.code === "GAME_NOT_FOUND"
      && error.message === "No active scoring event for this deployment") return null;
    throw error;
  }
}

export function makeAppsDomain(t: Transport) {
  return {
    /** Add an app to a storefront using Studio's streamed ZIP endpoint. */
    add: (input: AddAppInput) =>
      t.postArchive("/api/app-deploy", buildAddAppParams(input), input.bytes, AckSchema),

    /** Update an app's file, optionally changing the entry point. */
    update: (input: UpdateAppInput) =>
      t.post("update-app", buildUpdateAppParams(input), AckSchema),

    /** Grant a token for accessing an app product. */
    grantToken: (input: { productId: string }) =>
      t.post("grant-app-token", input, AckSchema),

    /** Register the current deployment's verifier and create its active scoring event. */
    publishScoring: (input: PublishScoringInput) => publishScoring(t, input),
  };
}
async function publishScoring(t: Transport, input: PublishScoringInput): Promise<PublishScoringResult> {
  if (!Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10_000) {
    throw new TypeError("maxAttempts must be an integer from 1 to 10000");
  }
  const existing = await readActiveEvent(t, input.productId);
  if (existing) {
    return {
      deploymentId: input.deploymentId,
      verifierVersionId: null,
      eventId: existing.eventId,
      alreadyActive: true,
    };
  }

  const version = await t.postJson(
    `/api/v1/games/${encodeURIComponent(input.productId)}/scoring/versions`,
    "game-scoring-create-verifier-version",
    { deploymentId: input.deploymentId, config: input.config },
    VerifierVersionResponseSchema,
  );
  if (version.verifierVersion.conformance_status !== "passed") {
    throw new ProfileApiError(
      "game-scoring-create-verifier-version",
      502,
      "Verifier version did not pass conformance.",
    );
  }

  const event = await t.postJson(
    `/api/v1/games/${encodeURIComponent(input.productId)}/scoring/events`,
    "game-scoring-create-event",
    {
      verifierVersionId: version.verifierVersion.id,
      maxAttempts: input.maxAttempts,
      authPolicy: input.authPolicy ?? "authenticated",
    },
    ScoreEventResponseSchema,
  );
  const active = await readActiveEvent(t, input.productId);
  if (!active || active.eventId !== event.event.id) {
    throw new ProfileApiError(
      "game-scoring-verify-event",
      502,
      "Scoring event was created but is not active for the current deployment.",
    );
  }
  return {
    deploymentId: input.deploymentId,
    verifierVersionId: version.verifierVersion.id,
    eventId: event.event.id,
    alreadyActive: false,
  };
}
