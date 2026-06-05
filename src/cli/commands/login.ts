import { createProfileClient } from "../../sdk/index.js";
import { DEFAULT_CLI_SCOPES } from "../../sdk/scopes.js";
import { writeConfig } from "../config.js";
import { renderEvent } from "../output.js";
import type { ParsedArgs } from "../args.js";

export interface LoginDeps {
  baseUrl: string;
  json: boolean;
  out: (line: string) => void;        // for NDJSON / human progress
  configPath?: string;
  clientFactory?: typeof createProfileClient; // injectable for tests
}

/** Runs the device flow and persists the PAT. Returns the granted scopes. */
export async function runLogin(args: ParsedArgs, deps: LoginDeps): Promise<{ scopes: string[] }> {
  const label = (args.flags.label as string) ?? "rare-profile-cli";
  const factory = deps.clientFactory ?? createProfileClient;
  const client = factory({ baseUrl: deps.baseUrl });
  const flow = await client.auth.startDeviceFlow({ label, scopes: DEFAULT_CLI_SCOPES });

  deps.out(
    renderEvent(
      "login",
      "awaiting_approval",
      { userCode: flow.userCode, verificationUri: flow.verificationUriComplete },
      {
        json: deps.json,
        human: () =>
          `\nApprove this CLI:\n  code: ${flow.userCode}\n  open: ${flow.verificationUriComplete}\n\nWaiting for approval...`,
      },
    ),
  );

  const pat = await flow.poll();
  writeConfig({ token: pat, baseUrl: deps.baseUrl }, deps.configPath);

  // Validate immediately by exchanging.
  client.setToken(pat);
  const jwt = await client.auth.exchange(pat);
  void jwt;
  return { scopes: [...DEFAULT_CLI_SCOPES] };
}
