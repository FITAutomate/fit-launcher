import { build as bundle } from "esbuild";
import { build } from "vite";
import "./generate-icon.mjs";
await bundle({
  entryPoints: ["src/main/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: "dist/main.cjs",
  sourcemap: true,
});
await bundle({
  entryPoints: ["src/preload/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: "dist/preload.cjs",
});
await build({
  root: "src/renderer",
  base: "./",
  build: { outDir: "../../dist/renderer", emptyOutDir: true },
});
