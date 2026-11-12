// Reactions (\ce) edited as pieces: species (each a formula typed as math), arrows with conditions, signs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Atom, type Reaction, type Row, type Species } from "../src/model.ts";
import { drawing } from "./drawing.ts";
import { render } from "../../npm/pkg/node/index.mjs";

const reactionOf = (e: Editor) => e.root.children.find((a) => a.kind === "reaction") as Reaction;
const same = (a: string, b: string) => JSON.stringify(drawing(render(a).svg)) === JSON.stringify(drawing(render(b).svg));

test("typing a reaction builds species, signs and an arrow", () => {
  const e = new Editor();
  e.typeText("\\ce 2H2 + O2 -> 2H2O");
  const r = reactionOf(e);
  assert.ok(r);
  assert.deepEqual(r.body.children.map((p) => p.kind), ["species", "rxtoken", "species", "rxarrow", "species"]);
  assert.equal(e.toLatex(), "\\ce{2 H2 + O2 -> 2 H2O}");
});

test("states, an arrow with conditions over and under", () => {
  const e = new Editor();
  e.typeText("\\ce CaCO3(s) ->[900 C][CO2] CaO(s)");
  assert.equal(e.toLatex(), "\\ce{CaCO3(s) ->[900 C][CO2] CaO(s)}");
});

test("a \\ce read back becomes pieces; marked draws as unmarked", () => {
  for (const src of ["\\ce{C3H8(g) + 5 O2(g) -> 3 CO2(g) + 4 H2O(l)}", "\\ce{2 NO2(g) <=> N2O4(g)}", "\\ce{CaCO3(s) ->[\\Delta] CaO(s) + CO2 ^}", "\\ce{Fe^3+ + e- -> Fe^2+}"]) {
    const e = new Editor();
    e.setLatex(src);
    assert.ok(reactionOf(e), src);
    assert.equal(e.toLatex(), src);
    e.cursor = { row: e.root, offset: e.root.children.length };
    assert.ok(same(e.toLatex(), e.toLatex({ marked: true })), `marks moved ${src}`);
    const boxes = render(e.toLatex({ marked: true })).boxes;
    assert.ok(boxes.length >= reactionOf(e).body.children.length, src);
  }
});

test("undo through a reaction", () => {
  const e = new Editor();
  e.typeText("\\ce A + B");
  e.undo();
  assert.notEqual(e.toLatex(), "\\ce{A + B}");
});

test("palette: a new reaction, then pieces into it (an arrow with conditions puts the cursor over it)", () => {
  const e = new Editor();
  e.insertLatex("\\ce{#?}");
  const r = reactionOf(e);
  assert.equal(e.cursor.row, r.body);
  e.typeText("CH4");
  e.insertLatex("\\ce{+}");
  e.typeText("2O2");
  e.insertLatex("\\ce{->[][]}");
  e.typeText("Δ");
  e.moveRight();
  e.moveRight();
  assert.equal(r.body.children.length, 4);
  e.cursor = { row: r.body, offset: r.body.children.length };
  e.typeText("CO2");
  assert.equal(e.toLatex(), "\\ce{CH4 + 2 O2 ->[Δ] CO2}");
});

test("palette buttons on a reaction: a sign with a new species, an arrow after it, a piece removed; a coefficient typed", () => {
  const e = new Editor("\\ce{A}");
  const r = reactionOf(e);
  const a = r.body.children[0] as Species;
  e.cursor = { row: a.formula, offset: 1 };
  e.addReactionSign("+");
  // after +, the cursor in the new species' formula; a digit first is its coefficient
  const b = r.body.children[2] as Species;
  assert.equal(e.cursor.row, b.formula);
  e.typeText("2O2");
  assert.equal(e.toLatex(), "\\ce{A + 2 O2}");
  e.addReactionSign("^");
  assert.equal(e.toLatex(), "\\ce{A + 2 O2 ^}");
  // between pieces, after a sign: a new arrow there, the cursor after it
  e.setReactionArrow("->");
  assert.equal(e.toLatex(), "\\ce{A + 2 O2 ^ ->}");
  assert.deepEqual([e.cursor.row, e.cursor.offset], [r.body, 5]);
  e.typeText("B");
  // a coefficient is typed before the formula, as written
  e.home();
  e.typeText("3");
  assert.equal(e.toLatex(), "\\ce{A + 2 O2 ^ -> 3 B}");
  // the species the cursor is in goes; the cursor where it was
  e.removeReactionPiece();
  assert.equal(e.toLatex(), "\\ce{A + 2 O2 ^ ->}");
  assert.deepEqual([e.cursor.row, e.cursor.offset], [r.body, 5]);
  // between pieces: the one before the cursor goes
  e.removeReactionPiece();
  assert.equal(e.toLatex(), "\\ce{A + 2 O2 ^}");
});

