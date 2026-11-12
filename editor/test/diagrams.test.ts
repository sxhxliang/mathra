// Diagrams edited as boxes: cells, arrows made from the keyboard, their styles and labels.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Diagram } from "../src/model.ts";
import { readDiagram, writeDiagram } from "../src/diagram.ts";

const diagramOf = (e: Editor) => e.root.children.find((a) => a.kind === "diagram") as Diagram;

test("\\tikzcd typed: one empty cell, the cursor in it", () => {
  const e = new Editor();
  e.typeText("\\tikzcd ");
  const d = diagramOf(e);
  assert.ok(d);
  assert.equal(e.cursor.row, d.cells[0][0]);
});

test("Alt+arrow from a cell: an arrow to the neighbour, the grid grows at the edge, the cursor in the label", () => {
  const e = new Editor();
  e.typeText("\\tikzcd A");
  e.arrowFromCursor("right");
  e.typeText("f");
  const d = diagramOf(e);
  assert.equal(d.cells[0].length, 2);
  assert.equal(e.toLatex(), '\\begin{tikzcd}A \\arrow[r, "f"] & {}\\end{tikzcd}');
  // into the new cell: right from the label goes to the arrow's target
  e.moveRight();
  e.typeText("B");
  e.arrowFromCursor("down", "dashed");
  e.typeText("g");
  assert.equal(d.cells.length, 2);
  assert.equal(e.toLatex(), '\\begin{tikzcd}A \\arrow[r, "f"] & B \\arrow[d, "g", dashed] \\\\ & {}\\end{tikzcd}');
  // up from the top line adds a line above: the arrows follow their cells
  e.moveLeft();
  e.moveLeft();
  e.arrowFromCursor("up");
  assert.equal(d.cells.length, 3);
  assert.deepEqual(d.arrows.map((a) => [a.from, a.to]), [[[1, 0], [1, 1]], [[1, 1], [2, 1]], [[1, 1], [0, 1]]]);
});

test("an arrow's style, bend and label side; Backspace in its empty label takes it away", () => {
  const e = new Editor('\\begin{tikzcd} A \\arrow[r, "f"] & B \\end{tikzcd}');
  const d = diagramOf(e);
  e.selectArrow(d, 0);
  assert.equal(e.arrowAtCursor()?.index, 0);
  e.setArrowStyle("hook");
  e.setArrowBend("left");
  e.swapArrowLabel();
  assert.equal(e.toLatex(), '\\begin{tikzcd}A \\arrow[r, "f"\', hook, bend left] & B\\end{tikzcd}');
  e.backspace();
  e.backspace();
  assert.equal(d.arrows.length, 0);
  assert.equal(e.toLatex(), "\\begin{tikzcd}A & B\\end{tikzcd}");
});

test("amscd stays amscd while it can; a diagonal arrow makes it tikz-cd", () => {
  const e = new Editor("\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>k>> D \\end{CD}");
  assert.equal(e.toLatex(), "\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>k>> D \\end{CD}");
  const d = diagramOf(e);
  e.addArrow(d, [0, 0], [1, 1]);
  assert.match(e.toLatex(), /^\\begin\{tikzcd\}/);
});

test("lines and columns added or removed: the arrows follow, or go with them", () => {
  const e = new Editor("\\begin{tikzcd} A \\arrow[r] & B \\arrow[d] \\\\ & C \\end{tikzcd}");
  const d = diagramOf(e);
  e.setCursor({ row: d.cells[0][0], offset: 1 });
  e.addColumn();
  assert.deepEqual(d.arrows.map((a) => [a.from, a.to]), [[[0, 0], [0, 2]], [[0, 2], [1, 2]]]);
  e.setCursor({ row: d.cells[1][2], offset: 1 });
  e.removeRow();
  assert.deepEqual(d.arrows.map((a) => [a.from, a.to]), [[[0, 0], [0, 2]]]);
});

