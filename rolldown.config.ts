import { defineConfig } from "rolldown";

export default defineConfig([
  {
    input: "src/sdk/index.ts",
    output: { file: "dist/index.js", format: "esm" },
    platform: "node",
  },
  {
    input: "src/cli/bin.ts",
    output: { file: "dist/bin.js", format: "esm", banner: "#!/usr/bin/env node" },
    platform: "node",
  },
]);
