import { clearConfig } from "../config.js";

export function runLogout(configPath?: string): { cleared: true } {
  clearConfig(configPath);
  return { cleared: true };
}
