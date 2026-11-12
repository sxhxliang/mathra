// Schemes (chemfig's \schemestart) edited as pieces: structures, arrows with conditions, +.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Reaction } from "../src/model.ts";
import { drawing } from "./drawing.ts";
import { render } from "../../npm/pkg/node/index.mjs";

const editor = (latex = "") => {
  const e = new Editor();
  e.parseChem = (l) => render(l).tree;
  if (latex) e.setLatex(latex);
  return e;
};
const schemeOf = (e: Editor) => e.root.children.find((a) => a.kind === "reaction") as Reaction;
const same = (a: string, b: string) => JSON.stringify(drawing(render(a).svg)) === JSON.stringify(drawing(render(b).svg));

test("a scheme reads into pieces; written back and marked, it draws the same", () => {
  for (const src of ["\\schemestart \\chemfig{A-B} \\arrow{->[heat][cat]} \\chemfig{C=D} \\+ \\chemfig{E} \\schemestop", "\\schemestart \\chemfig{*6(-=-=-=)} \\arrow \\chemfig{*6(-=-=(-NO_2)-=)} \\schemestop", "\\schemestart \\chemfig{A}\\arrow{<=>}\\chemfig{B}\\schemestop"]) {
    const e = editor(src);
    const s = schemeOf(e);
    assert.ok(s?.scheme, src);
    assert.ok(same(src, e.toLatex()), `written back ${e.toLatex()}`);
    assert.ok(same(src, e.toLatex({ marked: true })), `marked ${src}`);
  }
  // what the editor cannot take apart (an arrow with a name, a coefficient, \\ce) is a piece as written:
  // the rest is still pieces, and it draws the same
  for (const src of ["\\schemestart \\chemfig{A} \\arrow(a--b){->} \\chemfig{B} \\schemestop", "\\schemestart 3\\,\\chemfig{A} \\+ \\ce{HNO3} \\arrow{-U>[x][y]} \\chemfig{B} \\schemestop", "\\schemestart \\chemfig{A} \\arrow{->[a]}[-90] \\chemfig{B} \\arrow{->[a]b} \\chemfig{C} \\schemestop"]) {
    const e = editor(src);
    assert.equal(e.root.children[0].kind, "reaction", src);
    assert.ok(same(src, e.toLatex()), `written back ${e.toLatex()}`);
    assert.ok(same(src, e.toLatex({ marked: true })), `marked ${src}`);
  }
});

test("\\schemestart typed: a structure picked; a space leaves it, -> an arrow, [ its conditions, a letter the next structure", () => {
  const e = editor();
  e.typeText("\\schemestart ");
  assert.ok(e.chemSelection());
  e.typeText("A");
  e.addChemBond(0);
  e.typeText("B");
  e.typeText(" ->[heat]");
  e.typeText("C");
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A-[:0]B} \\arrow{->[heat]} \\chemfig{C} \\schemestop");
  assert.equal(render(e.toLatex()).warnings.length, 0);
  assert.ok(same(e.toLatex(), e.toLatex({ marked: true })));
});

test("the palette's ring-to-ring scheme: the first R picked, conditions typed in place", () => {
  const e = editor();
  e.insertLatex("\\schemestart \\chemfig{*6(-=-=(-R)-=)} \\arrow{->[][]} \\chemfig{*6(-=-=(-R)-=)} \\schemestop");
  e.typeText("H");
  const s = schemeOf(e);
  const arrow = s.body.children.find((p) => p.kind === "rxarrow")!;
  if (arrow.kind !== "rxarrow") throw new Error();
  e.setCursor({ row: arrow.above, offset: 0 });
  e.typeText("HNO3");
  e.setCursor({ row: arrow.below, offset: 0 });
  e.typeText("H2SO4");
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{*6(-=-=(-H)-=)} \\arrow{->[\\ce{HNO3}][\\ce{H2SO4}]} \\chemfig{*6(-=-=(-R)-=)} \\schemestop");
});