test("an arrow that could still grow (<=> before <=>>) becomes an arrow when something else follows", () => {
  const e = new Editor();
  e.typeText("\\ce A <=> B");
  assert.deepEqual(reactionOf(e).body.children.map((p) => p.kind), ["species", "rxarrow", "species"]);
  assert.equal(e.toLatex(), "\\ce{A <=> B}");
});

test("pieces selected: copied as a reaction of their own, cut, pasted back into the reaction", () => {
  const e = new Editor("\\ce{2 H2 + O2 -> 2 H2O}");
  const r = reactionOf(e);
  e.select(r.body, 0, 3);
  assert.equal(e.copy(), "\\ce{2 H2 + O2}");
  const cut = e.cut();
  assert.equal(cut, "\\ce{2 H2 + O2}");
  assert.equal(e.toLatex(), "\\ce{-> 2 H2O}");
  e.paste(cut);
  assert.equal(e.toLatex(), "\\ce{2 H2 + O2 -> 2 H2O}");
  // math pasted into a species is math: a charge joins the index before it
  e.cursor = { row: (r.body.children[2] as Species).formula, offset: 2 };
  e.paste("^{2-}");
  assert.equal(e.toLatex(), "\\ce{2 H2 + O2^2- -> 2 H2O}");
});

test("a palette's reaction pieces into a reaction: they replace the pieces selected", () => {
  const e = new Editor("\\ce{A + B}");
  const r = reactionOf(e);
  e.select(r.body, 1, 3);
  e.insertLatex("\\ce{->}");
  assert.equal(e.toLatex(), "\\ce{A ->}");
  // other math inside a piece: its LaTeX as text
  e.cursor = { row: (r.body.children[0] as Species).formula, offset: 1 };
  e.insertLatex("\\frac{#0}{#?}");
  assert.equal(e.toLatex(), "\\ce{A\\frac{}{} ->}");
});

test("what a reaction cannot hold (math between its pieces) is left out of its LaTeX", () => {
  const e = new Editor("\\ce{A}");
  const r = reactionOf(e);
  e.cursor = { row: r.body, offset: 1 };
  e.insertLatex("\\frac{a}{b}");
  assert.deepEqual(r.body.children.map((p) => p.kind), ["species", "frac"]);
  assert.equal(e.toLatex(), "\\ce{A}");
  // and from a selection of pieces put into text, the pieces have no LaTeX alone
  e.select(r.body, 0, 1);
  e.insertLatex("\\text{#0}");
  assert.equal(e.toLatex(), "\\ce{}");
});

test("a species is typed as math: an index after an element, a charge after ^, _ and ^ as anywhere", () => {
  const typed = (text: string) => {
    const e = new Editor();
    e.typeText(`\\ce ${text}`);
    return e.toLatex();
  };
  // a number after an element or a closing is its index; a letter goes on after it
  assert.equal(typed("2H2O(l)"), "\\ce{2 H2O(l)}");
  assert.equal(typed("Ca(OH)2"), "\\ce{Ca(OH)2}");
  // _ and ^ as in math; a charge stays whole over the index
  assert.equal(typed("H_2O"), "\\ce{H2O}");
  assert.equal(typed("SO4^2-"), "\\ce{SO4^2-}");
  assert.equal(typed("SO_4^{2-}"), "\\ce{SO4^2-}");
  assert.equal(typed("Fe^3+ + e-"), "\\ce{Fe^3+ + e-}");
  // after a charge, a letter goes on beside it
  assert.equal(typed("Na^+Cl"), "\\ce{Na^+Cl}");
  // a space ends the species, from its index too; -> right after it is an arrow
  assert.equal(typed("O2 + H2->H2O"), "\\ce{O2 + H2 -> H2O}");
  assert.equal(typed("A<=>B"), "\\ce{A <=> B}");
  // words and composed signs are not read in chemistry: Sn stays, <= is not ≤
  assert.equal(typed("Pi"), "\\ce{Pi}");
  // the drawing is mhchem's: marked draws as plain
  const e = new Editor();
  e.typeText("\\ce 2H2O(l) + SO4^2-");
  e.cursor = { row: e.root, offset: e.root.children.length };
  assert.ok(same(e.toLatex(), e.toLatex({ marked: true })));
});

