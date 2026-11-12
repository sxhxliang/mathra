// Every button of every palette: its drawing and what it inserts convert without a warning, and
// what it inserts, marked as the field draws it, draws the same as plain.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor } from "../src/model.ts";
import { PALETTES, previewLatex, searchPalettes } from "../src/sets.ts";
import { drawing } from "./drawing.ts";
import { render } from "../../npm/pkg/node/index.mjs";

test("every palette button draws and inserts cleanly", () => {
  const problems: string[] = [];
  let n = 0;
  for (const set of PALETTES)
    for (const item of set.items) {
      const name = `${set.id}: ${typeof item.title === "string" ? item.title : item.title.en}`;
      const p = render(previewLatex(item));
      if (p.warnings.length) problems.push(`${name}: preview ${p.warnings[0].description}`);
      if (item.insert === undefined) continue;
      n++;
      const e = new Editor();
      e.insertLatex(item.insert, { autoDelimiters: true });
      // the cursor out of it: inside, empty places show (an arrow's conditions) that the plain LaTeX has not
      e.setCursor({ row: e.root, offset: e.root.children.length });
      const plain = e.toLatex();
      const r = render(plain);
      if (r.warnings.length) problems.push(`${name}: ${plain} ${r.warnings[0].description}`);
      const marked = render(e.toLatex({ marked: true }));
      if (marked.warnings.length) problems.push(`${name}: marked ${marked.warnings[0].description}`);
      else if (plain && JSON.stringify(drawing(marked.svg)) !== JSON.stringify(drawing(render(e.toLatex()).svg))) {
        // an empty place is drawn only when marked; compare once something fills it
        const filled = new Editor();
        filled.insertLatex(item.insert.replace(/#[?0]/g, "x"), { autoDelimiters: true });
        if (JSON.stringify(drawing(render(filled.toLatex({ marked: true })).svg)) !== JSON.stringify(drawing(render(filled.toLatex()).svg))) problems.push(`${name}: marked draws differently (${filled.toLatex()})`);
      }
    }
  assert.deepEqual(problems, []);
  assert.ok(n > 350, `only ${n} buttons insert something`);
});

test("search finds buttons by name in either language and by command", () => {
  assert.ok(searchPalettes("integral").length >= 4);
  assert.ok(searchPalettes("fração").some((i) => i.insert === "\\frac{#0}{#?}"));
  assert.ok(searchPalettes("fracao").length > 0, "accents are ignored");
  assert.ok(searchPalettes("\\alpha").some((i) => i.insert === "\\alpha"));
});
