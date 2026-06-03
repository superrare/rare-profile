import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig([
  {
    input: { index: "src/sdk/index.ts" },
    output: { dir: "dist", format: "esm" },
    platform: "node",
    plugins: [dts()],
  },
  {
    input: "src/cli/bin.ts",
    output: { file: "dist/bin.js", format: "esm", banner: "#!/usr/bin/env node" },
    platform: "node",
  },
]);
