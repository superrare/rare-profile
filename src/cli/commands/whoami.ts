import type { ProfileClient } from "../../sdk/index.js";

export async function runWhoami(client: ProfileClient) {
  return client.profile.get();
}