test("xymatrix and tikz-cd read and written back the same", () => {
  for (const latex of ["\\xymatrix{A \\ar@{^{(}->}[r]^{\\iota} \\ar[d]_{\\alpha} & B \\ar@{->>}[d] \\\\ C \\ar@{=}[r] & D}", '\\begin{tikzcd}T \\arrow[dr, "\\exists!" description, dashed] & \\\\ & P\\end{tikzcd}']) {
    const d = readDiagram(latex)!;
    assert.equal(writeDiagram(d, (c) => c, (l) => l).replace(/\s+/g, ""), latex.replace(/\s+/g, ""));
  }
});

test("moving: right from a cell to the next cell, down to the cell below, out at the end", () => {
  const e = new Editor("\\begin{tikzcd} A & B \\\\ C & D \\end{tikzcd}x");
  const d = diagramOf(e);
  e.setCursor({ row: d.cells[0][0], offset: 1 });
  e.moveRight();
  assert.equal(e.cursor.row, d.cells[0][1]);
  e.moveDown();
  assert.equal(e.cursor.row, d.cells[1][1]);
  e.end();
  e.moveRight();
  assert.equal(e.cursor.row, e.root);
});

test("Alt+left from the first column adds a column before it", () => {
  const e = new Editor("\\begin{tikzcd} A \\end{tikzcd}");
  const d = diagramOf(e);
  e.setCursor({ row: d.cells[0][0], offset: 1 });
  e.arrowFromCursor("left");
  assert.equal(e.toLatex(), "\\begin{tikzcd}{} & A \\arrow[l]\\end{tikzcd}");
});

test("Delete at the end of a label leaves it; Backspace in a new empty diagram takes it away", () => {
  const e = new Editor('\\begin{tikzcd} A \\arrow[r, "f"] & B \\end{tikzcd}');
  const d = diagramOf(e);
  e.selectArrow(d, 0);
  assert.deepEqual([e.cursor.row, e.cursor.offset], [d.arrows[0].label, 1]);
  e.deleteForward();
  assert.equal(e.cursor.row, d.cells[0][1]);
  assert.equal(e.toLatex(), '\\begin{tikzcd}A \\arrow[r, "f"] & B\\end{tikzcd}');
  const f = new Editor();
  f.typeText("\\tikzcd ");
  f.backspace();
  assert.equal(f.toLatex(), "");
  assert.deepEqual([f.cursor.row, f.cursor.offset], [f.root, 0]);
});

test("read back the same: amscd's arrows in every direction, braces and commands in its cells", () => {
  const same = (latex: string) => writeDiagram(readDiagram(latex)!, (c) => c, (l) => l);
  const back = "\\begin{CD} A @<f<g< B \\\\ @AaAbA @| \\\\ C @= D \\end{CD}";
  assert.equal(same(back), back);
  // tikz-cd's usual side is the left of the way the arrow goes: below a leftward arrow (g), left of an upward one (a)
  assert.deepEqual(readDiagram(back)!.arrows.slice(0, 2).map((a) => [a.from, a.to, a.label, a.swapLabel]), [[[0, 1], [0, 0], "g", "f"], [[1, 0], [0, 0], "a", "b"]]);
  // a downward arrow: its left label is the swapped one (right of the way it goes is the usual side)
  assert.deepEqual(readDiagram("\\begin{CD} A \\\\ @VgVhV \\\\ B \\end{CD}")!.arrows.map((a) => [a.label, a.swapLabel]), [["h", "g"]]);
  const groups = "\\begin{CD} \\alpha @>{f_{1}}>> {B} \\\\ @. @VVV \\\\ C @. D \\end{CD}";
  assert.equal(same(groups), groups);
  // a group never closed: beyond what the editor reads
  assert.equal(readDiagram("\\begin{CD} {A @>>> B \\end{CD}"), null);
});

test("read back the same: xymatrix's bends and labels of one token", () => {
  const d = readDiagram("\\xymatrix{A \\ar@/^/[r]^\\alpha_f & B \\ar@/_/[l]}")!;
  assert.deepEqual(d.arrows.map((a) => [a.bend, a.label, a.swapLabel]), [["left", "\\alpha", "f"], ["right", null, null]]);
  assert.equal(writeDiagram(d, (c) => c, (l) => l), "\\xymatrix{A \\ar@/^/[r]^{\\alpha}_{f} & B \\ar@/_/[l]}");
});

