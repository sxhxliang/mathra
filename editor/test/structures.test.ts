// Structures (\chemfig) edited in place: atoms picked and relabelled, bonds drawn from them, kinds
// changed, rings hung, atoms removed; the code stays as written everywhere else.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Raw } from "../src/model.ts";
import { drawing } from "./drawing.ts";
import { render } from "../../npm/pkg/node/index.mjs";

const editor = (latex = "") => {
  const e = new Editor();
  e.parseChem = (l) => render(l).tree;
  if (latex) e.setLatex(latex);
  return e;
};
const structure = (e: Editor) => e.root.children.find((a) => a.kind === "raw") as Raw;
const same = (a: string, b: string) => JSON.stringify(drawing(render(a).svg)) === JSON.stringify(drawing(render(b).svg));

test("marked draws as written: every atom marked, a box for each", () => {
  for (const src of ["\\chemfig{H_3C-C(=[1]O)-[7]OH}", "\\chemfig{*6(-=-=(-OH)-=)}", "\\chemfig{H-C(-[2]H)(-[6]H)-C(-[2]H)(-[6]H)-O-H}", "\\chemfig{*6((=O)-N(-CH_3)-*5(-N=-N(-CH_3)-=)--(=O)-N(-H_3C)-)}"]) {
    const e = editor(src);
    const g = e.graphOf(structure(e))!;
    assert.ok(g, src);
    const marked = e.toLatex({ marked: true });
    assert.ok(same(src, marked), `marks moved ${src}`);
    const boxes = render(marked).boxes.map((b: { attributes: Record<string, string> }) => b.attributes["data-m"]);
    for (let k = 0; k < g.atoms.length; k++) assert.ok(boxes.includes(`${structure(e).id}a${k}`) || g.atoms.some((a, j) => j < k && a.span![0] === g.atoms[k].span![0]), `${src}: atom ${k}`);
  }
});

test("\\chemfig typed: one atom selected; typing its label, Alt+arrow bonds, a ring", () => {
  const e = editor();
  e.typeText("\\chemfig ");
  const s = structure(e);
  assert.equal(e.chemSelection()?.index, 0);
  // typed as chemistry is written: the 3 after H is its index
  e.typeText("H3C");
  assert.equal(e.toLatex(), "\\chemfig{H_3C}");
  e.addChemBond(0);
  e.typeText("C");
  e.addChemBond(60, "double");
  e.typeText("O");
  assert.equal(e.toLatex(), "\\chemfig{H_3C-[:0]C=[:60]O}");
  // back to the carbon: a branch down-right
  e.moveChem(240);
  assert.equal(e.chemSelection()?.graph.atoms[e.chemSelection()!.index].label, "C");
  e.addChemBond(-60);
  e.typeText("OH");
  assert.equal(e.toLatex(), "\\chemfig{H_3C-[:0]C(-[:-60]OH)=[:60]O}");
  // the double bond made single, then removed with its oxygen
  const g = e.graphOf(s)!;
  e.selectChem(s, "bond", g.bonds.findIndex((b) => b.kind === "double"));
  e.setChemBondKind("single");
  assert.equal(e.toLatex(), "\\chemfig{H_3C-[:0]C(-[:-60]OH)-[:60]O}");
  e.backspace();
  assert.equal(e.toLatex(), "\\chemfig{H_3C-[:0]C(-[:-60]OH)}");
  e.addChemRing(6, true);
  // a ring on an atom with bonds hangs from a new bond, away from them
  assert.equal(e.toLatex(), "\\chemfig{H_3C-[:0]C(-[:60]*6(-=-=-=))(-[:-60]OH)}");
  assert.equal(render(e.toLatex()).warnings.length, 0);
  e.undo();
  assert.equal(e.toLatex(), "\\chemfig{H_3C-[:0]C(-[:-60]OH)}");
});

test("a template's substituent R is selected; typing replaces it; the ring stays as written", () => {
  const e = editor();
  e.insertLatex("\\chemfig{*6(-=-=(-R)-=)}");
  const sel = e.chemSelection()!;
  assert.equal(sel.graph.atoms[sel.index].label, "R");
  e.typeText("NO_2");
  assert.equal(e.toLatex(), "\\chemfig{*6(-=-=(-NO_2)-=)}");
});

test("a label never takes bond or branch characters", () => {
  const e = editor("\\chemfig{A-B}");
  e.selectChem(structure(e), "atom", 1);
  e.typeText("O-(");
  assert.equal(e.toLatex(), "\\chemfig{A-O}");
  e.typeText("^-");
  assert.equal(e.toLatex(), "\\chemfig{A-O^-}");
});

