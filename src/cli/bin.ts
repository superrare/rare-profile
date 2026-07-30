import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import { parseArgs } from "./args.js";
import { readConfig, defaultConfigPath } from "./config.js";
import { renderSuccess, renderError, classifyError } from "./output.js";
import { createProfileClient } from "../sdk/index.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { dataCommands } from "./commands/index.js";
import { runTokens } from "./commands/tokens.js";
import { runSkill } from "./commands/skill.js";
import { DEFAULT_BASE_URL, resolveBaseUrl } from "./base-url.js";

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    // Deliberate swallow: version display must never crash the CLI. A missing/unreadable
    // package.json only ever degrades `--version` to a placeholder, not a real operation.
    return "0.0.0";
  }
}

// Shown after `help` so AI agents driving this CLI know to install the skill first.
const AGENT_SKILL_HINT =
  "AI agent? Install the usage skill first: run `rare-profile skill` and save it where " +
  "your runtime expects (e.g. `rare-profile skill > .claude/skills/rare-profile-cli/SKILL.md`, " +
  "or `rare-profile skill >> AGENTS.md`). Run `rare-profile skill list` to see what's available.";

/**
 * Command metadata — the single source of truth for `--help`. Each entry becomes a
 * Commander command (so it shows in the Commands list with a description and gets
 * `<cmd> --help`). Subcommands are listed in per-command help text. Actual parsing
 * and dispatch still run through the existing handlers via `dispatch()`, so the
 * JSON/NDJSON contract and exit codes are unchanged.
 */
interface CmdSpec {
  name: string;
  summary: string;
  usage?: string;
  subs?: [string, string][];
}

const COMMAND_SPECS: CmdSpec[] = [
  { name: "login", summary: "Authenticate via the OAuth device flow" },
  { name: "logout", summary: "Clear the stored token" },
  { name: "whoami", summary: "Print the current authenticated profile" },
  {
    name: "profile",
    summary: "View and edit your profile",
    subs: [
      ["show", "Show your profile (or another's with --slug)"],
      ["set", "Update text fields (--bio, --website, --display-name, socials, --theme)"],
      ["set-username", "Change your public handle / URL slug"],
      ["set-avatar", "Upload an avatar image"],
      ["set-banner", "Upload a banner image"],
      ["feature-nft", "Feature an NFT (--chain --contract --token-id)"],
    ],
  },
  {
    name: "link",
    summary: "Manage profile links",
    subs: [
      ["add", "Add a link: link add <title> <url>"],
      ["list", "List links"],
      ["update", "Update a link: link update <id> [--title] [--url]"],
      ["rm", "Remove a link: link rm <id>"],
      ["reorder", "Reorder links: link reorder <id...>"],
    ],
  },
  {
    name: "store",
    summary: "Manage storefronts",
    subs: [
      ["create", "Create a storefront"],
      ["list", "List storefronts"],
      ["get", "Get a storefront by slug"],
      ["update", "Update a storefront"],
    ],
  },
  {
    name: "product",
    summary: "Manage products",
    subs: [
      ["add", "Add a product (--store --title --price [--file])"],
      ["list", "List products"],
      ["edit", "Edit a product"],
      ["unlist", "Unlist a product"],
      ["rm", "Delete a product"],
      ["browse", "Browse products (--filter)"],
    ],
  },
  {
    name: "app",
    summary: "Manage HTML/zip apps sold as products",
    subs: [
      ["deploy", "Deploy an app zip (--store --title --price --zip)"],
      ["update", "Update an app (--zip)"],
      ["token", "Grant an app token"],
    ],
  },
  {
    name: "post",
    summary: "Create and manage posts",
    subs: [
      ["create", "Create a post (--text [--media --media-type])"],
      ["list", "List posts"],
      ["rm", "Delete a post"],
      ["comment", "Comment on a post"],
      ["comments", "List comments on a post"],
    ],
  },
  { name: "follow", summary: "Follow a user", usage: "follow <userId>" },
  { name: "unfollow", summary: "Unfollow a user", usage: "unfollow <userId>" },
  { name: "feed", summary: "Show your activity feed" },
  { name: "followers", summary: "List followers (--user <id>)" },
  { name: "following", summary: "List who you follow (--user <id>)" },
  {
    name: "msg",
    summary: "Direct messages",
    subs: [
      ["send", "Send a DM: msg send <recipientId> <text>"],
      ["inbox", "List conversations"],
      ["read", "Read a thread: msg read <partnerId>"],
      ["find", "Search users: msg find <query>"],
    ],
  },
  {
    name: "stats",
    summary: "Analytics",
    subs: [
      ["links", "Link click stats"],
      ["views", "Page view stats"],
      ["creator", "Creator stats"],
    ],
  },
  {
    name: "events",
    summary: "Notifications",
    subs: [
      ["list", "List events (--unread-only)"],
      ["read", "Mark read: events read --ids <id1>,<id2>"],
    ],
  },
  {
    name: "studio",
    summary: "AI Studio image generation",
    subs: [
      ["image", "Start an image run (--prompt)"],
      ["run", "Poll a run: studio run <runId>"],
      ["runs", "List runs"],
      ["assets", "List generated assets"],
      ["projects", "List projects"],
      ["new-project", "Create a project"],
    ],
  },
  {
    name: "tokens",
    summary: "Manage CLI tokens (opens the dashboard)",
    subs: [
      ["list", "Show the dashboard link"],
      ["revoke", "Show the dashboard link for revoking"],
    ],
  },
  {
    name: "skill",
    summary: "Print an agent skill doc to stdout",
    subs: [["list", "List available skills"]],
  },
  { name: "version", summary: "Output the version number" },
];

