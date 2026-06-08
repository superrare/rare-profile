import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

export function makeAnalyticsDomain(t: Transport) {
  return {
    /** Get link click analytics. */
    links: () =>
      t.post("link-analytics", {}, AckSchema),

    /** Get page view analytics. */
    pageViews: () =>
      t.post("page-view-analytics", {}, AckSchema),

    /** Get creator-level stats. */
    creatorStats: () =>
      t.post("creator-stats", {}, AckSchema),
  };
}