test("every gallery structure, its atoms marked, draws as it did", async () => {
  const { GALLERY } = await import("../src/gallery.ts");
  const problems: string[] = [];
  let n = 0;
  for (const g of GALLERY)
    for (const r of g.rows) {
      if (r.input !== "latex" || !r.tex.includes("\\chemfig")) continue;
      const e = editor(r.tex);
      const options = { locale: r.locale };
      const original = JSON.stringify(drawing(render(r.tex, options).svg));
      const structures = e.root.children.filter((a) => a.kind === "raw" && e.graphOf(a as Raw));
      n += structures.length;
      if (JSON.stringify(drawing(render(e.toLatex({ marked: true }), options).svg)) !== original) problems.push(r.name || r.caption);
    }
  assert.deepEqual(problems, []);
  assert.ok(n >= 5, `only ${n} structures editable`);
});

test("a label set from a palette; Backspace takes its letters one by one, then the atom", () => {
  const e = editor("\\chemfig{A-B}");
  const s = structure(e);
  e.selectChem(s, "atom", 1);
  e.setChemLabel("OH");
  assert.equal(e.toLatex(), "\\chemfig{A-OH}");
  // a bond selected has no label to set
  e.selectChem(s, "bond", 0);
  e.setChemLabel("X");
  assert.equal(e.toLatex(), "\\chemfig{A-OH}");
  // typed on (no longer fresh): Backspace a letter at a time, then the atom with its bond
  e.selectChem(s, "atom", 1);
  e.typeText("CH");
  e.backspace();
  assert.equal(e.toLatex(), "\\chemfig{A-C}");
  e.backspace();
  assert.equal(e.toLatex(), "\\chemfig{A-}");
  e.backspace();
  assert.equal(e.toLatex(), "\\chemfig{A}");
});

test("an atom alone in a branch goes with its parentheses", () => {
  const e = editor("\\chemfig{A(-B)-C}");
  e.selectChem(structure(e), "atom", 1);
  e.backspace();
  assert.equal(e.toLatex(), "\\chemfig{A-C}");
});

test("a structure mathra cannot read stays a block, not edited in place", () => {
  const e = new Editor();
  e.parseChem = () => {
    throw new Error("unreadable");
  };
  e.setLatex("\\chemfig{A-B}");
  assert.equal(e.graphOf(structure(e)), null);
  assert.equal(e.toLatex(), "\\chemfig{A-B}");
});

test("a label typed freely keeps what chemfig can hold: a charge after ^, no bond or branch characters", async () => {
  const { cleanLabel } = await import("../src/structure.ts");
  assert.equal(cleanLabel("CH_3"), "CH_3");
  assert.equal(cleanLabel("O^-"), "O^-");
  assert.equal(cleanLabel("NH_4^+"), "NH_4^+");
  assert.equal(cleanLabel("C H-(x)=[y],!"), "CHxy");
});

test("found by using it: a label typed with _ or ^ never takes in the bond after it; an empty structure goes with Backspace", async () => {
  const { chemfigLabel, labelText } = await import("../src/structure.ts");
  const e = editor("\\chemfig{A-B}");
  e.selectChem(structure(e), "atom", 0);
  e.typeText("NH_3^+");
  assert.equal(e.toLatex(), "\\chemfig{NH_3^+-B}");
  // typed as chemistry is written, in the bar's box too
  e.setChemLabel("NH4^+");
  assert.equal(e.toLatex(), "\\chemfig{NH_4^+-B}");
  assert.equal(chemfigLabel("C12"), "C_{12}");
  assert.equal(labelText("NH_4^+"), "NH4^+");
  assert.equal(labelText("O^{}"), "O^");
  // Backspace takes a letter of the label as typed (the 3 of NH3, not a brace)
  const b = editor("\\chemfig{A-B}");
  b.selectChem(structure(b), "atom", 0);
  b.typeText("NH3");
  assert.equal(b.toLatex(), "\\chemfig{NH_3-B}");
  b.backspace();
  assert.equal(b.toLatex(), "\\chemfig{NH-B}");
  // an empty structure goes whole
  const s = editor("\\chemfig{}");
  s.selectChem(structure(s), "atom", 0);
  s.backspace();
  assert.equal(s.toLatex(), "");
});

test("second round: a ring hangs away from the bonds an atom has; on a chain's end it follows the chain", () => {
  const ring = (k: number) => {
    const e = editor("\\chemfig{C-[:30]O-[:-30]}");
    e.selectChem(structure(e), "atom", k);
    e.addChemRing(6, false);
    return e.toLatex();
  };
  assert.equal(ring(0), "\\chemfig{C(-[:-150]*6(------))-[:30]O-[:-30]}");
  assert.equal(ring(1), "\\chemfig{C-[:30]O(-[:90]*6(------))-[:-30]}");
  assert.equal(ring(2), "\\chemfig{C-[:30]O-[:-30]*6(------)}");
  // through a chain (bonds that cancel out): across it
  const e = editor("\\chemfig{A-[:0]B-[:0]C}");
  e.selectChem(structure(e), "atom", 1);
  e.addChemRing(5, false);
  assert.equal(e.toLatex(), "\\chemfig{A-[:0]B(-[:90]*5(-----))-[:0]C}");
});
