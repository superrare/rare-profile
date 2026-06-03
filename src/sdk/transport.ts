import type { ZodType } from "zod";
import { ProfileApiError } from "./errors.js";

export interface TransportOptions {
  baseUrl: string;
  getToken: () => string | null;
  refresh: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface Transport {
  post<T>(action: string, params: Record<string, unknown>, schema: ZodType<T>): Promise<T>;
}

export function createTransport(opts: TransportOptions): Transport {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${opts.baseUrl.replace(/\/$/, "")}/api/commerce`;

  async function send(action: string, params: Record<string, unknown>, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...params }),
    });
  }

  return {
    async post(action, params, schema) {
      let res = await send(action, params, opts.getToken());
      if (res.status === 401) {
        const fresh = await opts.refresh();
        res = await send(action, params, fresh);
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new ProfileApiError(action, res.status, `Non-JSON response: ${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        const msg = (json as { error?: string })?.error ?? `Request failed (${res.status})`;
        throw new ProfileApiError(action, res.status, msg);
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new ProfileApiError(action, res.status, `Unexpected response shape: ${parsed.error.message}`);
      }
      return parsed.data;
    },
  };
}
