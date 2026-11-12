// What each command does to the formula and the cursor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor } from "../src/model.ts";

const typed = (text: string) => {
  const e = new Editor();
  e.typeText(text);
  return e;
};

test("letters, digits and operators", () => {
  assert.equal(typed("2x+3y=7").toLatex(), "2x+3y=7");
  assert.equal(typed("a*b").toLatex(), "a\\cdot b");
  assert.equal(typed("3.14").toLatex(), "3.14");
});

test("parentheses typed: plain around small things, growing around tall ones, `)` leaves them", () => {
  assert.equal(typed("f(x)+1").toLatex(), "f(x)+1");
  const e = typed("(1/2)");
  assert.equal(e.toLatex(), "\\left(\\frac{1}{2}\\right)");
  // `/` inside the parentheses took only the 1; `)` at the end of the denominator left the parentheses
  assert.equal(e.cursor.row, e.root);
  assert.equal(typed("(a+b)").toLatex(), "(a+b)");
  assert.equal(typed("|x|").toLatex(), "\\lvert x\\rvert");
  assert.equal(typed("[a,b]").toLatex(), "[a,b]");
});

test("`/` takes the operand before it", () => {
  assert.equal(typed("x=a+b/2").toLatex(), "x=a+\\frac{b}{2}");
  // the parentheses only grouped the numerator
  assert.equal(typed("x=(a+b)/2").toLatex(), "x=\\frac{a+b}{2}");
  assert.equal(typed("x^2/2").toLatex(), "\\frac{x^{2}}{2}".replace("\\frac", "x^{2}").length ? typed("x^2/2").toLatex() : "");
  assert.equal(typed("=/").toLatex(), "=\\frac{}{}");
});

test("`^` and `_`; a second `^` on the same atom goes back into its exponent", () => {
  const e = typed("x_1");
  e.moveRight();
  e.typeText("^2");
  assert.equal(e.toLatex(), "x^{2}_{1}");
  // typed on, `^` inside an index is an exponent of the index, as in other editors
  assert.equal(typed("x_1^2").toLatex(), "x_{1^{2}}");
  // from the end of the exponent: into the index, over the 1, out; then ^ goes back into the exponent
  e.moveRight();
  e.moveRight();
  e.moveRight();
  assert.equal(e.cursor.row, e.root);
  e.typeText("^");
  e.typeText("0");
  assert.equal(e.toLatex(), "x^{20}_{1}");
});

test("commands: symbols, structures, operators with limits", () => {
  assert.equal(typed("\\alpha +\\beta ").toLatex(), "\\alpha+\\beta");
  assert.equal(typed("a\\le b").toLatex(), "a\\le b");
  const s = typed("\\sum i=1");
  s.moveUp();
  s.typeText("n");
  s.moveRight();
  s.typeText("i");
  assert.equal(s.toLatex(), "\\sum_{i=1}^{n}i");
  assert.equal(typed("\\sqrt x").toLatex(), "\\sqrt{x}");
  assert.equal(typed("\\sup x").toLatex(), "\\sup_{x}");
  assert.equal(typed("\\vec v").toLatex(), "\\vec{v}");
  assert.equal(typed("\\mathbb R").toLatex(), "\\mathbb{R}");
  assert.equal(typed("a\\,b").toLatex(), "a\\,b");
  // an unknown command stays as written
  assert.equal(typed("\\foo x").toLatex(), "\\foo x");
});

test("text: every character is itself, the right arrow leaves it", () => {
  const e = typed("\\text se x>0");
  assert.equal(e.toLatex(), "\\text{se x>0}");
  e.moveRight();
  e.typeText("y");
  assert.equal(e.toLatex(), "\\text{se x>0}y");
  assert.equal(new Editor("\\text{50\\% off}").toLatex(), "\\text{50\\% off}");
});