test("a species read: commands and $…$ kept as math; math put over an arrow is its text", async () => {
  const { chemToLatex } = await import("../src/reaction.ts");
  assert.equal(chemToLatex("\\alpha2"), "\\alpha _{2}");
  assert.equal(chemToLatex("$x$2"), "x_{2}");
  assert.equal(chemToLatex("$x"), "x");
  assert.equal(chemToLatex("X_a^{+}"), "X_{a}^{+}");
  const e = new Editor("\\ce{A ->[] B}");
  e.setCursor({ row: reactionOf(e).body, offset: 1 });
  e.enterReactionPlace("above");
  e.insertLatex("\\Delta");
  assert.equal(e.toLatex(), "\\ce{A ->[\\Delta] B}");
});

test("the cursor in a species, placed by each piece's width: an index low, a charge high, a structure inside", async () => {
  const { atomRect, rowRect } = await import("../src/geometry.ts");
  const { boxesById } = await import("../src/geometry.ts");
  const e = new Editor();
  e.typeText("\\ce SO4^2- + (NH4)2");
  e.typeText(" + X");
  e.insertLatex("\\frac{1}{2}");
  e.insertLatex("^{}");
  const boxes = boxesById(render(e.toLatex({ marked: true })).boxes as never);
  const r = reactionOf(e);
  const so4 = r.body.children[0] as Species;
  const [s, , scripts] = so4.formula.children as never as Atom[];
  const S = atomRect(s, boxes)!;
  const sc = atomRect(scripts, boxes)!;
  assert.ok(sc.x > S.x + S.width - 1, "the index and charge after S and O");
  const sup = rowRect((scripts as never as { sup: Row }).sup, boxes)!;
  const sub = rowRect((scripts as never as { sub: Row }).sub, boxes)!;
  assert.ok(sup.y < sub.y, "the charge over the index");
  // inside parentheses, between them
  const nh4 = r.body.children[2] as Species;
  const paren = nh4.formula.children[0];
  assert.equal(paren.kind, "delim");
  const inside = rowRect((paren as never as { body: Row }).body, boxes)!;
  const whole = atomRect(paren, boxes)!;
  assert.ok(inside.x > whole.x && inside.x + inside.width < whole.x + whole.width);
  // a fraction in a species has a width too; an empty exponent after it, a place
  const x = r.body.children[4] as Species;
  assert.ok(atomRect(x.formula.children[1], boxes)!.width > 0);
  assert.ok(rowRect(e.cursor.row, boxes));
});

test("isotopes keep their numbers as written; a coefficient before an electron keeps its space", () => {
  for (const src of ["\\ce{^{238}_{92}U -> ^{234}_{90}Th + ^{4}_{2}He}", "\\ce{MnO4- + 8 H+ + 5 e- -> Mn^2+ + 4 H2O}"]) assert.equal(new Editor(src).toLatex(), src);
});

test("edited as LaTeX from inside a species: undo goes back to the pieces; cancel keeps them pieces", () => {
  const e = new Editor("\\ce{SO4^2-}");
  e.cursor = { row: (reactionOf(e).body.children[0] as Species).formula, offset: 2 };
  const session = e.editBlock(e.toBlock(reactionOf(e))!);
  session.update("\\ce{SO4^2- + Ba^2+}");
  session.commit();
  assert.equal(e.toLatex(), "\\ce{SO4^2- + Ba^2+}");
  e.undo();
  assert.equal(e.toLatex(), "\\ce{SO4^2-}");
  assert.ok(reactionOf(e));
  e.typeText("x");
  // and the editor goes on: what is typed shows
  assert.match(e.toLatex(), /x/);
  // cancelled: the reaction is pieces again, the cursor where it was
  const c = new Editor("\\ce{A -> B}");
  const cancel = c.editBlock(c.toBlock(reactionOf(c))!);
  cancel.update("\\ce{A}");
  cancel.cancel();
  assert.equal(c.toLatex(), "\\ce{A -> B}");
  assert.ok(reactionOf(c));
});

