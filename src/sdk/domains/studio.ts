import type { Transport } from "../transport.js";
import { AckSchema } from "../types.js";

const STUDIO_PATH = "/api/studio";

export function makeStudioDomain(t: Transport) {
  return {
    /** Start an image generation run (may be async; poll getRun for completion). */
    generateImage(input: {
      prompt: string;
      aspectRatio?: string;
      quality?: string;
      stylePreset?: string;
      count?: number;
      projectId?: string;
    }) {
      return t.postAction(STUDIO_PATH, "create-image-run", input, AckSchema);
    },

    /** Get a single run by ID. */
    getRun(input: { runId: string }) {
      return t.postAction(STUDIO_PATH, "get-run", input, AckSchema);
    },

    /** List runs, optionally filtered by project. */
    listRuns(input: { projectId?: string } = {}) {
      return t.postAction(STUDIO_PATH, "list-runs", input, AckSchema);
    },

    /** List assets, optionally filtered by project. */
    listAssets(input: { projectId?: string } = {}) {
      return t.postAction(STUDIO_PATH, "list-assets", input, AckSchema);
    },

    /** Create a new project. */
    createProject(input: { name: string }) {
      return t.postAction(STUDIO_PATH, "create-project", input, AckSchema);
    },

    /** List all projects. */
    listProjects() {
      return t.postAction(STUDIO_PATH, "list-projects", {}, AckSchema);
    },
  };
}
