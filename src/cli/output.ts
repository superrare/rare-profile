export interface RenderSuccessOpts { json: boolean; human: (data: unknown) => string }
export interface RenderErrorOpts { json: boolean }
export interface CliErrorShape { code: string; message: string; status?: number }

export function renderSuccess(command: string, data: unknown, opts: RenderSuccessOpts): string {
  if (opts.json) return JSON.stringify({ ok: true, command, data });
  return opts.human(data);
}

export function renderError(command: string, error: CliErrorShape, opts: RenderErrorOpts): string {
  if (opts.json) return JSON.stringify({ ok: false, command, error });
  return `Error: ${error.message}`;
}

/**
 * Render a mid-flight progress event (e.g. login's "awaiting_approval"). Distinct
 * from a final result: the JSON envelope is `{ ok, command, event, ...payload }`.
 * Kept here so every NDJSON line shape lives in one place rather than being
 * hand-built at the call site.
 */
export function renderEvent(
  command: string,
  event: string,
  payload: Record<string, unknown>,
  opts: RenderSuccessOpts,
): string {
  if (opts.json) return JSON.stringify({ ok: true, command, event, ...payload });
  return opts.human(payload);
}

/** Map a thrown error to the CLI error shape + exit code. */
export function classifyError(err: unknown): { shape: CliErrorShape; exitCode: number } {
  const name = (err as { name?: string })?.name;
  const message = err instanceof Error ? err.message : String(err);
  if (name === "UsageError") return { shape: { code: "usage", message }, exitCode: 2 };
  if (name === "ProfileAuthError") return { shape: { code: "auth_required", message }, exitCode: 3 };
  if (name === "ProfileApiError") {
    const status = (err as { status?: number }).status;
    return { shape: { code: "api_error", message, status }, exitCode: 1 };
  }
  return { shape: { code: "error", message }, exitCode: 1 };
}