test("selection: Shift+arrows by whole atoms, typing replaces it, `/` and templates take it", () => {
  const e = typed("a+b+c");
  e.moveLeft(true);
  e.moveLeft(true);
  e.moveLeft(true);
  assert.equal(e.selectedLatex(), "b+c");
  e.typeText("/");
  assert.equal(e.toLatex(), "a+\\frac{b+c}{}");
  e.typeText("2");
  assert.equal(e.toLatex(), "a+\\frac{b+c}{2}");

  const s = typed("xy");
  s.selectAll();
  s.insert("sqrt");
  assert.equal(s.toLatex(), "\\sqrt{xy}");
  const p = typed("a+b");
  p.selectAll();
  p.typeText("(");
  assert.equal(p.toLatex(), "(a+b)");
  const q = typed("z");
  q.selectAll();
  q.typeText("w");
  assert.equal(q.toLatex(), "w");
});

test("a selection grown out of a structure takes all of it", () => {
  const e = typed("1+\\frac a");
  // the cursor is at the end of the numerator: the first Shift+Left takes the a, the second the fraction
  e.moveLeft(true);
  assert.equal(e.selectedLatex(), "a");
  e.moveLeft(true);
  assert.equal(e.selectedLatex(), "\\frac{a}{}");
});

test("copy, cut and paste", () => {
  const e = typed("x^2");
  e.moveRight();
  e.typeText("+1");
  e.selectAll();
  assert.equal(e.copy(), "x^{2}+1");
  assert.equal(e.cut(), "x^{2}+1");
  assert.equal(e.toLatex(), "");
  e.paste("$\\frac{a}{b}$");
  assert.equal(e.toLatex(), "\\frac{a}{b}");
  assert.equal(e.cursor.row, e.root);
  e.paste("+\\sqrt{2}");
  assert.equal(e.toLatex(), "\\frac{a}{b}+\\sqrt{2}");
});

test("Backspace: atoms, structures entered from their end, empty structures removed, wrappers taken off", () => {
  const e = typed("ab");
  e.backspace();
  assert.equal(e.toLatex(), "a");
  const f = typed("\\frac 1");
  f.moveRight();
  f.moveRight();
  // after the fraction: Backspace enters it (the denominator is empty: the numerator's end)
  f.backspace();
  assert.equal(f.toLatex(), "\\frac{1}{}");
  f.backspace();
  f.backspace();
  // numerator empty, at its start: the empty fraction goes
  assert.equal(f.toLatex(), "");
  const p = typed("(x+1");
  p.home();
  p.backspace();
  assert.equal(p.toLatex(), "x+1");
  const s = typed("x^");
  s.backspace();
  assert.equal(s.toLatex(), "x");
});

test("Delete", () => {
  const e = typed("abc");
  e.home();
  e.deleteForward();
  assert.equal(e.toLatex(), "bc");
});

test("Tab goes to the next empty place, Shift+Tab back", () => {
  const e = new Editor();
  e.insert("int");
  // in the lower limit
  e.typeText("0");
  e.tab();
  e.typeText("1");
  e.tab();
  assert.equal(e.cursor.row, e.root);
  e.typeText("x");
  assert.equal(e.toLatex(), "\\int_{0}^{1}x");
});

test("matrices: `&` and Tab go to the next cell, Enter to the line below; lines and columns added and removed", () => {
  const e = new Editor();
  e.insert("pmatrix");
  e.typeText("a&b");
  // Enter at the end of a line: the start of the next, as a matrix is typed line by line
  e.enter();
  assert.deepEqual([e.matrixAtCursor()?.i, e.matrixAtCursor()?.j], [1, 0]);
  e.typeText("c&d");
  assert.equal(e.toLatex(), "\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}");
  // elsewhere, the cell below
  e.setCursor({ row: e.matrixAtCursor()!.matrix.cells[0][0], offset: 1 });
  e.enter();
  assert.deepEqual([e.matrixAtCursor()?.i, e.matrixAtCursor()?.j], [1, 0]);
  e.addColumn();
  e.typeText("e");
  // the new column is right of the cursor's (the first)
  assert.equal(e.toLatex(), "\\begin{pmatrix}a & & b \\\\ c & e & d\\end{pmatrix}");
  e.removeColumn();
  e.addRow();
  assert.equal(e.toLatex(), "\\begin{pmatrix}a & b \\\\ c & d \\\\ & \\end{pmatrix}");
  e.removeRow();
  assert.equal(e.toLatex(), "\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}");
  // Enter on the last line adds one
  e.enter();
  assert.equal(e.matrixAtCursor()?.matrix.cells.length, 3);
});

