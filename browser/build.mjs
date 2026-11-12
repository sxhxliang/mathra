// Builds the extension into extension/, to load unpacked in Chrome or Edge (Developer mode → Load
// unpacked) or to zip for the stores (pnpm zip): the page's script bundled with mathra and the editor (an
// extension may not load code from elsewhere), mathra's wasm beside it, and the icons drawn from
// docs/vscode-icon.svg. Needs npm/pkg and editor/dist built. node build.mjs

import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const require = createRequire(import.meta.url);
const out = "extension";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
cpSync("static", out, { recursive: true });
// the web build of mathra fetches `new URL("../mathra.wasm", import.meta.url)`: beside dist/
copyFileSync(join(dirname(require.resolve("@mathlabs/mathra/package.json")), "mathra.wasm"), join(out, "mathra.wasm"));
const common = { bundle: true, platform: "browser", target: "es2022", logLevel: "warning" };
await esbuild.build({ ...common, entryPoints: ["src/page.ts"], outfile: join(out, "dist/page.js"), format: "esm" });
// the service worker: a classic script, as the manifest declares it
await esbuild.build({ ...common, entryPoints: ["src/background.ts"], outfile: join(out, "background.js"), format: "iife" });

await initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
const icon = readFileSync("../docs/vscode-icon.svg", "utf8");
for (const size of [16, 48, 128]) {
  writeFileSync(join(out, `icon-${size}.png`), new Resvg(icon, { fitTo: { mode: "width", value: size } }).render().asPng());
}
console.log(`${out}/: load it unpacked in chrome://extensions or edge://extensions`);
