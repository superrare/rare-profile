import { strFromU8, unzipSync } from "fflate";

const VERIFIER_PATH = "server-verifier.js";
const CONFIG_PATH = "scoring-config.json";
const MAX_CONFIG_BYTES = 1024 * 1024;

export type ScoringArchiveInspection =
  | { kind: "not-game" }
  | { kind: "game"; config: Record<string, unknown> }
  | { kind: "invalid"; message: string };

/** Reads only the two root scoring files; game assets are never decompressed locally. */
export function inspectScoringArchive(bytes: Uint8Array): ScoringArchiveInspection {
  let verifierCount = 0;
  let configCount = 0;
  let oversizedConfig = false;
  let files: ReturnType<typeof unzipSync>;
  try {
    files = unzipSync(bytes, {
      filter(entry) {
        if (entry.name === VERIFIER_PATH) {
          verifierCount += 1;
          return false;
        }
        if (entry.name === CONFIG_PATH) {
          configCount += 1;
          if (entry.originalSize > MAX_CONFIG_BYTES) {
            oversizedConfig = true;
            return false;
          }
          return true;
        }
        return false;
      },
    });
  } catch {
    return { kind: "invalid", message: "ZIP archive could not be inspected." };
  }

  if (oversizedConfig) return { kind: "invalid", message: "scoring-config.json exceeds 1 MiB." };
  if (verifierCount > 1 || configCount > 1) {
    return { kind: "invalid", message: "ZIP must contain at most one root server-verifier.js and scoring-config.json." };
  }
  if (verifierCount === 0 && configCount === 0) return { kind: "not-game" };
  if (verifierCount !== 1 || configCount !== 1) {
    return { kind: "invalid", message: "Server-scored game ZIPs must contain both root server-verifier.js and scoring-config.json." };
  }

  const configBytes = files[CONFIG_PATH];
  if (!configBytes) return { kind: "invalid", message: "scoring-config.json could not be read from the ZIP." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(configBytes));
  } catch {
    return { kind: "invalid", message: "scoring-config.json must contain valid JSON." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "invalid", message: "scoring-config.json must be a JSON object." };
  }
  if (!("maxTicks" in parsed) || typeof parsed.maxTicks !== "number"
    || !Number.isSafeInteger(parsed.maxTicks) || parsed.maxTicks < 1 || parsed.maxTicks > 100_000) {
    return { kind: "invalid", message: "scoring-config.json must set maxTicks to an integer from 1 to 100000." };
  }
  return { kind: "game", config: parsed as Record<string, unknown> };
}