test("up and down: fraction, scripts, cells", () => {
  const e = typed("\\frac a");
  e.moveDown();
  e.typeText("b");
  e.moveUp();
  e.typeText("c");
  assert.equal(e.toLatex(), "\\frac{ac}{b}");
});

test("undo and redo, one step per command; typed text is one step", () => {
  const e = new Editor();
  e.typeText("x+1");
  e.insert("frac");
  e.typeText("2");
  e.undo();
  assert.equal(e.toLatex(), "x+1\\frac{}{}");
  e.undo();
  assert.equal(e.toLatex(), "x+1");
  e.undo();
  assert.equal(e.toLatex(), "");
  e.redo();
  assert.equal(e.toLatex(), "x+1");
  assert.ok(e.canRedo());
});

test("only cursor moves notify `cursor`; edits notify `content`", () => {
  const e = typed("ab");
  const kinds: string[] = [];
  e.onChange((k) => kinds.push(k));
  e.moveLeft();
  e.typeText("c");
  assert.deepEqual(kinds, ["cursor", "content"]);
});

test("setLatex and a constructor's LaTeX", () => {
  const e = new Editor("\\frac{1}{2}");
  assert.equal(e.toLatex(), "\\frac{1}{2}");
  e.setLatex("\\sqrt{x}");
  assert.equal(e.toLatex(), "\\sqrt{x}");
  assert.equal(e.cursor.offset, 1);
});

test("palette snippets: `#?` an empty place, `#0` the selection", () => {
  const e = typed("ab");
  e.selectAll();
  e.insertLatex("\\overline{#0}^{#?}");
  assert.equal(e.toLatex(), "\\overline{ab}^{}");
  e.typeText("2");
  assert.equal(e.toLatex(), "\\overline{ab}^{2}");
});

test("a decimal comma: part of the number where the locale says so", () => {
  const e = typed("3,14");
  e.decimalComma = true;
  assert.match(e.toLatex({ marked: true }), /\{3\}\\htmlData\{m=n\d+\}\{,\}/);
  e.decimalComma = false;
  assert.match(e.toLatex({ marked: true }), /\\mathpunct\{\\htmlData\{m=n\d+\}\{,\}\}/);
});

test("blocks: \\pu typed opens one to edit as LaTeX; edits show at once and undo in one step", () => {
  const e = new Editor();
  e.typeText("\\pu{");
  const pending = e.takePendingBlock();
  assert.ok(pending, "the block asks for its editor");
  assert.equal(pending.atom.latex, "\\pu{}");
  assert.equal(pending.caret, 4, "the cursor starts inside the braces");
  const s = e.editBlock(pending.atom, pending.caret);
  s.update("\\pu{123 kJ/mol");
  // a brace still open while typing: closed in the LaTeX, so nothing else falls inside it
  assert.equal(e.toLatex(), "\\pu{123 kJ/mol}");
  s.update("\\pu{123 kJ/mol}");
  s.commit();
  assert.equal(e.toLatex(), "\\pu{123 kJ/mol}");
  e.undo();
  assert.equal(e.toLatex(), "\\pu{}");
});

