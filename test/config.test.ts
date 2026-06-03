import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig, writeConfig, clearConfig } from "../src/cli/config.js";

test("write then read round-trips and file is 0600", () => {
  const dir = mkdtempSync(join(tmpdir(), "rp-"));
  const path = join(dir, "config.json");
  writeConfig({ token: "slk_x", baseUrl: "https://rare.xyz" }, path);
  const cfg = readConfig(path);
  assert.deepEqual(cfg, { token: "slk_x", baseUrl: "https://rare.xyz" });
  const mode = statSync(path).mode & 0o777;
  assert.equal(mode, 0o600);
  rmSync(dir, { recursive: true, force: true });
});

test("reading a missing file returns null", () => {
  assert.equal(readConfig("/nonexistent/rare-profile/config.json"), null);
});

test("clear removes the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "rp-"));
  const path = join(dir, "config.json");
  writeConfig({ token: "t", baseUrl: "b" }, path);
  clearConfig(path);
  assert.equal(readConfig(path), null);
  rmSync(dir, { recursive: true, force: true });
});
