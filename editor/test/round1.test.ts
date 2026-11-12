// Round 1: the quadratic formula built from the keyboard (and with one palette button), checked
// against mathra's own boxes at every key, not by eye.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Cursor } from "../src/model.ts";
import { boxesById, caretRect, cursorAt, rowRect, type Box } from "../src/geometry.ts";
// the package built from this checkout (npm/build.sh), which returns `boxes`
import { render } from "../../npm/pkg/node/index.mjs";

const TARGET = String.raw`x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}`;

type Step = (e: Editor) => void;
const keys = (text: string): Step[] => [...text].map((ch) => (e: Editor) => e.type(ch));
const right: Step = (e) => e.moveRight();
const down: Step = (e) => e.moveDown();
const button = (t: Parameters<Editor["insert"]>[0]): Step => (e) => e.insert(t);

/** With the fraction button. */
const WITH_BUTTON: Step[] = [...keys("x="), button("frac"), ...keys("-b\\pm \\sqrt b^2"), right, ...keys("-4ac"), down, ...keys("2a")];
/** Keyboard only: `/` after `=` opens an empty fraction. */
const KEYBOARD: Step[] = [...keys("x=/-b\\pm \\sqrt b^2"), right, ...keys("-4ac"), down, ...keys("2a")];

/** What the SVG draws, ids and metadata left out: two equal lists draw the same picture. */
function drawing(svg: string): string[] {
  return (svg.match(/<(use|rect)\b[^>]*>/g) ?? []).map((t) => t.replace(/#mathra-[0-9a-f]+-/, "#").replace(/\s+data-[a-z-]+="[^"]*"/g, ""));
}

function frame(e: Editor) {
  const r = render(e.toLatex({ marked: true }));
  return { r, boxes: boxesById(r.boxes as Box[]) };
}

function check(steps: Step[], name: string) {
  const e = new Editor();
  let last: { cursor: Cursor; x: number } | null = null;
  steps.forEach((step, i) => {
    step(e);
    const { r, boxes } = frame(e);
    assert.equal(r.warnings.length, 0, `${name} step ${i}: ${JSON.stringify(r.warnings)} for ${e.toLatex({ marked: true })}`);
    const caret = caretRect(e.cursor, boxes);
    const row = rowRect(e.cursor.row, boxes);
    assert.ok(caret && row, `${name} step ${i}: no caret or row box`);
    const mid = caret.x + caret.width / 2;
    assert.ok(mid >= row.x - 1 && mid <= row.x + row.width + 1, `${name} step ${i}: caret at ${mid} outside its row [${row.x}, ${row.x + row.width}]`);
    assert.ok(caret.y < row.y + row.height && caret.y + caret.height > row.y, `${name} step ${i}: caret not level with its row`);
    // typing in the same row moves the cursor right
    if (last && last.cursor.row === e.cursor.row && e.cursor.offset === last.cursor.offset + 1) assert.ok(mid > last.x, `${name} step ${i}: caret did not move right`);
    last = { cursor: { ...e.cursor }, x: mid };
  });
  return e;
}

for (const [name, steps] of [["button", WITH_BUTTON], ["keyboard", KEYBOARD]] as const) {
  test(`the quadratic formula, ${name}: the caret is in its row at every key`, () => {
    check(steps, name);
  });

  test(`the quadratic formula, ${name}: draws exactly the target`, () => {
    const e = check(steps, name);
    const plain = e.toLatex();
    assert.deepEqual(drawing(render(plain).svg), drawing(render(TARGET).svg), `${plain} does not draw as ${TARGET}`);
    // and the marked LaTeX, which the editor shows, draws the same as the plain one
    assert.deepEqual(drawing(render(e.toLatex({ marked: true })).svg), drawing(render(plain).svg));
  });
}

test("a click inside the denominator puts the cursor there, before the atom whose middle is right of it", () => {
  const e = new Editor();
  for (const s of WITH_BUTTON) s(e);
  const { boxes } = frame(e);
  const frac = e.root.children.find((a) => a.kind === "frac")!;
  if (frac.kind !== "frac") throw new Error();
  const two = boxes.get(frac.den.children[0].id)!;
  // the left quarter of "2": before it; the right quarter: after it
  const y = two.y + two.height / 2;
  assert.deepEqual(cursorAt(e, boxes, two.x + two.width * 0.25, y), { row: frac.den, offset: 0 });
  assert.deepEqual(cursorAt(e, boxes, two.x + two.width * 0.75, y), { row: frac.den, offset: 1 });
  // a click left of everything: the start of the formula
  assert.deepEqual(cursorAt(e, boxes, -100, 0), { row: e.root, offset: 0 });
});

test("time per key: LaTeX, mathra and the caret, p95 under 16 ms (Node)", () => {
  const times: number[] = [];
  for (let run = 0; run < 30; run++) {
    const e = new Editor();
    for (const s of WITH_BUTTON) {
      const t0 = performance.now();
      s(e);
      const { boxes } = frame(e);
      caretRect(e.cursor, boxes);
      times.push(performance.now() - t0);
    }
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`per key: p50 ${times[Math.floor(times.length / 2)].toFixed(3)} ms, p95 ${p95.toFixed(3)} ms over ${times.length} keys`);
  assert.ok(p95 < 16);
});
