// The gallery in the package matches the repository's, and every example opens in the editor: read
// and written back it draws the same, and marked as the field draws it, the same as plain.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Editor, classOfTree } from "../src/model.ts";
import { GALLERY } from "../src/gallery.ts";
import { drawing } from "./drawing.ts";
import { render } from "../../npm/pkg/node/index.mjs";

test("src/gallery.ts matches corpus/gallery.json (node scripts/gallery.mjs)", () => {
  const source = JSON.parse(readFileSync(new URL("../../corpus/gallery.json", import.meta.url), "utf8"));
  assert.deepEqual(
    GALLERY.map((g) => [g.id, g.rows.map((r) => [r.name, r.tex, r.input, r.options])]),
    source.map((g: { id: string; rows: { name?: string; tex: string; input?: string; options?: object }[] }) => [g.id, g.rows.map((r) => [r.name ?? "", r.tex, r.input ?? "latex", r.options ?? {}])]),
  );
});

test("every gallery example opens in the editor and draws as it did", () => {
  const problems: string[] = [];
  for (const g of GALLERY)
    for (const r of g.rows) {
      if (r.input !== "latex") continue;
      // the field draws one line (a maximum width is for the outputs): compared without it
      const options = { locale: r.locale };
      const e = new Editor(r.tex);
      e.classifyRaw = (latex) => classOfTree(render(latex).tree);
      e.decimalComma = ["pt-BR", "es", "fr", "de", "it", "ru", "id", "tr", "nl", "pl"].includes(r.locale);
      const original = JSON.stringify(drawing(render(r.tex, options).svg));
      if (JSON.stringify(drawing(render(e.toLatex(), options).svg)) !== original) problems.push(`${r.name || r.caption}: written back as ${e.toLatex().slice(0, 120)}`);
      else if (JSON.stringify(drawing(render(e.toLatex({ marked: true }), options).svg)) !== original) problems.push(`${r.name || r.caption}: marked draws differently`);
    }
  assert.deepEqual(problems, []);
});
