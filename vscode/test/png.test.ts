import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { render } from "@mathlabs/mathra";
import { toPng } from "../src/png.ts";

const wasm = () => readFile(createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm"));

test("PNG at a scale, resvg's wasm read once", async () => {
  let reads = 0;
  const counted = () => (reads++, wasm());
  const svg = render("x").svg;
  const one = await toPng(svg, 1, counted);
  const three = await toPng(svg, 3, counted);
  assert.equal(reads, 1);
  const width = (png: Uint8Array) => new DataView(png.buffer, png.byteOffset).getUint32(16);
  assert.deepEqual([...one.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(Math.abs(width(three) - 3 * width(one)) <= 2, true);
});