function emitVersion(json: boolean): void {
  if (json) {
    process.stdout.write(renderSuccess("version", { version: readVersion() }, { json: true, human: () => "" }) + "\n");
  } else {
    process.stdout.write(readVersion() + "\n");
  }
}

function emitHelpJson(): void {
  const commands = COMMAND_SPECS.map((s) => s.name).concat("help").sort();
  process.stdout.write(
    renderSuccess("help", { commands, agentSkill: AGENT_SKILL_HINT }, { json: true, human: () => "" }) + "\n",
  );
}

/** Run a command through the existing handlers. Driven by process.argv (not Commander's
 * parsed values) so every handler keeps its `{ positionals, flags }` contract. */
async function dispatch(command: string, json: boolean): Promise<void> {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const cfg = readConfig();
  const baseUrl = resolveBaseUrl({
    explicitBaseUrl: flags["base-url"] as string | undefined,
    configuredBaseUrl: cfg?.baseUrl,
  });

  try {
    if (command === "login") {
      const { scopes } = await runLogin({ positionals, flags }, {
        baseUrl, json, out: (l) => process.stdout.write(l + "\n"), configPath: defaultConfigPath(),
      });
      process.stdout.write(renderSuccess("login", { loggedIn: true, scopes }, { json, human: () => "Logged in." }) + "\n");
      return;
    }
    if (command === "logout") {
      const data = runLogout();
      process.stdout.write(renderSuccess("logout", data, { json, human: () => "Logged out." }) + "\n");
      return;
    }
    if (command === "tokens") {
      const result = runTokens(baseUrl, { positionals, flags });
      process.stdout.write(renderSuccess("tokens", result.data, { json, human: result.human }) + "\n");
      return;
    }
    if (command === "skill") {
      const result = runSkill({ positionals, flags });
      process.stdout.write(renderSuccess("skill", result.data, { json, human: result.human }) + "\n");
      return;
    }

    const handler = dataCommands[command];
    if (!handler) {
      throw Object.assign(new Error(`Unknown command: ${command}`), { name: "UsageError" });
    }
    if (!cfg) {
      throw Object.assign(new Error("Not authenticated. Run `rare-profile login`."), { name: "ProfileAuthError" });
    }
    const client = createProfileClient({ baseUrl, token: cfg.token });
    const result = await handler({ client, args: { positionals, flags }, json, baseUrl });
    process.stdout.write(renderSuccess(command, result.data, { json, human: result.human }) + "\n");
  } catch (err) {
    const { shape, exitCode } = classifyError(err);
    process.stdout.write(renderError(command, shape, { json }) + "\n");
    process.exitCode = exitCode;
  }
}

