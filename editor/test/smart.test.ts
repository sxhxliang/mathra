// Typing as on a calculator: what each key sequence
// becomes with `smartTyping` on (the default), and that turning it off types every character as itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor } from "../src/model.ts";

const typed = (text: string, smart = true) => {
  const e = new Editor();
  e.smartTyping = smart;
  e.typeText(text);
  return e;
};
const latex = (text: string) => typed(text).toLatex();

test("words become what they name", () => {
  assert.equal(latex("2pir"), "2\\pi r");
  assert.equal(latex("theta+alpha"), "\\theta+\\alpha");
  assert.equal(latex("Delta x"), "\\Delta x");
  assert.equal(latex("sin(x)=cos x"), "\\sin(x)=\\cos x");
  assert.equal(latex("ln(e^x)"), "\\ln(e^{x})");
  assert.equal(latex("x->infinity"), "x\\to\\infty");
  assert.equal(latex("infty"), "\\infty");
  // the longest word the letters end with
  assert.equal(latex("beta"), "\\beta");
  assert.equal(latex("arcsin x"), "\\arcsin x");
  // a word made carries on into a longer one: \sin, then h
  assert.equal(latex("sinh x"), "\\sinh x");
  assert.equal(latex("cost"), "\\cos t");
  // but not after a space
  assert.equal(latex("sin h"), "\\sin h");
});

test("a word is read only when the letters typed are that whole word", () => {
  // inside a longer run, nothing: words of a language and products of variables stay as typed
  assert.equal(latex("point"), "point");
  assert.equal(latex("epsix"), "epsix");
  assert.equal(latex("xpi"), "xpi");
  // a space ends a word: the letters on either side are not one
  assert.equal(latex("x in A"), "x\\in A");
  assert.equal(latex("x pi"), "x\\pi");
  assert.equal(latex("2x pi"), "2x\\pi");
  // a longer word typed whole
  assert.equal(latex("epsilon"), "\\epsilon");
  assert.equal(latex("upsilon"), "\\upsilon");
});

test("words that make structures put the cursor in them", () => {
  assert.equal(latex("sqrt2"), "\\sqrt{2}");
  assert.equal(latex("cbrt8"), "\\sqrt[3]{8}");
  const n = typed("nthroot3");
  n.moveDown();
  n.typeText("x");
  assert.equal(n.toLatex(), "\\sqrt[3]{x}");
  assert.equal(latex("sumi=1"), "\\sum_{i=1}^{}");
  assert.equal(latex("prodk"), "\\prod_{k}^{}");
  assert.equal(latex("limx->0"), "\\lim_{x\\to0}");
  assert.equal(latex("int x"), "\\int x");
});

test("a word kept as letters stays letters: undone, read, or in a style", () => {
  const e = typed("p");
  e.setLatex("pi");
  e.typeText("+1");
  assert.equal(e.toLatex(), "pi+1");
  assert.equal(new Editor("\\mathrm{d}").toLatex(), "\\mathrm{d}");
  const s = new Editor("\\mathrm{}");
  s.moveLeft();
  s.typeText("pi");
  assert.equal(s.toLatex(), "\\mathrm{pi}");
});

test("two characters that make one symbol", () => {
  assert.equal(latex("x<=3"), "x\\le3");
  assert.equal(latex("y>=2"), "y\\ge2");
  assert.equal(latex("z!=1"), "z\\ne1");
  assert.equal(latex("a=>b"), "a\\Rightarrow b");
  assert.equal(latex("x=+-1"), "x=\\pm1");
  assert.equal(latex("x-+1"), "x\\mp1");
  assert.equal(latex("1,2,..."), "1,2,\\ldots");
  // a space keeps them apart: n! = 1
  assert.equal(latex("n! =1"), "n!=1");
});

test("an exponent or index that is a number or a name ends at the operator after it", () => {
  assert.equal(latex("x^2+3x-4=0"), "x^{2}+3x-4=0");
  assert.equal(latex("x^10+1"), "x^{10}+1");
  assert.equal(latex("x^-1+2"), "x^{-1}+2");
  assert.equal(latex("e^x+1"), "e^{x}+1");
  assert.equal(latex("2^n-1"), "2^{n}-1");
  assert.equal(latex("x_1+x_2"), "x_{1}+x_{2}");
  assert.equal(latex("log_2(8)"), "\\log_{2}(8)");
  assert.equal(latex("x^2(x+1)"), "x^{2}(x+1)");
  // a letter ends a number, not a name
  assert.equal(latex("H_2O"), "H_{2}O");
  assert.equal(latex("x^2y"), "x^{2}y");
  assert.equal(latex("a_ij"), "a_{ij}");
  // a sign alone is the start of the exponent; so are what is not a number or a name
  assert.equal(latex("x^-"), "x^{-}");
  // `/` after a number or a name: the power over it, as a calculator reads x^2/3
  assert.equal(latex("x^2/3"), "\\frac{x^{2}}{3}");
  assert.equal(latex("[a]^2/[b]"), "\\frac{[a]^{2}}{[b]}");
  // a fraction in an exponent, with braces
  assert.equal(latex("x^{2/3}"), "x^{\\frac{2}{3}}");
  assert.equal(latex("2^2^3"), "2^{2^{3}}");
  // limits of a large operator are not exponents
  assert.equal(latex("\\sum i=1"), "\\sum_{i=1}^{}");
});

