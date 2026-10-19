import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { runCli, withTempHome, parseJsonStdout } from "../helpers/cli.js";
import { startMockServer } from "../helpers/mock-server.js";
import { dataCommands } from "../../src/cli/commands/index.js";

async function seedConfig(home: string, baseUrl: string): Promise<void> {
  const dir = join(home, ".rare-profile");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), JSON.stringify({ token: "slk_x", baseUrl }), {
    mode: 0o600,
  });
}

test("version --json → exit 0 and version payload", async () => {
  const r = await runCli(["version", "--json"]);
  assert.equal(r.code, 0);
  const j = parseJsonStdout<{ ok: boolean; command: string; data: { version: string } }>(r);
  assert.equal(j.ok, true);
  assert.equal(j.command, "version");
  assert.equal(typeof j.data.version, "string");
});

test("help --json lists all command groups", async () => {
  const r = await runCli(["help", "--json"]);
  assert.equal(r.code, 0);
  const j = parseJsonStdout<{ data: { commands: string[] } }>(r);
  for (const name of [
    "login",
    "whoami",
    "profile",
    "link",
    "store",
    "product",
    "app",
    "post",
    "follow",
    "msg",
    "stats",
    "events",
    "studio",
    "tokens",
  ]) {
    assert.ok(j.data.commands.includes(name), `help should list ${name}`);
  }
  assert.ok(j.data.commands.includes("skill"), "help should list the skill command");
});

test("help --json lists every dispatchable data command (no drift)", async () => {
  const r = await runCli(["help", "--json"]);
  const j = parseJsonStdout<{ data: { commands: string[] } }>(r);
  for (const name of Object.keys(dataCommands)) {
    assert.ok(j.data.commands.includes(name), `help is missing dispatchable command '${name}'`);
  }
});

