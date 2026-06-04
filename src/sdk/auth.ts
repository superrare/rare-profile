import { ProfileAuthError } from "./errors.js";
import type { CliScope } from "./scopes.js";

export interface AuthOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface DeviceFlow {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  /** Polls until approval; resolves with the raw slk_ PAT, rejects on deny/expire. */
  poll: () => Promise<string>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface Auth {
  startDeviceFlow(input: { label: string; scopes: readonly CliScope[] }): Promise<DeviceFlow>;
  exchange(pat: string): Promise<string>;
}

export function createAuth(opts: AuthOptions): Auth {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, "");

  async function postJson(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { /* leave {} */ }
    return { status: res.status, json };
  }

  return {
    async startDeviceFlow({ label, scopes }) {
      const { status, json } = await postJson("/auth/cli/device/start", { label, scopes });
      if (status !== 200) throw new ProfileAuthError(`device/start failed (${status})`);
      const deviceCode = json.deviceCode as string;
      const intervalMs = Math.max(0, Number(json.interval ?? 5)) * 1000;
      const deadline = Date.now() + Number(json.expiresIn ?? 900) * 1000;
      return {
        userCode: json.userCode as string,
        verificationUri: json.verificationUri as string,
        verificationUriComplete: json.verificationUriComplete as string,
        async poll() {
          while (Date.now() < deadline) {
            const { json: p } = await postJson("/auth/cli/device/poll", { deviceCode });
            if (p.status === "pending") {
              await sleep(intervalMs);
              continue;
            }
            if (p.status === "approved" && p.token) return p.token as string;
            if (p.status === "denied") throw new ProfileAuthError("CLI login denied in browser.");
            if (p.status === "expired") throw new ProfileAuthError("Login code expired. Run login again.");
            throw new ProfileAuthError(`Unexpected poll status: ${String(p.status)}`);
          }
          throw new ProfileAuthError("Login code expired before approval.");
        },
      };
    },
    async exchange(pat) {
      const { status, json } = await postJson("/auth/cli/exchange", { token: pat });
      if (status !== 200 || !json.sessionToken) throw new ProfileAuthError("Token exchange failed. Run `rare-profile login`.");
      return json.sessionToken as string;
    },
  };
}