test("tikz-cd: a second label on one side kept as written; options on the diagram kept; a bracket never closed, a block", () => {
  const d = readDiagram('\\begin{tikzcd} A \\arrow[r, "f", "g"] & B \\end{tikzcd}')!;
  assert.deepEqual([d.arrows[0].label, d.arrows[0].extra], ["f", ['"g"']]);
  assert.equal(writeDiagram(d, (c) => c, (l) => l), '\\begin{tikzcd}A \\arrow[r, "f", "g"] & B\\end{tikzcd}');
  // the diagram's options are kept as written, and the diagram is edited in cells
  const o = readDiagram("\\begin{tikzcd}[sep=large] A \\end{tikzcd}")!;
  assert.equal(o.options, "[sep=large]");
  assert.equal(writeDiagram(o, (c) => c, (l) => l), "\\begin{tikzcd}[sep=large]A\\end{tikzcd}");
  assert.equal(readDiagram("\\begin{tikzcd} A \\arrow[r & B \\end{tikzcd}"), null);
});

test("Backspace at the start of a cell goes to the cell before", () => {
  const e = new Editor("\\begin{tikzcd} A & B \\end{tikzcd}");
  const d = diagramOf(e);
  e.setCursor({ row: d.cells[0][1], offset: 0 });
  e.backspace();
  assert.deepEqual([e.cursor.row, e.cursor.offset], [d.cells[0][0], 1]);
  assert.equal(e.toLatex(), "\\begin{tikzcd}A & B\\end{tikzcd}");
});

test("amscd made tikz-cd (a style amscd has not): each label stays on its side", async () => {
  const { Editor } = await import("../src/model.ts");
  const e = new Editor("\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>>k> D \\end{CD}");
  const d = e.root.children[0] as never as { arrows: { style: string }[] };
  d.arrows[0].style = "dashed";
  assert.equal(e.toLatex(), '\\begin{tikzcd}A \\arrow[r, "f", dashed] \\arrow[d, "g"\'] & B \\arrow[d, "h"] \\\\ C \\arrow[r, "k"\'] & D\\end{tikzcd}');
});

