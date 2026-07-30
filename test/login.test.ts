import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLogin } from "../src/cli/commands/login.js";
import { resolveBaseUrl } from "../src/cli/base-url.js";

test("login runs device flow, emits NDJSON awaiting_approval, and stores the PAT", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rp-login-"));
  const configPath = join(dir, "config.json");
  const lines: string[] = [];

  const fakeFlow = {
    userCode: "WXYZ-1234",
    verificationUri: "https://x.test/dashboard/cli",
    verificationUriComplete: "https://x.test/dashboard/cli?code=WXYZ-1234",
    poll: async () => "slk_minted",
  };
  const clientFactory = () => ({
    auth: { startDeviceFlow: async () => fakeFlow, exchange: async () => "jwt" },
    setToken() {},
    profile: {},
  }) as never;

  const res = await runLogin({ positionals: ["login"], flags: { json: true } }, {
    baseUrl: "https://x.test", json: true, out: (l) => lines.push(l), configPath, clientFactory,
  });

  assert.deepEqual(JSON.parse(lines[0]), {
    ok: true, command: "login", event: "awaiting_approval",
    userCode: "WXYZ-1234", verificationUri: "https://x.test/dashboard/cli?code=WXYZ-1234",
  });
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(cfg.token, "slk_minted");
  assert.ok(res.scopes.includes("profile"));
  rmSync(dir, { recursive: true, force: true });
});

test("login persists the resolved Studio URL for a legacy config", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rp-login-migration-"));
  const configPath = join(dir, "config.json");
  const baseUrl = resolveBaseUrl({ configuredBaseUrl: "https://beta.rare.xyz/" });
  let clientBaseUrl = "";

  const clientFactory = (opts: { baseUrl: string }) => {
    clientBaseUrl = opts.baseUrl;
    return {
      auth: {
        startDeviceFlow: async () => ({
          userCode: "WXYZ-1234",
          verificationUri: `${opts.baseUrl}/dashboard/cli`,
          verificationUriComplete: `${opts.baseUrl}/dashboard/cli?code=WXYZ-1234`,
          poll: async () => "slk_migrated",
        }),
        exchange: async () => "jwt",
      },
      setToken() {},
      profile: {},
    } as never;
  };

  await runLogin(
    { positionals: ["login"], flags: { json: true } },
    { baseUrl, json: true, out: () => {}, configPath, clientFactory },
  );

  const cfg = JSON.parse(readFileSync(configPath, "utf8")) as { token: string; baseUrl: string };
  assert.equal(clientBaseUrl, "https://studio.superrare.com");
  assert.deepEqual(cfg, {
    token: "slk_migrated",
    baseUrl: "https://studio.superrare.com",
  });
  rmSync(dir, { recursive: true, force: true });
});