test("+ from the palette in a scheme: a new structure after it, its atom picked; what a scheme cannot draw is left out", () => {
  const e = editor("\\schemestart \\chemfig{A} \\schemestop");
  const s = schemeOf(e);
  e.cursor = { row: s.body, offset: 1 };
  e.addReactionSign("+");
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\+ \\chemfig{} \\schemestop");
  assert.equal(e.chemSelection()?.index, 0);
  e.typeText("B");
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\+ \\chemfig{B} \\schemestop");
  // a reaction (mhchem) put into a scheme goes beside it, whole: the scheme is as it was
  e.cursor = { row: s.body, offset: 3 };
  e.insertLatex("\\ce{C}");
  e.addReactionSign("^");
  assert.deepEqual(s.body.children.map((p) => p.kind), ["raw", "rxtoken", "raw"]);
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\+ \\chemfig{B} \\schemestop\\ce{C ^}");
  // signs other than + have no place in chemfig's scheme
  e.cursor = { row: s.body, offset: 3 };
  e.addReactionSign("^");
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\+ \\chemfig{B} \\schemestop\\ce{C ^}");
});

test("the arrow the cursor is beside shows its two places, to type conditions into; the bar's buttons act on it", () => {
  const e = editor("\\schemestart \\chemfig{A} \\arrow{->} \\chemfig{B} \\schemestop");
  const s = schemeOf(e);
  const arrow = s.body.children[1];
  // before the arrow (where a click on it puts the cursor), after it, in its conditions
  for (const offset of [1, 2]) {
    e.setCursor({ row: s.body, offset });
    assert.equal(e.activeArrow(), arrow);
    assert.equal((e.toLatex({ marked: true }).match(/empty=1/g) ?? []).length, 2);
  }
  e.setCursor({ row: s.body, offset: 0 });
  assert.equal(e.activeArrow(), null);
  assert.equal((e.toLatex({ marked: true }).match(/empty=1/g) ?? []).length, 0);
  assert.equal(new Editor("x").activeArrow(), null);
  // from before it: the conditions under it, then the arrow's kind changed (not a new arrow)
  e.setCursor({ row: s.body, offset: 1 });
  e.enterReactionPlace("below");
  assert.equal(e.activeArrow(), arrow);
  e.typeText("cat");
  e.setCursor({ row: s.body, offset: 1 });
  e.setReactionArrow("<=>");
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\arrow{<=>[][cat]} \\chemfig{B} \\schemestop");
});

test("math put between a scheme's pieces is left out of its LaTeX", () => {
  const e = editor("\\schemestart \\chemfig{A} \\schemestop");
  e.cursor = { row: schemeOf(e).body, offset: 1 };
  e.insertLatex("\\frac{a}{b}");
  assert.deepEqual(schemeOf(e).body.children.map((p) => p.kind), ["raw", "frac"]);
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\schemestop");
});

test("second round: a formula in a scheme's conditions is set as mhchem's and read back; an emptied scheme goes", () => {
  const src = "\\schemestart \\chemfig{A} \\arrow{->[\\ce{H2SO4}][heat]} \\chemfig{B} \\schemestop";
  const e = editor(src);
  assert.equal(e.toLatex(), src);
  assert.ok(same(src, e.toLatex({ marked: true })));
  const t = editor();
  t.typeText("\\schemestart ");
  t.typeText("A");
  t.backspace();
  t.backspace();
  assert.equal(t.toLatex(), "");
  // a scheme with nothing in it is still written whole
  const n = editor("\\schemestart \\chemfig{A} \\schemestop");
  schemeOf(n).body.children = [];
  assert.equal(n.toLatex(), "\\schemestart \\schemestop");
});

test("an empty structure removed from a scheme with other pieces: the scheme stays", () => {
  const e = editor("\\schemestart \\chemfig{A} \\arrow{->} \\chemfig{} \\schemestop");
  const s = schemeOf(e);
  e.selectChem(s.body.children[2] as never, "atom", 0);
  e.backspace();
  assert.equal(e.toLatex(), "\\schemestart \\chemfig{A} \\arrow{->} \\schemestop");
});
