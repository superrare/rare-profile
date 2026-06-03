import { parseArgs } from "./args.js";
import { readConfig, defaultConfigPath } from "./config.js";
import { renderSuccess, renderError, classifyError } from "./output.js";
import { createProfileClient } from "../sdk/index.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { runWhoami } from "./commands/whoami.js";

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

    // Authenticated commands need a token.
    if (!cfg) { throw Object.assign(new Error("Not authenticated. Run `rare-profile login`."), { name: "ProfileAuthError" }); }
    const client = createProfileClient({ baseUrl, token: cfg.token });

    if (command === "whoami") {
      const data = await runWhoami(client);
      process.stdout.write(renderSuccess("whoami", data, { json, human: (d) => `@${(d as { username?: string }).username ?? "?"} (${(d as { id: string }).id})` }) + "\n");
      return;
    }

    // Further commands wired in Task 22.
    throw Object.assign(new Error(`Unknown command: ${command}`), { name: "UsageError" });
  } catch (err) {
    const { shape, exitCode } = classifyError(err);
    process.stdout.write(renderError(command, shape, { json }) + "\n");
    process.exit(exitCode);
  }
}

void main();
