// Found by opening every example of the gallery and editing it: what used to stay a block of LaTeX
// (physics' matrices and derivatives, arrays, Dirac's brackets) is edited in places; conditions over
// an arrow never split a command; undo after undo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Call, type Matrix } from "../src/model.ts";
import { conditionPieces } from "../src/reaction.ts";
import { drawing } from "./drawing.ts";
import { render } from "../../npm/pkg/node/index.mjs";

const same = (a: string, b: string) => JSON.stringify(drawing(render(a).svg)) === JSON.stringify(drawing(render(b).svg));
const marked = (e: Editor) => {
  e.setCursor({ row: e.root, offset: e.root.children.length });
  return e.toLatex({ marked: true });
};

test("commands with math arguments: each argument a place, read back and drawn the same", () => {
  for (const src of ["\\pdv{f}{x}", "\\pdv[2]{f}{x}", "\\dv{t}", "\\dd{x}", "\\ket{\\Psi(t)}", "\\braket{a}{b}", "\\expval{H}{\\psi}", "\\mel{a}{b}{c}", "\\comm{x}{p}", "\\abs{\\theta}", "\\vb{u}", "\\slashed{D}", "\\symbf{\\sigma}", "\\xrightarrow[a]{b}"]) {
    const e = new Editor(src);
    assert.equal(e.root.children[0].kind, "call", src);
    assert.equal(e.toLatex(), src);
    assert.ok(same(src, marked(e)), `marked ${src}`);
  }
  // fewer arguments than it needs: as written
  assert.equal(new Editor("\\mel{a}{b}").root.children[0].kind, "raw");
  // typed: its places, the selection in the first
  const t = new Editor();
  t.typeText("\\pdv f");
  t.moveDown();
  t.typeText("x");
  assert.equal(t.toLatex(), "\\pdv{f}{x}");
  t.moveUp();
  assert.equal(t.cursor.row, (t.root.children[0] as Call).args[0]);
  // a letter after it keeps a space: \ket{\psi} q is not \ket{\psi}q (which a macro would read as \rangleq)
  const k = new Editor("\\ket{\\psi}");
  k.typeText("q");
  assert.equal(k.toLatex(), "\\ket{\\psi} q");
});

test("the physics package's matrices and arrays are matrices: cells edited, written as they were", () => {
  for (const src of ["\\pmqty{a & b \\\\ c & d}", "\\bmqty{\\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta}", "\\mdet{a & b \\\\ c & d}", "\\begin{array}{cc|c} 1 & 2 & 8 \\\\ \\hline 0 & 1 & 5 \\end{array}"]) {
    const e = new Editor(src);
    assert.equal(e.root.children[0].kind, "matrix", src);
    assert.ok(same(src, e.toLatex()), `written back ${e.toLatex()}`);
    assert.ok(same(src, marked(e)), `marked ${src}`);
  }
  // typed: a 2×2 one
  const t = new Editor();
  t.typeText("\\pmqty a&b");
  assert.equal(t.toLatex(), "\\pmqty{a & b \\\\ & }");
  // given a size and delimiters: it stays a physics matrix where the package has them
  const m = new Editor("\\pmqty{a & b \\\\ c & d}");
  m.setCursor({ row: (m.root.children[0] as Matrix).cells[0][0], offset: 1 });
  assert.equal(m.shapeableMatrix()?.env, "pmatrix");
  m.shapeMatrix(2, 3, "bmatrix");
  assert.equal(m.toLatex(), "\\bmqty{a & b & \\\\ c & d & }");
  m.shapeMatrix(2, 3, "Vmatrix");
  assert.equal(m.toLatex(), "\\begin{Vmatrix}a & b & \\\\ c & d & \\end{Vmatrix}");
  // an array keeps its columns
  const a = new Editor("\\begin{array}{c|c} A & B \\end{array}");
  assert.equal((a.root.children[0] as Matrix).spec, "c|c");
});

test("conditions over an arrow: a command or $…$ is one piece, never split by the cursor", () => {
  assert.deepEqual(conditionPieces("\\text{light} 5$\\alpha$\\,x\\qty{25}{\\celsius} [a]"), [{ latex: "\\text{light}" }, { ch: " " }, { ch: "5" }, { latex: "$\\alpha$" }, { latex: "\\," }, { ch: "x" }, { latex: "\\qty{25}{\\celsius}" }, { ch: " " }, { ch: "[" }, { ch: "a" }, { ch: "]" }]);
  assert.deepEqual(conditionPieces("$x"), [{ latex: "$x" }]);
  assert.deepEqual(conditionPieces("\\"), [{ ch: "\\" }]);
  const e = new Editor("\\ce{A ->[\\text{light}][x] B}");
  const arrow = (e.root.children[0] as never as { body: { children: { above: { children: unknown[] } }[] } }).body.children[1];
  assert.equal(arrow.above.children.length, 1);
  e.setCursor({ row: arrow.above as never, offset: 1 });
  e.typeText("q");
  assert.equal(e.toLatex(), "\\ce{A ->[\\text{light}q][x] B}");
  // opened as LaTeX and done: still a piece of the conditions (mhchem reads it)
  e.setCursor({ row: arrow.above as never, offset: 0 });
  const s = e.editBlock(e.blockAtCursor()!);
  s.update("\\text{heat}");
  s.commit();
  assert.equal(e.toLatex(), "\\ce{A ->[\\text{heat}q][x] B}");
});

test("a scheme with pieces the editor cannot take apart: they are kept as written, the rest in pieces", () => {
  const src = "\\schemestart 3\\,\\chemfig{H-C~C-H} \\arrow{->[Fe][873 K]} \\chemfig{*6(=-=-=-)} \\schemestop";
  const e = new Editor(src);
  assert.equal(e.root.children[0].kind, "reaction");
  assert.ok(same(src, e.toLatex()));
});

test("undo, then typing: a step of its own (undo again goes back one step, not to an older formula)", () => {
  const e = new Editor();
  e.setLatex("a");
  e.setLatex("b");
  e.typeText("x");
  e.undo();
  e.typeText("y");
  e.undo();
  assert.equal(e.toLatex(), "b");
  e.redo();
  e.typeText("z");
  e.undo();
  assert.equal(e.toLatex(), "by");
});

test("an index after a large operator's limits, its base gone: on an empty base", () => {
  const e = new Editor("\\sum_{k=0}^{10}a_{k}");
  e.setCursor({ row: e.root, offset: 2 });
  e.backspace();
  assert.equal(e.toLatex(), "\\sum_{k=0}^{10}{}_{k}");
  assert.equal(render(e.toLatex()).warnings.length, 0);
});
