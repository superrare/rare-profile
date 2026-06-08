import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { runCli, withTempHome } from "../helpers/cli.js";
import { startMockServer, type Routes } from "../helpers/mock-server.js";

/** Split stdout into non-empty lines (login emits NDJSON: a progress line then the final result). */
function lines(stdout: string): string[] {
  return stdout.split("\n").filter((l) => l.trim() !== "");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("full login → config persisted → whoami returns the mocked profile", async (t) => {
  await withTempHome(async (home) => {
    const profile = { id: "u1", username: "tester", display_name: "Tester" };
    let mockUrl = "";
    const routes: Routes = {
      "/auth/cli/device/start": () => ({
        json: {
          deviceCode: "dev",
          userCode: "WXYZ-1234",
          verificationUri: `${mockUrl}/dashboard/cli`,
          verificationUriComplete: `${mockUrl}/dashboard/cli?code=WXYZ-1234`,
          interval: 0,
          expiresIn: 900,
        },
      }),
      "/auth/cli/device/poll": () => ({
        json: { status: "approved", token: "slk_e2e", scopes: ["profile"] },
      }),
      "/auth/cli/exchange": () => ({
        json: { sessionToken: "jwt-e2e", expiresIn: 900, scopes: ["profile"] },
      }),
      "/api/commerce": () => ({ json: profile }),
    };
    const mock = await startMockServer(routes);
    mockUrl = mock.url;
    t.after(() => mock.close());

    const login = await runCli(["login", "--base-url", mock.url, "--json"], { home });
    assert.equal(login.code, 0, `login should exit 0; stderr: ${login.stderr}`);

    const loginLines = lines(login.stdout);
    assert.ok(loginLines.length >= 2, "login should emit a progress line and a final line");
    const progress = JSON.parse(loginLines[0]) as {
      ok: boolean;
      command: string;
      event: string;
      userCode: string;
    };
    assert.equal(progress.ok, true);
    assert.equal(progress.command, "login");
    assert.equal(progress.event, "awaiting_approval");
    assert.equal(progress.userCode, "WXYZ-1234");

    const final = JSON.parse(loginLines[loginLines.length - 1]) as {
      ok: boolean;
      command: string;
      data: { loggedIn: boolean; scopes: string[] };
    };
    assert.equal(final.ok, true);
    assert.equal(final.command, "login");
    assert.equal(final.data.loggedIn, true);

    // Config persisted to the isolated HOME.
    const configPath = join(home, ".rare-profile", "config.json");
    assert.ok(await exists(configPath), "config.json should be written");
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      token: string;
      baseUrl: string;
    };
    assert.equal(config.token, "slk_e2e");
    assert.equal(config.baseUrl, mock.url);

    // whoami against the same HOME returns the mocked profile.
    const whoami = await runCli(["whoami", "--json"], { home });
    assert.equal(whoami.code, 0, `whoami should exit 0; stderr: ${whoami.stderr}`);
    const whoamiLines = lines(whoami.stdout);
    const whoamiFinal = JSON.parse(whoamiLines[whoamiLines.length - 1]) as {
      ok: boolean;
      data: { id: string; username: string };
    };
    assert.equal(whoamiFinal.ok, true);
    assert.equal(whoamiFinal.data.id, "u1");
    assert.equal(whoamiFinal.data.username, "tester");

    // The mock recorded the full path through the real binary.
    const paths = mock.requests.map((r) => r.path);
    assert.ok(paths.includes("/auth/cli/device/start"), "device/start was called");
    assert.ok(paths.includes("/auth/cli/device/poll"), "device/poll was called");
    assert.ok(paths.includes("/auth/cli/exchange"), "exchange was called");
    assert.ok(paths.includes("/api/commerce"), "commerce was called");
  });
});

test("login denied → exit 3 auth_required, no config written", async (t) => {
  await withTempHome(async (home) => {
    let mockUrl = "";
    const routes: Routes = {
      "/auth/cli/device/start": () => ({
        json: {
          deviceCode: "dev",
          userCode: "DENY-0000",
          verificationUri: `${mockUrl}/dashboard/cli`,
          verificationUriComplete: `${mockUrl}/dashboard/cli?code=DENY-0000`,
          interval: 0,
          expiresIn: 900,
        },
      }),
      "/auth/cli/device/poll": () => ({ json: { status: "denied" } }),
    };
    const mock = await startMockServer(routes);
    mockUrl = mock.url;
    t.after(() => mock.close());

    const login = await runCli(["login", "--base-url", mock.url, "--json"], { home });
    assert.equal(login.code, 3, `login denied should exit 3; stderr: ${login.stderr}`);

    const loginLines = lines(login.stdout);
    const final = JSON.parse(loginLines[loginLines.length - 1]) as {
      ok: boolean;
      error: { code: string };
    };
    assert.equal(final.ok, false);
    assert.equal(final.error.code, "auth_required");

    const configPath = join(home, ".rare-profile", "config.json");
    assert.equal(await exists(configPath), false, "no config should be written on denial");
  });
});

test("API error after login → whoami exits 1 api_error", async (t) => {
  await withTempHome(async (home) => {
    const routes: Routes = {
      "/auth/cli/exchange": () => ({
        json: { sessionToken: "jwt-e2e", expiresIn: 900, scopes: ["profile"] },
      }),
      "/api/commerce": () => ({ status: 500, json: { error: "boom" } }),
    };
    const mock = await startMockServer(routes);
    t.after(() => mock.close());

    // Pre-seed config pointing at the mock.
    const dir = join(home, ".rare-profile");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "config.json"),
      JSON.stringify({ token: "slk_x", baseUrl: mock.url }),
      { mode: 0o600 },
    );

    const whoami = await runCli(["whoami", "--json"], { home });
    assert.equal(whoami.code, 1, `whoami api error should exit 1; stderr: ${whoami.stderr}`);
    const whoamiLines = lines(whoami.stdout);
    const final = JSON.parse(whoamiLines[whoamiLines.length - 1]) as {
      ok: boolean;
      error: { code: string };
    };
    assert.equal(final.ok, false);
    assert.equal(final.error.code, "api_error");
  });
});
