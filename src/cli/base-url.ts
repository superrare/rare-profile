export const DEFAULT_BASE_URL = "https://studio.superrare.com";

const LEGACY_DEFAULT_BASE_URL = "https://beta.rare.xyz";

export interface BaseUrlInputs {
  explicitBaseUrl?: string;
  configuredBaseUrl?: string;
}

/** Resolve CLI base URL precedence and migrate only the retired beta default. */
export function resolveBaseUrl({ explicitBaseUrl, configuredBaseUrl }: BaseUrlInputs): string {
  if (explicitBaseUrl !== undefined) return explicitBaseUrl;
  if (
    configuredBaseUrl === LEGACY_DEFAULT_BASE_URL ||
    configuredBaseUrl === `${LEGACY_DEFAULT_BASE_URL}/`
  ) {
    return DEFAULT_BASE_URL;
  }
  return configuredBaseUrl ?? DEFAULT_BASE_URL;
}
