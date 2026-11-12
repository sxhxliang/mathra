// The extension's images as PNG, from the SVGs mathra draws (`cargo run -p mathra --example banner`):
// media/banner.png from docs/vscode-banner.svg, at twice its size (the Marketplace takes no SVG in a
// README), and media/icon.png from docs/vscode-icon.svg, 256 px square (an extension's icon is a PNG).
// node scripts/banner.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const at = (path) => new URL(path, import.meta.url);
await initWasm(readFileSync(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm")));
for (const [svg, png, width] of [
  ["vscode-banner.svg", "banner.png", 2560],
  ["vscode-icon.svg", "icon.png", 256],
]) {
  const source = readFileSync(at(`../../docs/${svg}`), "utf8");
  writeFileSync(at(`../media/${png}`), new Resvg(source, { fitTo: { mode: "width", value: width } }).render().asPng());
  console.log(`media/${png}`);
}