test("found by using it: drawn to a new neighbour (diagonals too), empty lines go, Tab skips labels, Escape leaves a label", async () => {
  const { Editor } = await import("../src/model.ts");
  const d0 = (e: InstanceType<typeof Editor>) => e.root.children[0] as never as { cells: { children: unknown[] }[][]; arrows: { from: number[]; to: number[] }[] };
  // a drag past the cells: a new cell one step that way, the grid growing on that side
  const e = new Editor("\\begin{tikzcd}A & B\\end{tikzcd}");
  e.arrowToNeighbour(d0(e) as never, [0, 1], 1, 1);
  e.typeText("h");
  assert.equal(e.toLatex(), '\\begin{tikzcd}A & B \\arrow[dr, "h"] & \\\\ & & {}\\end{tikzcd}');
  e.arrowToNeighbour(d0(e) as never, [0, 0], -1, -1);
  assert.equal(d0(e).cells.length, 3);
  assert.equal(d0(e).cells[0].length, 4);
  e.arrowToNeighbour(d0(e) as never, [0, 0], 0, 0);
  // Escape from a label (an index inside it too) goes back to the cell the arrow leaves
  e.typeText("f_1");
  assert.ok(e.arrowAtCursor());
  e.leaveArrowLabel();
  assert.equal(e.cursor.row, d0(e).cells[1][1] as never);
  e.leaveArrowLabel();
  // Backspace in a label left empty: the arrow goes, and the cell made for it with its line and column
  const g = new Editor("\\begin{tikzcd}A\\end{tikzcd}");
  g.setCursor({ row: d0(g).cells[0][0] as never, offset: 1 });
  g.arrowFromCursor("right");
  g.backspace();
  assert.equal(g.toLatex(), "\\begin{tikzcd}A\\end{tikzcd}");
  // Backspace in an empty cell: its empty column goes (the cursor to the left), then an empty line (the cursor above)
  const h = new Editor("\\begin{tikzcd}A & & B \\\\ & & \\end{tikzcd}");
  h.setCursor({ row: d0(h).cells[0][1] as never, offset: 0 });
  h.backspace();
  assert.equal(h.toLatex(), "\\begin{tikzcd}A & B \\\\ &\\end{tikzcd}");
  assert.equal(h.cursor.row, d0(h).cells[0][0] as never);
  h.setCursor({ row: d0(h).cells[1][0] as never, offset: 0 });
  h.backspace();
  assert.equal(h.toLatex(), "\\begin{tikzcd}A & B\\end{tikzcd}");
  // nothing goes where an arrow reaches, or something is: the cursor moves on
  const k = new Editor("\\begin{tikzcd}A \\arrow[d] \\\\ {}\\end{tikzcd}");
  k.setCursor({ row: d0(k).cells[1][0] as never, offset: 0 });
  k.backspace();
  assert.equal(k.toLatex(), "\\begin{tikzcd}A \\arrow[d] \\\\ {}\\end{tikzcd}");
  // Tab goes to the next empty cell, not to an arrow's empty label
  const t = new Editor("\\begin{tikzcd}A \\arrow[r] & B \\\\ & \\end{tikzcd}");
  t.setCursor({ row: d0(t).cells[0][0] as never, offset: 1 });
  t.arrowFromCursor("down");
  t.setCursor({ row: d0(t).cells[0][1] as never, offset: 1 });
  t.tab();
  // the next empty cell in reading order (the line below, first column), past the new arrow's empty label
  assert.equal(t.cursor.row, d0(t).cells[1][0] as never);
  // a diagram from a palette: its first object picked, typed over
  const p = new Editor();
  p.insertLatex("\\begin{tikzcd}A \\arrow[r] & B\\end{tikzcd}");
  p.typeText("X");
  assert.equal(p.toLatex(), "\\begin{tikzcd}X \\arrow[r] & B\\end{tikzcd}");
  // the grid's size for a diagram: cells added or removed, arrows to removed cells with them
  p.shapeMatrix(2, 2);
  assert.equal(p.toLatex(), "\\begin{tikzcd}X \\arrow[r] & B \\\\ &\\end{tikzcd}");
  assert.equal(p.shapeableMatrix()?.diagram, true);
  p.shapeMatrix(1, 1, "pmatrix");
  assert.equal(p.toLatex(), "\\begin{tikzcd}X\\end{tikzcd}");
});

test("an empty column beside arrows that do not touch it goes with Backspace", () => {
  const e = new Editor("\\begin{tikzcd}A \\arrow[r] & B & \\end{tikzcd}");
  e.setCursor({ row: diagramOf(e).cells[0][2], offset: 0 });
  e.backspace();
  assert.equal(e.toLatex(), "\\begin{tikzcd}A \\arrow[r] & B\\end{tikzcd}");
});

test("second round: options kept through editing; Enter at a line's end; a diagonal arrow taken back takes its line too", () => {
  const e = new Editor("\\begin{tikzcd}[row sep=small]A\\end{tikzcd}");
  e.setCursor({ row: diagramOf(e).cells[0][0], offset: 1 });
  e.arrowFromCursor("right");
  e.typeText("f");
  assert.equal(e.toLatex(), '\\begin{tikzcd}[row sep=small]A \\arrow[r, "f"] & {}\\end{tikzcd}');
  // Enter at the end of a line: the next line's first cell
  e.setCursor({ row: diagramOf(e).cells[0][1], offset: 0 });
  e.enter();
  assert.deepEqual([e.matrixAtCursor()?.i, e.matrixAtCursor()?.j], [1, 0]);
  // a diagonal arrow taken back from its empty label: its column and its line go
  const d = new Editor("\\begin{tikzcd}A\\end{tikzcd}");
  d.arrowToNeighbour(diagramOf(d), [0, 0], 1, 1);
  d.backspace();
  assert.equal(d.toLatex(), "\\begin{tikzcd}A\\end{tikzcd}");
});

test("what is no diagram is not read as one", () => {
  assert.equal(readDiagram("\\begin{matrix} A \\end{matrix}"), null);
});