test("the built binary dumps the bundled skill (guards the build copy step)", async () => {
  const r = await runCli(["skill"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /# Skill: Using the `rare-profile` CLI/);
  const list = await runCli(["skill", "list", "--json"]);
  const j = parseJsonStdout<{ data: { skills: string[] } }>(list);
  assert.ok(j.data.skills.includes("rare-profile-cli"));
});

test("help points AI agents at the skill (json + human)", async () => {
  const j = await runCli(["help", "--json"]);
  const parsed = parseJsonStdout<{ data: { agentSkill: string } }>(j);
  assert.match(parsed.data.agentSkill, /rare-profile skill/);

  const human = await runCli(["help"]);
  assert.equal(human.code, 0);
  assert.match(human.stdout, /rare-profile skill/);
});

test("--version / -V flags print the version (Commander convention)", async () => {
  for (const flag of ["--version", "-V"]) {
    const r = await runCli([flag]);
    assert.equal(r.code, 0, `${flag} should exit 0`);
    assert.match(r.stdout, /^\d+\.\d+\.\d+/, `${flag} should print a semver`);
  }
});

test("--help / -h show conventional usage with options and commands", async () => {
  for (const flag of ["--help", "-h"]) {
    const r = await runCli([flag]);
    assert.equal(r.code, 0, `${flag} should exit 0`);
    assert.match(r.stdout, /Usage: rare-profile \[options\] \[command\]/);
    assert.match(r.stdout, /Options:/);
    assert.match(r.stdout, /Commands:/);
    assert.match(r.stdout, /rare-profile skill/); // agent hint preserved
  }
});

test("a trailing --version does NOT swallow the command", async () => {
  await withTempHome(async (home) => {
    // `whoami --version` must run whoami (auth error → exit 3), not print the version.
    const r = await runCli(["whoami", "--version"], { home });
    assert.equal(r.code, 3, "should dispatch whoami, not emit version");
    assert.doesNotMatch(r.stdout, /^\d+\.\d+\.\d+\s*$/m, "must not print a bare version");
    assert.match(r.stdout + r.stderr, /Not authenticated/);
  });
});

test("per-command help lists subcommands", async () => {
  const r = await runCli(["profile", "--help"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /Usage: rare-profile profile/);
  assert.match(r.stdout, /Subcommands:/);
  assert.match(r.stdout, /set-username/);
});

test("tokens list --json points at the dashboard", async () => {
  const r = await runCli(["tokens", "list", "--json"]);
  assert.equal(r.code, 0);
  const j = parseJsonStdout<{ data: { manageUrl: string } }>(r);
  assert.equal(j.data.manageUrl, "https://studio.superrare.com/dashboard/cli");
});

test("tokens migrates the exact legacy configured base URL", async () => {
  for (const legacyBaseUrl of ["https://beta.rare.xyz", "https://beta.rare.xyz/"]) {
    await withTempHome(async (home) => {
      await seedConfig(home, legacyBaseUrl);
      const r = await runCli(["tokens", "--json"], { home });
      const j = parseJsonStdout<{ data: { manageUrl: string } }>(r);
      assert.equal(j.data.manageUrl, "https://studio.superrare.com/dashboard/cli");
    });
  }
});

test("tokens gives explicit --base-url precedence over legacy config", async () => {
  await withTempHome(async (home) => {
    await seedConfig(home, "https://beta.rare.xyz");
    const r = await runCli(["tokens", "--base-url", "https://override.example", "--json"], {
      home,
    });
    const j = parseJsonStdout<{ data: { manageUrl: string } }>(r);
    assert.equal(j.data.manageUrl, "https://override.example/dashboard/cli");
  });
});

test("tokens preserves an arbitrary configured base URL", async () => {
  await withTempHome(async (home) => {
    await seedConfig(home, "https://custom.example/api/");
    const r = await runCli(["tokens", "--json"], { home });
    const j = parseJsonStdout<{ data: { manageUrl: string } }>(r);
    assert.equal(j.data.manageUrl, "https://custom.example/api/dashboard/cli");
  });
});

test("unknown command → exit 2 usage error", async () => {
  const r = await runCli(["bogus", "--json"]);
  assert.equal(r.code, 2);
  const j = parseJsonStdout<{ ok: boolean; error: { code: string } }>(r);
  assert.equal(j.ok, false);
  assert.equal(j.error.code, "usage");
});

test("authenticated command without login → exit 3 auth_required (JSON)", async () => {
  await withTempHome(async (home) => {
    const r = await runCli(["whoami", "--json"], { home });
    assert.equal(r.code, 3);
    const j = parseJsonStdout<{ error: { code: string } }>(r);
    assert.equal(j.error.code, "auth_required");
  });
});

test("authenticated command without login → exit 3 (human output)", async () => {
  await withTempHome(async (home) => {
    const r = await runCli(["whoami"], { home });
    assert.equal(r.code, 3);
    assert.match(r.stdout + r.stderr, /Not authenticated/);
  });
});

test("app deploy streams the ZIP bytes to the dedicated endpoint", async () => {
  const server = await startMockServer({
    "/auth/cli/exchange": () => ({ json: { sessionToken: "jwt-1" } }),
    "/api/app-deploy": () => ({ json: { id: "app-1" } }),
  });
  try {
    await withTempHome(async (home) => {
      await seedConfig(home, server.url);
      const zipPath = join(home, "app.zip");
      const archive = Buffer.from(zipSync({ "index.html": strToU8("<html></html>") }));
      await writeFile(zipPath, archive);

      const result = await runCli(
        [
          "app",
          "deploy",
          "--store",
          "store 1",
          "--title",
          "Interactive Garden",
          "--price",
          "0",
          "--entry",
          "index.html",
          "--zip",
          zipPath,
          "--json",
        ],
        { home },
      );

      assert.equal(result.code, 0, result.stderr);
      assert.equal(parseJsonStdout<{ data: { id: string } }>(result).data.id, "app-1");
      const uploads = server.requests.filter((request) => request.path === "/api/app-deploy");
      assert.equal(uploads.length, 1, "expected the ZIP to be uploaded only once");
      const upload = uploads[0];
      assert.ok(upload, "expected an app deploy request");
      assert.deepEqual(upload.rawBody, archive);
      assert.equal(upload.headers["content-type"], "application/zip");
      assert.equal(upload.headers.authorization, "Bearer jwt-1");
      const query = new URL(upload.url, server.url).searchParams;
      assert.equal(query.get("storefrontId"), "store 1");
      assert.equal(query.get("title"), "Interactive Garden");
      assert.equal(query.get("price"), "0");
      assert.equal(query.get("entryPoint"), "index.html");
    });
  } finally {
    await server.close();
  }
});

test("app update registers the deployed verifier and activates its scoring event", async () => {
  let activeReads = 0;
  const server = await startMockServer({
    "/auth/cli/exchange": () => ({ json: { sessionToken: "jwt-1" } }),
    "/api/commerce": (body) => {
      if (body.action === "update-app") return { json: { updated: true } };
      if (body.action === "my-products") {
        return { json: { products: [{ id: "app-1", current_deployment_id: "deployment-2" }] } };
      }
      return { status: 400, json: { error: `unexpected action ${String(body.action)}` } };
    },
    "/api/v1/games/app-1/scoring/active-event": (_body, request) => {
      if (!request.headers.authorization) {
        return { status: 401, json: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } } };
      }
      activeReads += 1;
      return activeReads === 1
        ? { status: 404, json: { error: { code: "GAME_NOT_FOUND", message: "No active scoring event for this deployment" } } }
        : { json: { version: "1", eventId: "event-1" } };
    },
    "/api/v1/games/app-1/scoring/versions": (body) => ({
      json: { version: "1", verifierVersion: { id: "verifier-1", conformance_status: "passed", deploymentId: body.deploymentId } },
    }),
    "/api/v1/games/app-1/scoring/events": (body) => ({
      json: { version: "1", event: { id: "event-1", verifierVersionId: body.verifierVersionId } },
    }),
  });
  try {
    await withTempHome(async (home) => {
      await seedConfig(home, server.url);
      const zipPath = join(home, "game.zip");
      const archive = Buffer.from(zipSync({
        "server-verifier.js": strToU8("export function createRun() { return {}; }"),
        "scoring-config.json": strToU8(JSON.stringify({ game: "hopper", maxTicks: 1400 })),
      }));
      await writeFile(zipPath, archive);
      const result = await runCli([
        "app", "update", "app-1", "--zip", zipPath, "--max-attempts", "20", "--json",
      ], { home });
      assert.equal(result.code, 0, result.stderr || result.stdout);
      const output = parseJsonStdout<{ data: { scoring: { eventId: string; verifierVersionId: string } } }>(result);
      assert.equal(output.data.scoring.eventId, "event-1");
      assert.equal(output.data.scoring.verifierVersionId, "verifier-1");
      const scoringRequests = server.requests.filter((request) => request.path.includes("/scoring/"));
      assert.deepEqual(scoringRequests.map(({ method, path }) => [method, path]), [
        ["GET", "/api/v1/games/app-1/scoring/active-event"],
        ["GET", "/api/v1/games/app-1/scoring/active-event"],
        ["POST", "/api/v1/games/app-1/scoring/versions"],
        ["POST", "/api/v1/games/app-1/scoring/events"],
        ["GET", "/api/v1/games/app-1/scoring/active-event"],
      ]);
      assert.deepEqual(scoringRequests[2]?.body, {
        deploymentId: "deployment-2",
        config: { game: "hopper", maxTicks: 1400 },
      });
      assert.deepEqual(scoringRequests[3]?.body, {
        verifierVersionId: "verifier-1",
        maxAttempts: 20,
        authPolicy: "authenticated",
      });
      assert.equal(scoringRequests[0]?.headers.authorization, undefined);
      assert.deepEqual(
        scoringRequests.slice(1).map((request) => request.headers.authorization),
        Array.from({ length: 4 }, () => "Bearer jwt-1"),
      );
    });
  } finally {
    await server.close();
  }
});

test("RARE_PROFILE_JSON=1 forces JSON without the flag", async () => {
  await withTempHome(async (home) => {
    const r = await runCli(["whoami"], { home, env: { RARE_PROFILE_JSON: "1" } });
    assert.equal(r.code, 3);
    const j = parseJsonStdout<{ ok: boolean }>(r);
    assert.equal(j.ok, false);
  });
});

test("credit group setup returns builder configuration through the CLI", async () => {
  const groupId = "group-1";
  const appId = "app-1";
  const group = {
    id: groupId, slug: "arcade", displayName: "Arcade", chainId: 8453,
    currency: "USDC", tokenAddress: "0x2222222222222222222222222222222222222222",
    treasuryAddress: "0x1111111111111111111111111111111111111111",
    packPriceAtomic: "9007199254740993123456789", packCredits: 20,
    purchasesPaused: true, newUsesPaused: false, paymentConfigId: "payment-1",
    apps: [{ productId: appId, origin: "https://game.example", creditCost: 3 }],
  };
  const server = await startMockServer({
    "/auth/cli/exchange": () => ({ json: { sessionToken: "jwt-1" } }),
    "/api/commerce": (body) => {
      switch (body.action) {
        case "create-credit-group": return { status: 201, json: { group } };
        case "add-credit-group-app": return { json: { groupId, app: group.apps[0] } };
        case "list-credit-groups": return { json: { groups: [{ id: groupId, slug: group.slug, displayName: group.displayName, chainId: group.chainId, apps: group.apps }] } };
        case "get-credit-group": return { json: { group } };
        default: return { status: 400, json: { error: "unexpected action" } };
      }
    },
  });
  try {
    await withTempHome(async (home) => {
      await seedConfig(home, server.url);
      const invoke = async (args: string[]) => {
        const result = await runCli([...args, "--json"], { home });
        assert.equal(result.code, 0, result.stderr || result.stdout);
        return parseJsonStdout<{ data: Record<string, unknown> }>(result).data;
      };
      const created = await invoke([
        "credit-group", "create", "--slug", "arcade", "--name", "Arcade", "--chain-id", "8453",
        "--treasury", group.treasuryAddress, "--currency", "USDC", "--token-address", group.tokenAddress,
        "--pack-price-atomic", group.packPriceAtomic, "--pack-credits", "20",
      ]);
      assert.equal((created.group as typeof group).id, groupId);
      const attached = await invoke(["credit-group", "add-game", groupId, "--app", appId, "--origin", "https://game.example", "--credits", "3"]);
      assert.equal((attached.app as typeof group.apps[0]).productId, appId);
      const listed = await invoke(["credit-group", "list", "--app", appId]);
      assert.equal((listed.groups as Array<{ id: string }>)[0]?.id, groupId);
      const configured = await invoke(["credit-group", "get", groupId]);
      assert.equal((configured.group as typeof group).apps[0]?.productId, appId);
      assert.equal((configured.group as typeof group).packPriceAtomic, group.packPriceAtomic);
      const commerceRequests = server.requests.filter((request) => request.path === "/api/commerce");
      const actions = commerceRequests.map((request) => request.body.action);
      assert.deepEqual(actions, ["create-credit-group", "add-credit-group-app", "list-credit-groups", "get-credit-group"]);
      assert.equal(commerceRequests[1]?.body.appId, appId);
      assert.equal(commerceRequests[1]?.body.origin, "https://game.example");
    });
  } finally {
    await server.close();
  }
});

test("operator grant CLI returns stable JSON/human receipts and conventional usage/API errors", async () => {
  const groupId = "11111111-1111-4111-8111-111111111111";
  const address = `0x${"ab".repeat(20)}`;
  const grant = {
    id: "22222222-2222-4222-8222-222222222222", groupId,
    accountId: "33333333-3333-4333-8333-333333333333", address, credits: 3,
    operatorProfileId: "44444444-4444-4444-8444-444444444444",
    idempotencyKey: "campaign-wallet-001", reason: "Campaign allocation", createdAt: "2026-10-19T09:00:00.000Z",
  };
  let conflict = false;
  const server = await startMockServer({
    "/auth/cli/exchange": () => ({ json: { sessionToken: "jwt-1" } }),
    "/api/commerce": (body) => {
      assert.deepEqual(body, { action: "grant-credit-group-credits", groupId, address, credits: 3, idempotencyKey: grant.idempotencyKey, reason: grant.reason });
      return conflict ? { status: 409, json: { error: "Idempotency conflict" } } : { json: { grant } };
    },
  });
  try {
    await withTempHome(async (home) => {
      await seedConfig(home, server.url);
      const args = ["credit-group", "grant", groupId, "--address", address, "--credits", "3", "--idempotency-key", grant.idempotencyKey, "--reason", " Campaign allocation "];
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await runCli([...args, "--json"], { home });
        assert.equal(result.code, 0, result.stderr || result.stdout);
        const receipt = parseJsonStdout<{ ok: boolean; data: { grant: typeof grant } }>(result);
        assert.equal(receipt.ok, true);
        assert.deepEqual(receipt.data, { grant });
      }
      const human = await runCli(args, { home });
      assert.equal(human.code, 0);
      assert.match(human.stdout, /Granted 3 credits.*Receipt: 22222222.*key: campaign-wallet-001/);
      const beforeInvalid = server.requests.length;
      const invalid = await runCli(["credit-group", "grant", groupId, "--address", address, "--credits", "1.5", "--json"], { home });
      assert.equal(invalid.code, 2);
      assert.equal(parseJsonStdout<{ ok: boolean }>(invalid).ok, false);
      assert.equal(server.requests.length, beforeInvalid);
      conflict = true;
      const rejected = await runCli([...args, "--json"], { home });
      assert.equal(rejected.code, 1);
      const error = parseJsonStdout<{ ok: boolean; error: { status: number; message: string } }>(rejected);
      assert.equal(error.ok, false);
      assert.equal(error.error.status, 409);
      assert.match(error.error.message, /Idempotency conflict/);
    });
  } finally { await server.close(); }
});

