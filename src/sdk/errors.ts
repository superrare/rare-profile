/** Thrown for any non-2xx API response or a response that fails schema validation. */
export class ProfileApiError extends Error {
  readonly status: number;
  readonly action: string;
  constructor(action: string, status: number, message: string) {
    super(message);
    this.name = "ProfileApiError";
    this.action = action;
    this.status = status;
  }
}

/** Thrown when no usable token exists or token exchange fails. The CLI maps this to exit code 3. */
export class ProfileAuthError extends Error {
  constructor(message = "Not authenticated. Run `rare-profile login`.") {
    super(message);
    this.name = "ProfileAuthError";
  }
}