test("`(…)` typed alone in an exponent, a root or a denominator is that place", () => {
  assert.equal(latex("e^(2x)+1"), "e^{2x}+1");
  assert.equal(latex("sqrt(x+1)+2"), "\\sqrt{x+1}+2");
  assert.equal(latex("1/(x+1)+2"), "\\frac{1}{x+1}+2");
  assert.equal(latex("(x+1)/(x-1)"), "\\frac{x+1}{x-1}");
  assert.equal(latex("x_(n+1)"), "x_{n+1}");
  // a denominator that is a number ends at `(`: (x+1) multiplies the fraction, as a calculator reads it
  assert.equal(latex("1/2(x+1)"), "\\frac{1}{2}(x+1)");
  assert.equal(latex("d/dx(x^n)"), "\\frac{d}{dx}(x^{n})");
  assert.equal(latex("e^()"), "e^{()}");
  // brackets are kept
  assert.equal(latex("e^[x]"), "e^{[x]}");
});

test("Backspace: an empty denominator takes the fraction away, a root's start takes the root off", () => {
  const f = typed("1/2");
  f.backspace();
  f.backspace();
  assert.equal(f.toLatex(), "1");
  assert.equal(f.cursor.row, f.root);
  assert.equal(f.cursor.offset, 1);
  const r = typed("sqrt(x+1)");
  // into the root, at its start
  r.moveLeft();
  r.home();
  r.backspace();
  assert.equal(r.toLatex(), "x+1");
});

test("off: every character is itself", () => {
  assert.equal(typed("2pir", false).toLatex(), "2pir");
  assert.equal(typed("x<=3", false).toLatex(), "x<=3");
  assert.equal(typed("x^2+1", false).toLatex(), "x^{2+1}");
  assert.equal(typed("(a+b)/2", false).toLatex(), "\\frac{(a+b)}{2}");
  assert.equal(typed("e^(2x)", false).toLatex(), "e^{(2x)}");
});

test("`{` in an empty place groups it, as LaTeX does; `}` leaves it", () => {
  assert.equal(latex("x^{n+1}+2"), "x^{n+1}+2");
  assert.equal(latex("a_{ij}=0"), "a_{ij}=0");
  assert.equal(latex("sqrt{x+1}+2"), "\\sqrt{x+1}+2");
  // from a numerator to the denominator, then out
  const f = typed("\\frac ");
  f.typeText("{a+b}{2}+1");
  assert.equal(f.toLatex(), "\\frac{a+b}{2}+1");
  // elsewhere, braces are drawn
  assert.equal(latex("{x}"), "\\{x\\}");
  // `}` not at the end of its group does not leave it
  const e = typed("x^{ab");
  e.moveLeft();
  e.typeText("}");
  assert.equal(e.cursor.row.parent?.kind, "scripts");
  // off: braces are drawn
  assert.equal(typed("x^{n}", false).toLatex(), "x^{\\{n\\}}");
});

test("found by using it: fractions, limits of sums and integrals, functions over a fraction", () => {
  // a denominator that is a number or a name ends at an operator or a space; 2a stays in it
  assert.equal(latex("1/2+3/4=5/4"), "\\frac{1}{2}+\\frac{3}{4}=\\frac{5}{4}");
  assert.equal(latex("1/2 + 1/3"), "\\frac{1}{2}+\\frac{1}{3}");
  assert.equal(latex("(-b+-sqrt(b^2-4ac))/(2a)"), "\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}");
  assert.equal(latex("b/2a"), "\\frac{b}{2a}");
  // a large operator's limits: _ and ^ go to them, a space or (…) ends them, { groups them
  assert.equal(latex("int_0^1 x dx"), "\\int_{0}^{1}xdx");
  assert.equal(latex("sum_(k=1)^n k"), "\\sum_{k=1}^{n}k");
  assert.equal(latex("sum_{k=1}^n k^2"), "\\sum_{k=1}^{n}k^{2}");
  assert.equal(latex("\\int_0^1 x"), "\\int_{0}^{1}x");
  assert.equal(latex("limx->0 sin(x)/x=1"), "\\lim_{x\\to0}\\frac{\\sin(x)}{x}=1");
  // from the upper limit back to the lower one; _ where the cursor is does nothing
  const s = typed("sum");
  s.typeText("_^n_k");
  assert.equal(s.toLatex(), "\\sum_{k}^{n}");
  // a function goes over the fraction with its argument; a root of a number ends at /
  assert.equal(latex("sin theta/cos theta"), "\\frac{\\sin\\theta}{\\cos\\theta}");
  assert.equal(latex("sqrt2/2"), "\\frac{\\sqrt{2}}{2}");
  // nested braces close where they were opened
  assert.equal(latex("e^{-x^2}+1"), "e^{-x^{2}}+1");
  assert.equal(latex("x^{2/3}"), "x^{\\frac{2}{3}}");
  // a function waits for its argument: a space after it does not end the place
  assert.equal(latex("1/sin x"), "\\frac{1}{\\sin x}");
});
