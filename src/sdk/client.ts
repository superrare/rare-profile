import { createTransport, type Transport } from "./transport.js";
import { createAuth } from "./auth.js";
import { ProfileAuthError } from "./errors.js";
import { makeProfileDomain } from "./domains/profile.js";
import { makeLinksDomain } from "./domains/links.js";
import { makeStorefrontsDomain } from "./domains/storefronts.js";
import { makeProductsDomain } from "./domains/products.js";
import { makeAppsDomain } from "./domains/apps.js";
import { makePostsDomain } from "./domains/posts.js";
import { makeSocialDomain } from "./domains/social.js";

export interface ProfileClientOptions {
  baseUrl: string;
  /** slk_ PAT. Required for API calls; may be omitted when only using `auth` to log in. */
  token?: string;
  fetchImpl?: typeof fetch;
}

export function createProfileClient(opts: ProfileClientOptions) {
  let pat = opts.token ?? null;
  let jwt: string | null = null;

  const auth = createAuth({ baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl });

  const refresh = async (): Promise<string> => {
    if (!pat) throw new ProfileAuthError();
    jwt = await auth.exchange(pat);
    return jwt;
  };

  const transport: Transport = createTransport({
    baseUrl: opts.baseUrl,
    fetchImpl: opts.fetchImpl,
    getToken: () => jwt,
    refresh,
  });

  return {
    auth,
    /** Set/replace the PAT after a login flow. */
    setToken(next: string) { pat = next; jwt = null; },
    profile: makeProfileDomain(transport),
    links: makeLinksDomain(transport),
    storefronts: makeStorefrontsDomain(transport),
    products: makeProductsDomain(transport),
    apps: makeAppsDomain(transport),
    posts: makePostsDomain(transport),
    social: makeSocialDomain(transport),
    // Later domains are spread in here in Tasks 6–14.
  };
}

export type ProfileClient = ReturnType<typeof createProfileClient>;