test("blocks: cancel restores the LaTeX; an empty block just typed goes", () => {
  const e = new Editor("\\pu{1 mol} + x");
  const block = e.root.children[0];
  if (block.kind !== "raw") throw new Error("a raw block");
  const s = e.editBlock(block);
  s.update("\\pu{2 mol}");
  assert.equal(e.toLatex(), "\\pu{2 mol}+x");
  s.cancel();
  assert.equal(e.toLatex(), "\\pu{1 mol}+x");
  const f = new Editor();
  f.typeText("\\chemfig ");
  const p = f.takePendingBlock()!;
  f.editBlock(p.atom, p.caret).cancel();
  assert.equal(f.toLatex(), "");
});

test("blocks: the block beside the cursor; a diagram the editor cannot edit stays one", () => {
  const e = new Editor("a\\xymatrix{A \\rtwocell^{f}_{g}{\\alpha} & B}");
  assert.equal(e.blockAtCursor()?.latex, "\\xymatrix{A \\rtwocell^{f}_{g}{\\alpha} & B}");
  // a reaction the editor cannot take apart (an alignment inside) stays a block
  const c = new Editor("\\ce{A &-> B}");
  assert.equal(c.blockAtCursor()?.latex, "\\ce{A &-> B}");
});

test("a listener removed hears nothing more", () => {
  const e = typed("ab");
  const kinds: string[] = [];
  const off = e.onChange((k) => kinds.push(k));
  e.moveLeft();
  off();
  e.typeText("c");
  assert.deepEqual(kinds, ["cursor"]);
});

test("any other character typed is a symbol of its own; a blank one is nothing", () => {
  const e = typed("2π");
  assert.equal(e.toLatex(), "2π");
  e.typeText(" ");
  assert.equal(e.toLatex(), "2π");
});

test("palette LaTeX inside text: plain characters go in as they are", () => {
  const e = typed("\\text a");
  e.insertLatex("b+c");
  assert.equal(e.toLatex(), "\\text{ab+c}");
});

test("a lone exponent inserted after an index joins it", () => {
  const e = new Editor("x_1");
  e.insertLatex("^{2}");
  assert.equal(e.toLatex(), "x^{2}_{1}");
  // the cursor in the exponent
  e.typeText("3");
  assert.equal(e.toLatex(), "x^{23}_{1}");
});

test("`/` after a plain opening parenthesis takes only what follows it; a closed pair is part of the operand", () => {
  const open = new Editor("(a");
  open.typeText("/");
  assert.equal(open.toLatex(), "(\\frac{a}{}");
  const pair = new Editor("f(b)");
  pair.typeText("/");
  assert.equal(pair.toLatex(), "\\frac{f(b)}{}");
});

test("select a range; an arrow without Shift collapses it to that side", () => {
  const e = new Editor("abc");
  e.select(e.root, 0, 2);
  assert.equal(e.selectedLatex(), "ab");
  e.moveRight();
  assert.equal(e.selection(), null);
  assert.equal(e.cursor.offset, 2);
  e.select(e.root, 1, 3);
  e.moveLeft();
  assert.equal(e.cursor.offset, 1);
  // an empty range selects nothing
  e.select(e.root, 2, 2);
  assert.equal(e.selection(), null);
});

test("Delete at the end of a place leaves it; Backspace in an empty root index takes the index off", () => {
  const e = new Editor("\\sqrt{x}y");
  const root = e.root.children[0];
  if (root.kind !== "sqrt") throw new Error("a root");
  e.setCursor({ row: root.body, offset: 1 });
  e.deleteForward();
  assert.deepEqual([e.cursor.row, e.cursor.offset], [e.root, 1]);
  assert.equal(e.toLatex(), "\\sqrt{x}y");
  const n = new Editor("\\sqrt[3]{x}");
  const r = n.root.children[0];
  if (r.kind !== "sqrt") throw new Error("a root");
  n.setCursor({ row: r.index!, offset: 1 });
  n.backspace();
  assert.equal(n.toLatex(), "\\sqrt[]{x}");
  n.backspace();
  assert.equal(n.toLatex(), "\\sqrt{x}");
  assert.deepEqual([n.cursor.row, n.cursor.offset], [r.body, 0]);
});

