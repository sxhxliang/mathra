// mathra's SVG as PNG, drawn by resvg (WebAssembly): the npm package leaves rasterizing to a browser,
// and the extension host has none. The equation's glyphs are outlines in the SVG, so no font is needed.

import { initWasm, Resvg } from "@resvg/resvg-wasm";

let ready: Promise<void> | undefined;

/** The SVG as PNG at `scale` times its size, with resvg's wasm read by `wasm` the first time. */
export async function toPng(svg: string, scale: number, wasm: () => Promise<Uint8Array>): Promise<Uint8Array> {
  ready ??= wasm().then((bytes) => initWasm(bytes));
  await ready;
  return new Resvg(svg, { fitTo: { mode: "zoom", value: scale } }).render().asPng();
}
