// Renders every formula of target/coverage/formulas.jsonl with KaTeX (and its mhchem extension)
// and writes target/coverage/katex.jsonl: {"id", "ok", "message"} per line.
//
//     node tools/coverage/katex.mjs
//
// KaTeX comes from bench/node_modules (npm install in bench/ first). It is the reference the
// report puts each problem next to: a formula KaTeX renders and mathra does not is a gap of
// mathra; one neither renders is more likely LaTeX outside the standard. KaTeX has no chemfig,
// xymatrix or tikzcd, so on those it fails by design and the report says so.

import { createRequire } from "node:module";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(join(root, "bench", "package.json"));
const katex = require("katex");
require("katex/contrib/mhchem");

const dir = join(root, "target", "coverage");
const out = createWriteStream(join(dir, "katex.jsonl"));
const lines = createInterface({ input: createReadStream(join(dir, "formulas.jsonl")) });
let n = 0, ok = 0;
for await (const line of lines) {
  const f = JSON.parse(line);
  let result;
  try {
    katex.renderToString(f.tex, { displayMode: f.display, throwOnError: true, strict: "ignore", trust: true, maxExpand: 5000 });
    result = { id: f.id, ok: true };
    ok++;
  } catch (e) {
    result = { id: f.id, ok: false, message: String(e.message || e).replace(/^KaTeX parse error: /, "").slice(0, 200) };
  }
  out.write(JSON.stringify(result) + "\n");
  n++;
}
out.end();
console.log(`KaTeX ${katex.version}: ${ok}/${n} rendered`);
