import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inner, mathAt, mathIn, mathSpans, spanAt, type Language } from "../src/find.ts";

const texs = (text: string, language: Language = "markdown") => mathSpans(text, language).map((s) => [s.tex, s.display]);

test("the delimiters of inline and display math", () => {
  assert.deepEqual(texs("a $x^2$ b $$\\frac12$$ c \\(y\\) d \\[z\\]"), [
    ["x^2", false],
    ["\\frac12", true],
    ["y", false],
    ["z", true],
  ]);
});

test("spans take the delimiters in", () => {
  const text = "say $x$ and $$y$$";
  assert.deepEqual(
    mathSpans(text, "markdown").map((s) => text.slice(s.start, s.end)),
    ["$x$", "$$y$$"],
  );
});

test("LaTeX's display environments, drawn whole", () => {
  const text = "\\begin{align*}a&=b\\end{align*} \\begin{equation}x\\end{equation} \\begin{itemize}\\end{itemize}";
  assert.deepEqual(texs(text, "latex"), [
    ["\\begin{align*}a&=b\\end{align*}", true],
    ["\\begin{equation}x\\end{equation}", true],
  ]);
  assert.deepEqual(texs("\\begin{equation} x"), []);
});

test("dollars that are not math", () => {
  // money, spaces inside, a blank line, escapes, nothing inside, never closed
  assert.deepEqual(texs("costs $5 and $6 today"), []);
  assert.deepEqual(texs("$ x$ and $x $"), []);
  assert.deepEqual(texs("$a\n\nb$"), []);
  assert.deepEqual(texs("\\$x\\$"), []);
  assert.deepEqual(texs("$$ $$"), []);
  assert.deepEqual(texs("$$x"), []);
  assert.deepEqual(texs("$x"), []);
  assert.deepEqual(texs("\\[x"), []);
  // a digit after the closing dollar is text in Markdown, not in LaTeX
  assert.deepEqual(texs("$x$5", "latex"), [["x", false]]);
});

test("an escaped delimiter inside does not close", () => {
  assert.deepEqual(texs("$a\\$b$"), [["a\\$b", false]]);
  assert.deepEqual(texs("\\[a \\\\] b\\]"), [["a \\\\] b", true]]);
});

test("Markdown code is skipped, except ```math blocks", () => {
  assert.deepEqual(texs("`$x$` and ``a ` $y$`` then $z$"), [["z", false]]);
  assert.deepEqual(texs("``never closed $x$"), [["x", false]]);
  assert.deepEqual(texs("```\n$x$\n```\n$y$"), [["y", false]]);
  assert.deepEqual(texs("text\n```math\na^2\n```\n"), [["a^2\n", true]]);
  // a fence never closed runs to the end; an empty one is not math
  assert.deepEqual(texs("```math\nb\n$c$"), [["b\n$c$", true]]);
  assert.deepEqual(texs("```math\n```"), []);
  assert.deepEqual(texs("```math"), []);
  // backticks in the middle of a line are inline code, however many
  assert.deepEqual(texs("a ```$x$``` b"), []);
  // in LaTeX backticks are quotes
  assert.deepEqual(texs("``quoted'' $x$", "latex"), [["x", false]]);
});

test("LaTeX comments are skipped", () => {
  assert.deepEqual(texs("% $x$\n$y$ % $z$", "latex"), [["y", false]]);
  assert.deepEqual(texs("50% of $x$"), [["x", false]]);
});

test("spanAt reads only what starts where it is asked", () => {
  assert.equal(spanAt("a$x$", 0, "markdown"), undefined);
  assert.equal(spanAt("$x$", 0, "markdown")?.tex, "x");
});

test("mathAt finds the math around an offset, delimiters included", () => {
  const text = "a $x$ b";
  assert.equal(mathAt(text, 2, "markdown")?.tex, "x");
  assert.equal(mathAt(text, 5, "markdown")?.tex, "x");
  assert.equal(mathAt(text, 0, "markdown"), undefined);
  assert.equal(mathAt(text, 6, "markdown"), undefined);
});

test("mathIn: a selection of one equation, or the selection as LaTeX", () => {
  assert.deepEqual(mathIn("  $x$ ", "markdown"), { tex: "x", display: false, texStart: 3 });
  assert.deepEqual(mathIn("\\[ y \\]", "markdown"), { tex: "y", display: true, texStart: 3 });
  assert.deepEqual(mathIn(" \\frac12", "markdown"), { tex: "\\frac12", display: true, texStart: 1 });
  assert.deepEqual(mathIn("$x$ and $y$", "markdown"), { tex: "$x$ and $y$", display: true, texStart: 0 });
  assert.deepEqual(mathIn("$x$.", "markdown"), { tex: "$x$.", display: true, texStart: 0 });
  assert.equal(mathIn("  \n", "markdown"), undefined);
});

test("inner: where the LaTeX of a span is, without its spaces", () => {
  const text = "a $$ x $$ and \\begin{equation}y\\end{equation}";
  const [display, env] = mathSpans(text, "latex");
  assert.deepEqual(inner(text, display), { tex: "x", start: 5 });
  assert.deepEqual(inner(text, env), { tex: env.tex, start: 14 });
});
