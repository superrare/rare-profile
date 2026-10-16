import type { ZodType } from "zod";
import { ProfileApiError, ProfileAuthError } from "./errors.js";

export interface TransportOptions {
  baseUrl: string;
  getToken: () => string | null;
  refresh: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface Transport {
  post<T>(action: string, params: object, schema: ZodType<T>): Promise<T>;
  postAction<T>(path: string, action: string, params: object, schema: ZodType<T>): Promise<T>;
  get<T>(path: string, action: string, schema: ZodType<T>): Promise<T>;
  postJson<T>(path: string, action: string, body: object, schema: ZodType<T>): Promise<T>;
  postArchive<T>(
    path: string,
    params: Record<string, string | undefined>,
    bytes: Uint8Array,
    schema: ZodType<T>,
  ): Promise<T>;
}

export function createTransport(opts: TransportOptions): Transport {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = opts.baseUrl.replace(/\/$/, "");

  async function send(path: string, action: string, params: object, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchImpl(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...params }),
    });
  }

  async function sendJson(
    method: "GET" | "POST",
    path: string,
    body: object | undefined,
    token: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  function errorDetails(json: unknown): { message?: string; code?: string } {
    if (!json || typeof json !== "object" || Array.isArray(json) || !("error" in json)) return {};
    const error = json.error;
    if (typeof error === "string") return { message: error };
    if (!error || typeof error !== "object" || Array.isArray(error)) return {};
    const message = "message" in error && typeof error.message === "string" ? error.message : undefined;
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return { message, code };
  }

  async function requestJson<T>(
    sendWithToken: (token: string | null) => Promise<Response>,
    action: string,
    schema: ZodType<T>,
  ): Promise<T> {
    let res = await sendWithToken(opts.getToken());
    if (res.status === 401) {
      res = await sendWithToken(await opts.refresh());
      if (res.status === 401) {
        throw new ProfileAuthError("Authentication failed after token refresh. Run `rare-profile login`.");
      }
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new ProfileApiError(action, res.status, `Non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const detail = errorDetails(json);
      throw new ProfileApiError(action, res.status, detail.message ?? `Request failed (${res.status})`, detail.code);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ProfileApiError(action, res.status, `Unexpected response shape: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async function postAction<T>(path: string, action: string, params: object, schema: ZodType<T>): Promise<T> {
    return requestJson((token) => send(path, action, params, token), action, schema);
  }

  async function get<T>(path: string, action: string, schema: ZodType<T>): Promise<T> {
    return requestJson((token) => sendJson("GET", path, undefined, token), action, schema);
  }

  async function postJson<T>(path: string, action: string, body: object, schema: ZodType<T>): Promise<T> {
    return requestJson((token) => sendJson("POST", path, body, token), action, schema);
  }

  async function postArchive<T>(
    path: string,
    params: Record<string, string | undefined>,
    bytes: Uint8Array,
    schema: ZodType<T>,
  ): Promise<T> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, value);
    }
    const url = `${baseUrl}${path}?${search.toString()}`;
    const sendArchive = (token: string | null) => {
      const headers: Record<string, string> = { "Content-Type": "application/zip" };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetchImpl(url, {
        method: "POST",
        headers,
        body: bytes,
      });
    };

    // Unlike small JSON requests, do not send a potentially large archive just
    // to discover that this fresh CLI process still needs a session exchange.
    let token = opts.getToken();
    if (!token) token = await opts.refresh();

    let res = await sendArchive(token);
    if (res.status === 401) {
      const fresh = await opts.refresh();
      res = await sendArchive(fresh);
      if (res.status === 401) {
        throw new ProfileAuthError("Authentication failed after token refresh. Run `rare-profile login`.");
      }
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new ProfileApiError("app-deploy", res.status, `Non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg = (json as { error?: string })?.error ?? `Request failed (${res.status})`;
      throw new ProfileApiError("app-deploy", res.status, msg);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ProfileApiError("app-deploy", res.status, `Unexpected response shape: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  return {
    post(action, params, schema) {
      return postAction("/api/commerce", action, params, schema);
    },
    postAction,
    get,
    postJson,
    postArchive,
  };
}
