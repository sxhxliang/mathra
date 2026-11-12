// Bundles src/ into dist/extension.cjs (CommonJS, as VS Code loads extensions) and the visual editor's
// page into dist/webview.js (a module for the webview), and copies what the package ships besides: the
// wasm, which both bundles load from `../mathra.wasm` (beside dist/), resvg's wasm for PNG, and the
// licenses. Needs npm/pkg and editor/dist built (npm/build.sh, then pnpm build in editor/).
// node build.mjs [--watch]

import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("@mathlabs/mathra/package.json"));
for (const [from, to] of [
  [join(pkg, "mathra.wasm"), "mathra.wasm"],
  [require.resolve("@resvg/resvg-wasm/index_bg.wasm"), "resvg.wasm"],
  [join(pkg, "OFL-STIXTwoMath.txt"), "OFL-STIXTwoMath.txt"],
  ["../LICENSE-MIT", "LICENSE-MIT"],
  ["../LICENSE-APACHE", "LICENSE-APACHE"],
]) {
  copyFileSync(from, to);
}

const watch = process.argv.includes("--watch");
// in watch mode, lines the "mathra: watch" task of .vscode/tasks.json reads: when a build starts and
// ends, and each error with its place
const report = {
  name: "report",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      for (const e of result.errors) console.log(`✘ ${e.location?.file}:${e.location?.line}:${e.location?.column}: ${e.text}`);
      console.log("[watch] build finished");
    });
  },
};

const common = { bundle: true, sourcemap: watch, logLevel: watch ? "silent" : "warning", plugins: watch ? [report] : [] };
const builds = [
  { ...common, entryPoints: ["src/extension.ts"], outfile: "dist/extension.cjs", platform: "node", format: "cjs", target: "node20", external: ["vscode"] },
  // the web build of mathra fetches `new URL("../mathra.wasm", import.meta.url)`, which esbuild keeps
  { ...common, entryPoints: ["src/webview/main.ts"], outfile: "dist/webview.js", platform: "browser", format: "esm", target: "es2022" },
];

if (watch) for (const b of builds) await (await esbuild.context(b)).watch();
else await Promise.all(builds.map((b) => esbuild.build(b)));
