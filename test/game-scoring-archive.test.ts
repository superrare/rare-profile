import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { inspectScoringArchive } from "../src/cli/game-scoring-archive.js";

const gameFiles = {
  "server-verifier.js": strToU8("export function createRun() { return {}; }"),
  "scoring-config.json": strToU8(JSON.stringify({ game: "flappy-bird", maxTicks: 1400, roundTicks: 1200 })),
  "assets/game.js": new Uint8Array(2_000_000),
};

test("recognizes a server-scored app and reads its root config without unpacking assets", () => {
  const result = inspectScoringArchive(zipSync(gameFiles));
  assert.deepEqual(result, {
    kind: "game",
    config: { game: "flappy-bird", maxTicks: 1400, roundTicks: 1200 },
  });
});

test("does not enable scoring for a normal static app archive", () => {
  assert.deepEqual(inspectScoringArchive(zipSync({ "index.html": strToU8("<main>app</main>") })), { kind: "not-game" });
});

test("rejects a verifier archive without its scoring config", () => {
  const result = inspectScoringArchive(zipSync({ "server-verifier.js": gameFiles["server-verifier.js"] }));
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") assert.match(result.message, /must contain both/);
});

test("rejects invalid scoring config before upload", () => {
  const result = inspectScoringArchive(zipSync({
    "server-verifier.js": gameFiles["server-verifier.js"],
    "scoring-config.json": strToU8(JSON.stringify({ maxTicks: 0 })),
  }));
  assert.equal(result.kind, "invalid");
  if (result.kind === "invalid") assert.match(result.message, /maxTicks/);
});

test("rejects malformed ZIP input", () => {
  assert.deepEqual(inspectScoringArchive(strToU8("not a zip")), {
    kind: "invalid",
    message: "ZIP archive could not be inspected.",
  });
});
