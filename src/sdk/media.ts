// Functional-core helpers for file uploads: pure transformations from raw bytes to the
// base64 request fields the API expects. No I/O — so they're unit-testable in isolation
// and kept out of the domain methods that perform the actual transport call.

/** Base64-encode raw file bytes for transport in a JSON body. */
export function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Assign `key: value` onto `params` only when `value` is defined. */
export function setIfDefined(
  params: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) params[key] = value;
}