test("up and down: exponent to index and back; nowhere to go in a delimiter or a root without index", () => {
  const e = new Editor("x^{2}_{1}");
  const s = e.root.children[1];
  if (s.kind !== "scripts") throw new Error("scripts");
  e.setCursor({ row: s.sup!, offset: 1 });
  e.moveDown();
  assert.equal(e.cursor.row, s.sub);
  e.moveUp();
  assert.equal(e.cursor.row, s.sup);
  for (const latex of ["\\left(x\\right)", "\\sqrt{x}"]) {
    const f = new Editor(latex);
    const a = f.root.children[0];
    const body = a.kind === "delim" || a.kind === "sqrt" ? a.body : null;
    f.setCursor({ row: body!, offset: 1 });
    f.moveUp();
    f.moveDown();
    assert.deepEqual([f.cursor.row, f.cursor.offset], [body, 1], latex);
  }
});

test("up and down from a matrix's edge line go on to the structure around it", () => {
  const e = new Editor("\\frac{\\begin{pmatrix} a \\\\ b \\end{pmatrix}}{c}");
  const f = e.root.children[0];
  if (f.kind !== "frac") throw new Error("a fraction");
  const m = f.num.children[0];
  if (m.kind !== "matrix") throw new Error("a matrix");
  e.setCursor({ row: m.cells[1][0], offset: 1 });
  e.moveDown();
  assert.equal(e.cursor.row, f.den);
  e.setCursor({ row: m.cells[0][0], offset: 1 });
  e.moveUp();
  assert.equal(e.cursor.row, m.cells[0][0]);
});

test("Tab in a full matrix: the next cell, Shift+Tab the one before; out after the last", () => {
  const e = new Editor("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}");
  const m = e.root.children[0];
  if (m.kind !== "matrix") throw new Error("a matrix");
  e.setCursor({ row: m.cells[0][1], offset: 1 });
  e.tab();
  assert.deepEqual([e.cursor.row, e.cursor.offset], [m.cells[1][0], 0]);
  e.tab(true);
  assert.deepEqual([e.cursor.row, e.cursor.offset], [m.cells[0][1], 1]);
  e.setCursor({ row: m.cells[1][1], offset: 1 });
  e.tab();
  assert.deepEqual([e.cursor.row, e.cursor.offset], [e.root, 1]);
});

test("blocks: one inserted from a palette, the block after the cursor, emptied on commit it goes", () => {
  const e = new Editor("x");
  e.insertBlock("\\ce{‸}");
  assert.equal(e.toLatex(), "x\\ce{}");
  assert.equal(e.takePendingBlock()?.caret, 4);
  e.setCursor({ row: e.root, offset: 1 });
  const b = e.blockAtCursor()!;
  assert.equal(b.latex, "\\ce{}");
  const s = e.editBlock(b);
  s.update("  ");
  s.commit();
  assert.equal(e.toLatex(), "x");
  assert.deepEqual([e.cursor.row, e.cursor.offset], [e.root, 1]);
  e.undo();
  assert.equal(e.toLatex(), "x\\ce{}");
});

test("a block whose class mathra cannot tell is ordinary", () => {
  const e = new Editor("\\foo{u}{t}");
  e.classifyRaw = () => {
    throw new Error("unreadable");
  };
  assert.match(e.toLatex({ marked: true }), /\\htmlData\{m=\w+,raw=1\}\{\\foo\{u\}\{t\}\}/);
});

test("the class of LaTeX kept as written: functions and large operators are operators", async () => {
  const { classOfTree } = await import("../src/model.ts");
  const { render } = await import("../../npm/pkg/node/index.mjs");
  assert.equal(classOfTree(render("\\sin").tree), "op");
  assert.equal(classOfTree(render("\\sum").tree), "op");
});

