// Where things are drawn when they carry no mark of their own: empty cells of a diagram, arrows of a scheme.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Diagram, type Reaction } from "../src/model.ts";
import { atomRect, boxesById, cellRect, rowRect, type Box } from "../src/geometry.ts";
import { render } from "../../npm/pkg/node/index.mjs";

const drawn = (e: Editor) => {
  // the cursor outside, so empty cells are not marked
  e.cursor = { row: e.root, offset: e.root.children.length };
  return boxesById(render(e.toLatex({ marked: true })).boxes as Box[]);
};
const centre = (r: { x: number; width: number }) => r.x + r.width / 2;

test("an empty column between two others: in step with them", () => {
  const e = new Editor("\\begin{tikzcd} A & & C \\\\ D & & F \\end{tikzcd}");
  const d = e.root.children[0] as Diagram;
  const boxes = drawn(e);
  const a = rowRect(d.cells[0][0], boxes)!;
  const c = rowRect(d.cells[0][2], boxes)!;
  const mid = cellRect(d, 0, 1, boxes)!;
  assert.equal(centre(mid), (centre(a) + centre(c)) / 2);
  // its line's height: the middle of the cells known in it
  assert.equal(mid.y + mid.height / 2, (a.y + a.height / 2 + c.y + c.height / 2) / 2);
});

test("an empty column beside one known: tikz-cd's spacing from it", () => {
  const e = new Editor("\\begin{tikzcd} A & \\\\ C & \\end{tikzcd}");
  const d = e.root.children[0] as Diagram;
  const boxes = drawn(e);
  const c = rowRect(d.cells[1][0], boxes)!;
  const r = cellRect(d, 1, 1, boxes)!;
  assert.equal(centre(r), centre(c) + 2400);
  assert.equal(r.y + r.height / 2, c.y + c.height / 2);
});

test("a scheme's arrow with nothing drawn before it: from its labels, or an arrow's usual length", () => {
  const e = new Editor("\\schemestart \\+ \\arrow{->[heat]} \\chemfig{B} \\schemestop");
  const s = e.root.children[0] as Reaction;
  const [, arrow, b] = s.body.children;
  if (arrow.kind !== "rxarrow") throw new Error("an arrow");
  const box = (id: string, x: number, width: number): [string, Box] => [id, { attributes: { "data-m": id }, x, y: -600, width, height: 700, baseline: 0 }];
  const structure = box(`${b.id}a0`, 2000, 600);
  // its label drawn: from the label's left edge to the structure
  const labelled = atomRect(arrow, new Map([structure, box(arrow.above.id, 500, 1000)]));
  assert.deepEqual(labelled, { x: 500, y: -600, width: 1500, height: 700 });
  // nothing but the structure: the usual length before it
  const bare = atomRect(arrow, new Map([structure]));
  assert.deepEqual(bare, { x: 400, y: -600, width: 1600, height: 700 });
});

test("a cell drawn without its own box (its mark dropped): where its atoms are", () => {
  const e = new Editor("\\begin{tikzcd} A & B \\end{tikzcd}");
  const d = e.root.children[0] as Diagram;
  const boxes = drawn(e);
  const b = d.cells[0][1];
  const own = boxes.get(b.id)!;
  boxes.delete(b.id);
  const r = cellRect(d, 0, 1, boxes)!;
  assert.ok(Math.abs(centre(r) - centre(own)) < own.width);
});

test("an empty cell, not marked (the cursor elsewhere): its row is where its column and line are", () => {
  const e = new Editor("\\begin{tikzcd} A & B \\\\ C & \\end{tikzcd}");
  const d = e.root.children[0] as Diagram;
  const boxes = drawn(e);
  const empty = rowRect(d.cells[1][1], boxes)!;
  const b = rowRect(d.cells[0][1], boxes)!;
  const c = rowRect(d.cells[1][0], boxes)!;
  assert.ok(Math.abs(centre(empty) - centre(b)) < b.width, "under B");
  assert.ok(empty.y > c.y - c.height && empty.y < c.y + c.height, "beside C");
  // a row that is no cell of it (an arrow's label, empty): none
  e.setCursor({ row: d.cells[0][0], offset: 1 });
  e.arrowFromCursor("right");
  const label = e.cursor.row;
  e.setCursor({ row: e.root, offset: 1 });
  assert.equal(rowRect(label, drawn(e)), null);
});

test("parallel arrows (shift left, shift right=2) each have a path of its own, apart", async () => {
  const { arrowPath } = await import("../src/geometry.ts");
  const e = new Editor('\\begin{tikzcd} A \\arrow[r, "f", shift left] \\arrow[r, "g"\', shift right=2] & B \\end{tikzcd}');
  const d = e.root.children[0] as Diagram;
  const boxes = drawn(e);
  const [f, g] = d.arrows.map((a) => arrowPath(d, a, boxes)!);
  const mid = (p: { y: number }[]) => p[5].y;
  // y grows down: the left of a rightward arrow is above it
  assert.ok(mid(f) < mid(g) - 400, `${mid(f)} ${mid(g)}`);
});
