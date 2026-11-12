import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

// A bundler drops a module imported only for its effects (`import "./settings.ts"`) unless `sideEffects`
// names it: then its element is never defined, and the editor's panel stays empty.
test("every module that defines an element is listed in sideEffects", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const src = new URL("../src/", import.meta.url);
  const defining = readdirSync(src)
    .filter((f) => f.endsWith(".ts") && readFileSync(new URL(f, src), "utf8").includes("customElements.define"))
    .map((f) => `./dist/${f.replace(/\.ts$/, ".js")}`);
  for (const file of defining) assert.ok(pkg.sideEffects.includes(file), `${file} is missing from sideEffects`);
});
