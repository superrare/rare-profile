import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from "node:fs";

export interface CliConfig { token: string; baseUrl: string }

export const defaultConfigPath = (): string => join(homedir(), ".rare-profile", "config.json");

export function readConfig(path = defaultConfigPath()): CliConfig | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    // No config file yet → not logged in. Any other read failure (permissions,
    // I/O) is a real problem the user should see, not silently treated as "logged out".
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Cannot read config at ${path}: ${(e as Error).message}`, { cause: e });
  }
  let parsed: Partial<CliConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<CliConfig>;
  } catch (e) {
    // A corrupt config must surface, not masquerade as "not logged in" (which would
    // send the user to re-run `login` instead of fixing/clearing the file).
    throw new Error(
      `Config at ${path} is corrupt: ${(e as Error).message}. Run \`rare-profile logout\` to reset, then \`login\`.`,
      { cause: e },
    );
  }
  if (!parsed.token || !parsed.baseUrl) return null;
  return { token: parsed.token, baseUrl: parsed.baseUrl };
}

export function writeConfig(cfg: CliConfig, path = defaultConfigPath()): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600); // ensure mode even if the file pre-existed
}

export function clearConfig(path = defaultConfigPath()): void {
  rmSync(path, { force: true });
}
