// The editor's coverage: every line and function of src/, run by the unit tests (node) or by the browser
// test (Chromium), taken together. node scripts/coverage.mjs [--fail-under 100]
// Needs what both need: npm/pkg built (and editor/dist for the gallery's import). Both runs give V8's
// block coverage over the same text (node strips the types in place, and the browser test serves the
// sources stripped the same way), so a character ran if either run says so. A line counts when it has
// code; it is uncovered when none of its code ran, partial when some of it did not.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("..", import.meta.url));
const src = join(here, "src");
const floor = process.argv.includes("--fail-under") ? Number(process.argv[process.argv.indexOf("--fail-under") + 1]) : null;
const dir = mkdtempSync(join(tmpdir(), "editor-coverage-"));

const run = (args, env) => {
  const r = spawnSync(process.execPath, args, { cwd: here, env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) {
    console.error(`node ${args.join(" ")} failed`);
    process.exit(1);
  }
};
const tests = readdirSync(join(here, "test")).filter((f) => f.endsWith(".test.ts")).map((f) => join("test", f));
run(["--test", ...tests], { NODE_V8_COVERAGE: join(dir, "node") });
run(["--no-warnings", "test/browser.mjs"], { COVERAGE: join(dir, "browser.json") });

// every script V8 saw, by the source file it is
const scripts = [];
for (const f of readdirSync(join(dir, "node"))) {
  for (const s of JSON.parse(readFileSync(join(dir, "node", f), "utf8")).result) {
    if (s.url.startsWith(`file://${src}/`)) scripts.push({ file: basename(s.url), functions: s.functions });
  }
}
for (const s of JSON.parse(readFileSync(join(dir, "browser.json"), "utf8"))) {
  const m = /\/editor\/dist\/([\w-]+)\.(?:js|ts)$/.exec(s.url);
  if (m) scripts.push({ file: `${m[1]}.ts`, functions: s.functions });
}
rmSync(dir, { recursive: true, force: true });

const files = readdirSync(src).filter((f) => f.endsWith(".ts")).sort();
const rows = [];
let lines = 0;
let hit = 0;
let fns = 0;
let fnsHit = 0;
for (const file of files) {
  const text = readFileSync(join(src, file), "utf8");
  const ran = new Uint8Array(text.length);
  const fnRan = new Map();
  for (const s of scripts.filter((x) => x.file === file)) {
    // the innermost range decides: the widest first, the narrower over them
    const counts = new Int32Array(text.length).fill(-1);
    const ranges = s.functions.flatMap((f) => f.ranges).sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset));
    for (const r of ranges) counts.fill(r.count, r.startOffset, Math.min(r.endOffset, text.length));
    for (let i = 0; i < text.length; i++) if (counts[i] > 0) ran[i] = 1;
    for (const f of s.functions) {
      if (!f.functionName && f.ranges[0].startOffset === 0) continue;
      const key = f.ranges[0].startOffset;
      fnRan.set(key, (fnRan.get(key) ?? false) || f.ranges[0].count > 0);
    }
  }
  const missed = [];
  const partial = [];
  let at = 0;
  let fileLines = 0;
  for (const [n, line] of text.split("\n").entries()) {
    const code = line.replace(/\/\/.*$/, "");
    const t = code.trim();
    if (t && !t.startsWith("*") && !t.startsWith("/*")) {
      let some = false;
      let all = true;
      for (let i = 0; i < code.length; i++) {
        if (/\s/.test(code[i])) continue;
        if (ran[at + i]) some = true;
        else all = false;
      }
      fileLines++;
      if (!some) missed.push(n + 1);
      else if (!all) partial.push(n + 1);
    }
    at += line.length + 1;
  }
  const f = [...fnRan.values()];
  lines += fileLines;
  hit += fileLines - missed.length;
  fns += f.length;
  fnsHit += f.filter(Boolean).length;
  rows.push({ file, lines: fileLines, missed, partial, fns: f.length, fnsMissed: f.filter((x) => !x).length });
}

const ranges = (ns) => {
  const out = [];
  for (const n of ns) {
    const last = out.at(-1);
    if (last && last[1] === n - 1) last[1] = n;
    else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(" ");
};
const pct = (a, b) => (b ? (100 * a) / b : 100).toFixed(2).padStart(6);
console.log("file              lines %  funcs %  uncovered lines");
for (const r of rows) console.log(`${r.file.padEnd(17)} ${pct(r.lines - r.missed.length, r.lines)}   ${pct(r.fns - r.fnsMissed, r.fns)}  ${ranges(r.missed)}`);
console.log(`${"all".padEnd(17)} ${pct(hit, lines)}   ${pct(fnsHit, fns)}`);
const partly = rows.filter((r) => r.partial.length);
if (partly.length) console.log(`\npartly run (a branch on the line did not): ${partly.map((r) => `${r.file} ${ranges(r.partial)}`).join("; ")}`);
if (floor !== null && ((100 * hit) / lines < floor || (100 * fnsHit) / fns < floor)) process.exit(1);