test("operator usage CLI preserves exact totals, cursor pages, human semantics and error exit codes", async () => {
  const groupId = "11111111-1111-4111-8111-111111111111";
  const appId = "22222222-2222-4222-8222-222222222222";
  const from = "2026-10-19T00:00:00.000Z";
  const to = "2026-10-26T00:00:00.000Z";
  const totals = { capturedPlays: "9007199254740993", creditsConsumed: "27021597764222979", completedPlays: "1" };
  let missing = false;
  const server = await startMockServer({
    "/auth/cli/exchange": () => ({ json: { sessionToken: "jwt-1" } }),
    "/api/commerce": (body) => {
      assert.equal(body.action, "get-credit-group-usage");
      assert.equal(body.groupId, groupId);
      assert.equal(body.from, from);
      assert.equal(body.to, to);
      assert.equal(body.limit, 1);
      if (missing) return { status: 404, json: { error: "Group not found" } };
      if (body.afterAppId !== undefined) {
        assert.equal(body.afterAppId, appId);
        return { json: { groupId, from, to, totals, games: [], page: { hasMore: false, nextCursor: null } } };
      }
      return { json: { groupId, from, to, totals, games: [{ appId, title: "Arcade", capturedPlays: "2", creditsConsumed: "6", completedPlays: "1" }], page: { hasMore: true, nextCursor: appId } } };
    },
  });
  try {
    await withTempHome(async (home) => {
      await seedConfig(home, server.url);
      const args = ["credit-group", "usage", groupId, "--from", "2026-10-19T05:30:00+05:30", "--to", to, "--limit", "1"];
      const first = await runCli([...args, "--json"], { home });
      assert.equal(first.code, 0, first.stderr || first.stdout);
      const payload = parseJsonStdout<{ ok: boolean; command: string; data: { totals: typeof totals; page: { hasMore: boolean; nextCursor: string | null } } }>(first);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "credit-group");
      assert.deepEqual(payload.data.totals, totals);
      assert.deepEqual(payload.data.page, { hasMore: true, nextCursor: appId });
      assert.equal(server.requests.filter((request) => request.path === "/api/commerce").length, 1);
      const human = await runCli(args, { home });
      assert.equal(human.code, 0);
      assert.match(human.stdout, /Whole interval totals: capturedPlays: 9007199254740993/);
      assert.match(human.stdout, /Current page: 1 games/);
      assert.match(human.stdout, /use --after 22222222/);
      assert.match(human.stdout, /Completed counts reflect current completion status/);
      const empty = await runCli([...args, "--after", appId, "--json"], { home });
      assert.equal(empty.code, 0);
      assert.deepEqual(parseJsonStdout<{ data: { totals: typeof totals; games: unknown[]; page: { hasMore: boolean; nextCursor: null } } }>(empty).data, {
        groupId, from, to, totals, games: [], page: { hasMore: false, nextCursor: null },
      });
      const emptyHuman = await runCli([...args, "--after", appId], { home });
      assert.equal(emptyHuman.code, 0);
      assert.match(emptyHuman.stdout, /Current page: 0 games/);
      assert.match(emptyHuman.stdout, /hasMore: false; nextCursor: none/);
      const beforeInvalid = server.requests.length;
      const invalid = await runCli(["credit-group", "usage", groupId, "--from", "2026-10-19", "--to", to, "--json"], { home });
      assert.equal(invalid.code, 2);
      assert.equal(parseJsonStdout<{ ok: boolean }>(invalid).ok, false);
      assert.equal(server.requests.length, beforeInvalid);
      missing = true;
      const rejected = await runCli([...args, "--json"], { home });
      assert.equal(rejected.code, 1);
      const error = parseJsonStdout<{ ok: boolean; error: { status: number; message: string } }>(rejected);
      assert.equal(error.ok, false);
      assert.equal(error.error.status, 404);
      assert.equal(error.error.message, "Group not found");
      const help = await runCli(["help", "credit-group"], { home });
      assert.equal(help.code, 0);
      assert.match(help.stdout, /usage.*--from RFC3339 --to RFC3339/);
    });
  } finally { await server.close(); }
});
