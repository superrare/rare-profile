import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from "node:fs";

export interface CliConfig { token: string; baseUrl: string }

export const defaultConfigPath = (): string => join(homedir(), ".rare-profile", "config.json");

export function readConfig(path = defaultConfigPath()): CliConfig | null {
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<CliConfig>;
    if (!parsed.token || !parsed.baseUrl) return null;
    return { token: parsed.token, baseUrl: parsed.baseUrl };
  } catch {
    return null;
  }
}

export function writeConfig(cfg: CliConfig, path = defaultConfigPath()): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600); // ensure mode even if the file pre-existed
}

export function clearConfig(path = defaultConfigPath()): void {
  rmSync(path, { force: true });
}