function buildProgram(json: boolean): Command {
  const program = new Command();
  program
    .name("rare-profile")
    .description("Wallet-less CLI for managing a rare.xyz profile")
    .version(readVersion(), "-V, --version", "output the version number")
    .option("--json", "output results as machine-readable JSON (NDJSON)")
    .option("--base-url <url>", `override the API base URL (default: ${DEFAULT_BASE_URL})`)
    .enablePositionalOptions()
    .showSuggestionAfterError(true)
    .configureOutput({ writeErr: () => {} }); // we render usage errors ourselves (JSON/exit code)

  program.addHelpText("after", "\n" + AGENT_SKILL_HINT);

  for (const spec of COMMAND_SPECS) {
    const cmd = program
      .command(spec.name)
      .summary(spec.summary)
      .description(spec.summary)
      .allowUnknownOption(true) // subcommand flags (--bio, --price, …) are parsed by the handler
      .allowExcessArguments(true) // subcommands/operands are read from process.argv by the handler
      .passThroughOptions(true)
      .action(async () => {
        if (spec.name === "version") return emitVersion(json);
        await dispatch(spec.name, json);
      });
    if (spec.usage) cmd.usage(spec.usage.replace(`${spec.name} `, "") + " [options]");
    if (spec.subs) {
      const width = Math.max(...spec.subs.map(([n]) => n.length));
      cmd.addHelpText(
        "after",
        "\nSubcommands:\n" + spec.subs.map(([n, d]) => `  ${n.padEnd(width)}  ${d}`).join("\n"),
      );
    }
  }

  return program;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json") || process.env.RARE_PROFILE_JSON === "1";
  const program = buildProgram(json);

  // --- Pre-handle the cases Commander would format differently than our contract. ---
  // First positional (the command). `--json`/`--base-url <url>` may precede it.
  const positionals = parseArgs(argv).positionals;
  const command = positionals[0];
  // Bare version flag — `rare-profile -V|--version` with no command. Gated on the
  // absence of a command so a trailing `--version` never swallows a real command
  // (e.g. `rare-profile whoami --version` must run whoami, not print the version).
  if (command === undefined && (argv.includes("-V") || argv.includes("--version"))) {
    emitVersion(json);
    return;
  }
  // No command, or the `help`/`help <command>` command: render help our way.
  if (command === undefined || command === "help") {
    if (json) {
      emitHelpJson();
      return;
    }
    const target = command === "help" ? positionals[1] : undefined;
    const sub = target ? program.commands.find((c) => c.name() === target) : undefined;
    (sub ?? program).outputHelp();
    return;
  }

  // --- Everything else goes through Commander (routing, per-command help, errors). ---
  program.exitOverride();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      // Help/version display already printed by Commander → success.
      if (err.exitCode === 0 || err.code.startsWith("commander.help") || err.code === "commander.version") {
        return;
      }
      // Unknown command / option / missing argument → usage error (exit 2).
      const message = err.message.replace(/^error:\s*/i, "");
      process.stdout.write(renderError(command, { code: "usage", message }, { json }) + "\n");
      process.exitCode = 2;
      return;
    }
    throw err;
  }
}

void main().catch((err) => {
  // Last-resort guard: dispatch already catches handler errors, but if anything
  // unexpected escapes (e.g. a Commander-wiring bug), still honor the contract
  // instead of emitting a raw unhandled-rejection stack.
  const json = process.argv.includes("--json") || process.env.RARE_PROFILE_JSON === "1";
  const { shape, exitCode } = classifyError(err);
  process.stdout.write(renderError("error", shape, { json }) + "\n");
  process.exitCode = exitCode;
});