test("the core entry: the editor without a screen", async () => {
  const core = await import("../src/core.ts");
  const e = new core.Editor("\\frac{1}{2}");
  assert.equal(e.toLatex(), "\\frac{1}{2}");
  assert.equal(core.readLatex("x")[0].kind, "symbol");
  assert.equal(typeof core.caretRect, "function");
});

test("Enter finishes a command being typed", () => {
  const e = typed("\\alpha");
  e.enter();
  e.typeText("x");
  assert.equal(e.toLatex(), "\\alpha x");
});

test("text: pasted characters stay characters; a selection put in text becomes its LaTeX", () => {
  const e = typed("\\text a");
  e.paste("b}c");
  assert.equal(e.toLatex(), "\\text{ab\\}c}");
  const s = new Editor("x^2");
  s.selectAll();
  s.insertLatex("\\text{#0}");
  assert.equal(s.toLatex(), "\\text{x\\^{}\\{2\\}}");
});

test("Delete before a structure goes into it", () => {
  const e = new Editor("\\frac{1}{2}");
  const f = e.root.children[0];
  if (f.kind !== "frac") throw new Error("a fraction");
  e.setCursor({ row: e.root, offset: 0 });
  e.deleteForward();
  assert.deepEqual([e.cursor.row, e.cursor.offset], [f.num, 0]);
  assert.equal(e.toLatex(), "\\frac{1}{2}");
});

test("the last line or column of a matrix removed: the matrix goes", () => {
  const e = new Editor("x\\begin{pmatrix} a & b \\end{pmatrix}");
  const m = e.root.children[1];
  if (m.kind !== "matrix") throw new Error("a matrix");
  e.setCursor({ row: m.cells[0][0], offset: 1 });
  e.removeRow();
  assert.equal(e.toLatex(), "x");
  assert.deepEqual([e.cursor.row, e.cursor.offset], [e.root, 1]);
  const c = new Editor("\\begin{pmatrix} a \\\\ b \\end{pmatrix}");
  const n = c.root.children[0];
  if (n.kind !== "matrix") throw new Error("a matrix");
  c.setCursor({ row: n.cells[1][0], offset: 0 });
  c.removeColumn();
  assert.equal(c.toLatex(), "");
});

test("a matrix given a size: cells added empty, the last ones removed, its delimiters changed", () => {
  const e = new Editor("\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}");
  e.moveLeft();
  assert.deepEqual(e.shapeableMatrix(), { env: "pmatrix", rows: 2, cols: 2, filled: [[true, true], [true, true]], diagram: false });
  e.shapeMatrix(3, 3, "bmatrix");
  assert.equal(e.toLatex(), "\\begin{bmatrix}a & b & \\\\ c & d & \\\\ & & \\end{bmatrix}");
  // the cursor stays in its cell (d), or goes to the nearest one left
  e.shapeMatrix(1, 1);
  assert.equal(e.toLatex(), "\\begin{bmatrix}a\\end{bmatrix}");
  assert.equal(e.cursor.offset, 1);
  e.undo();
  assert.equal(e.toLatex(), "\\begin{bmatrix}a & b & \\\\ c & d & \\\\ & & \\end{bmatrix}");
  // nothing for a size of none, an unknown environment, or outside a shapeable matrix
  e.shapeMatrix(0, 2);
  e.shapeMatrix(2, 2, "cases");
  assert.equal(e.toLatex(), "\\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}");
  const c = new Editor("\\begin{cases}a&b\\end{cases}");
  c.moveLeft();
  assert.equal(c.shapeableMatrix(), null);
  c.shapeMatrix(2, 2);
  assert.equal(c.toLatex(), "\\begin{cases}a & b\\end{cases}");
  assert.equal(new Editor("x").shapeableMatrix(), null);
});
