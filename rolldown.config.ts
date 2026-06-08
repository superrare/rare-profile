import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const sdkInput = { index: "src/sdk/index.ts" };

export default defineConfig([
  // SDK — ESM bundle + matching .d.ts (the `import` condition).
  {
    input: sdkInput,
    output: { dir: "dist", format: "esm", entryFileNames: "[name].js" },
    platform: "node",
    plugins: [dts()],
  },
  // SDK — CommonJS bundle (the `require` condition). Types are generated once by
  // the ESM build above (dts can't bundle to cjs); the build copies index.d.ts →
  // index.d.cts since the named-export surface is identical for both module systems.
  {
    input: sdkInput,
    output: { dir: "dist", format: "cjs", entryFileNames: "[name].cjs", exports: "named" },
    platform: "node",
  },
  // CLI executable — self-contained ESM bundle with a shebang.
  {
    input: "src/cli/bin.ts",
    output: { file: "dist/bin.js", format: "esm", banner: "#!/usr/bin/env node" },
    platform: "node",
  },
]);