test("found by using it: signs after an index, hydrates, gases, pasting an index, palette pieces, + from an arrow's conditions", () => {
  const typed = (text: string) => {
    const e = new Editor();
    e.typeText(`\\ce ${text}`);
    return e.toLatex();
  };
  // a sign or a dot after an index is beside it, not in it; a slash is a coefficient's; a star a hydrate's dot
  assert.equal(typed("NH4+"), "\\ce{NH4+}");
  assert.equal(typed("CH3-CH3"), "\\ce{CH3-CH3}");
  assert.equal(typed("CuSO4*5H2O"), "\\ce{CuSO4*5H2O}");
  assert.equal(typed("CuSO4.5H2O"), "\\ce{CuSO4.5H2O}");
  assert.equal(typed("1/2O2"), "\\ce{1/2 O2}");
  // ^ with nothing after it: a gas
  assert.equal(typed("CO2^"), "\\ce{CO2 ^}");
  // an index cut and pasted back joins its element
  const e = new Editor("\\ce{2 H2 + O2 -> 2 H2O}");
  const water = reactionOf(e).body.children[4] as Species;
  e.select(water.formula, 1, 2);
  e.paste(e.cut());
  assert.equal(e.toLatex(), "\\ce{2 H2 + O2 -> 2 H2O}");
  // a species from a palette: typing goes on inside the reaction; an arrow with conditions: over it
  const w = new Editor();
  w.insertLatex("\\ce{H2O}");
  w.typeText(" + CO2");
  assert.equal(w.toLatex(), "\\ce{H2O + CO2}");
  const a = new Editor();
  a.insertLatex("\\ce{->[][]}");
  a.typeText("cat");
  assert.equal(a.toLatex(), "\\ce{->[cat]}");
  // + from an arrow's conditions: after what the arrow leads to
  const p = new Editor("\\ce{A ->[x] B}");
  p.setCursor({ row: reactionOf(p).body, offset: 1 });
  p.enterReactionPlace("above");
  p.addReactionSign("+");
  p.typeText("C");
  assert.equal(p.toLatex(), "\\ce{A ->[x] B + C}");
  // a scheme put into a reaction goes beside it, whole
  const s = new Editor("\\ce{A -> B}");
  s.setCursor({ row: reactionOf(s).body, offset: 1 });
  s.insertLatex("\\schemestart \\chemfig{X} \\arrow{->} \\chemfig{Y} \\schemestop");
  assert.equal(s.toLatex(), "\\ce{A -> B}\\schemestart \\chemfig{X} \\arrow{->} \\chemfig{Y} \\schemestop");
  // arrows with no conditions are passed over by the arrow keys
  const n = new Editor("\\ce{A -> B}");
  n.setCursor({ row: reactionOf(n).body, offset: 2 });
  n.moveLeft();
  assert.deepEqual([n.cursor.row, n.cursor.offset], [reactionOf(n).body, 1]);
});

test("second round: commands in conditions, a species after an arrow, isotopes, removing a species, comma, up and down, Escape", () => {
  const typed = (text: string) => {
    const e = new Editor();
    e.typeText(`\\ce ${text}`);
    return e;
  };
  // a command over an arrow is its text; ] still ends the conditions
  assert.equal(typed("A ->[\\Delta] B").toLatex(), "\\ce{A ->[\\Delta] B}");
  assert.equal(typed("A ->[h\\nu] B").toLatex(), "\\ce{A ->[h\\nu] B}");
  // [ after a space following an arrow: a complex ion, not the conditions
  assert.equal(typed("Fe^3+ + 6CN- -> [Fe(CN)6]^3-").toLatex(), "\\ce{Fe^3+ + 6 CN- -> [Fe(CN)6]^3-}");
  // ^ then a number or { starts an isotope; ^ alone is still a gas
  assert.equal(typed("^{14}_{6}C -> ^{14}_{7}N + e-").toLatex(), "\\ce{^{14}_{6}C -> ^{14}_{7}N + e-}");
  assert.equal(typed("CO2 ^ + H2O").toLatex(), "\\ce{CO2 ^ + H2O}");
  // a comma ends an index
  assert.equal(typed("NH3, H2O").toLatex(), "\\ce{NH3, H2O}");
  // a species removed takes its + with it (after it, or else before it)
  const r = new Editor("\\ce{N2 + 3 H2 -> 2 NH3 + Q}");
  r.cursor = { row: (reactionOf(r).body.children[0] as Species).formula, offset: 1 };
  r.removeReactionPiece();
  assert.equal(r.toLatex(), "\\ce{3 H2 -> 2 NH3 + Q}");
  r.cursor = { row: (reactionOf(r).body.children[4] as Species).formula, offset: 1 };
  r.removeReactionPiece();
  assert.equal(r.toLatex(), "\\ce{3 H2 -> 2 NH3}");
  // down from over an arrow to under it, and back up
  const a = typed("A ->[x");
  a.moveDown();
  a.typeText("y");
  a.moveUp();
  a.typeText("z");
  assert.equal(a.toLatex(), "\\ce{A ->[xz][y]}");
  // into an arrow with only conditions over it: there, not the empty place under it
  const b = new Editor("\\ce{A ->[x] B}");
  b.setCursor({ row: reactionOf(b).body, offset: 2 });
  b.moveLeft();
  assert.equal(b.cursor.row, (reactionOf(b).body.children[1] as never as { above: unknown }).above as never);
  // Escape: out of the reaction, after it
  b.leaveReaction();
  assert.deepEqual([b.cursor.row, b.cursor.offset], [b.root, 1]);
  b.leaveReaction();
});
