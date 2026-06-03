import { readFileSync } from "node:fs";
import { parseArgs } from "./args.js";
import { readConfig, defaultConfigPath } from "./config.js";
import { renderSuccess, renderError, classifyError } from "./output.js";
import { createProfileClient } from "../sdk/index.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { dataCommands } from "./commands/index.js";
import { runTokens } from "./commands/tokens.js";

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function listCommandNames(): string[] {
  return ["login", "logout", "whoami", "tokens", "version", "help", ...Object.keys(dataCommands)]
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
}

const DEFAULT_BASE_URL = "https://rare.xyz";

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const json = flags.json === true || process.env.RARE_PROFILE_JSON === "1";
  const command = positionals[0] ?? "help";
  const cfg = readConfig();
  const baseUrl = (flags["base-url"] as string) ?? cfg?.baseUrl ?? DEFAULT_BASE_URL;

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
    if (command === "version") {
      const version = readVersion();
      process.stdout.write(renderSuccess("version", { version }, { json, human: (d) => (d as { version: string }).version }) + "\n");
      return;
    }
    if (command === "help" || command === undefined) {
      const data = { commands: listCommandNames() };
      process.stdout.write(renderSuccess("help", data, { json, human: (d) => "rare-profile commands:\n  " + (d as { commands: string[] }).commands.join("\n  ") }) + "\n");
      return;
    }

    const handler = dataCommands[command];
    if (!handler) {
      throw Object.assign(new Error(`Unknown command: ${command}`), { name: "UsageError" });
    }
    if (!cfg) { throw Object.assign(new Error("Not authenticated. Run `rare-profile login`."), { name: "ProfileAuthError" }); }
    const client = createProfileClient({ baseUrl, token: cfg.token });
    const result = await handler({ client, args: { positionals, flags }, json, baseUrl });
    process.stdout.write(renderSuccess(command, result.data, { json, human: result.human }) + "\n");
    return;
  } catch (err) {
    const { shape, exitCode } = classifyError(err);
    process.stdout.write(renderError(command, shape, { json }) + "\n");
    process.exit(exitCode);
  }
}

void main();
