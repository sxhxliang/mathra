// LaTeX read into the editor at its corners: braces left open or stray, starred commands, text that
// needs escapes, reactions and schemes the editor cannot take apart.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor } from "../src/model.ts";
import { readLatex } from "../src/latex.ts";
import { readReaction, readScheme } from "../src/reaction.ts";

const back = (latex: string) => new Editor(latex).toLatex();

test("a stray closing brace is skipped; one left open closes at the end", () => {
  assert.equal(back("a}b"), "ab");
  assert.equal(back("\\sqrt[3"), "\\sqrt[3]{}");
  assert.equal(back("\\textcolor{red"), "\\textcolor{red}{}");
});

test("a starred command the editor does not know takes two single tokens, as written", () => {
  assert.deepEqual(readLatex("\\dv*xt"), [{ kind: "raw", latex: "\\dv*xt" }]);
  // a letter after a command keeps its space (\alphat would be another command)
  assert.equal(back("\\dv*\\alpha t"), "\\dv*\\alpha t");
  assert.equal(back("\\dv*\\alpha 2"), "\\dv*\\alpha2");
  // fewer when the group or a script ends them
  assert.equal(back("\\dv*x^2"), "\\dv*x^{2}");
  assert.equal(back("\\dv*{x}{t}"), "\\dv*{x}{t}");
});

test("a matrix line's extra space (\\\\[2pt]) is dropped", () => {
  assert.equal(back("\\begin{pmatrix} a \\\\[2pt] b \\end{pmatrix}"), "\\begin{pmatrix}a \\\\ b\\end{pmatrix}");
});

test("characters LaTeX reserves, typed in text, written escaped and read back the same", () => {
  const e = new Editor();
  e.typeText("\\text ");
  e.typeText("\\{}#$%&_^~");
  const latex = "\\text{\\textbackslash{}\\{\\}\\#\\$\\%\\&\\_\\^{}\\~{}}";
  assert.equal(e.toLatex(), latex);
  assert.equal(back(latex), latex);
});

test("a reaction or a scheme with a bracket or a brace never closed: not taken apart", () => {
  assert.equal(readReaction("A ->[x B"), null);
  assert.equal(readScheme("\\chemfig{A"), null);
  assert.equal(new Editor("\\ce{A ->[x B}").root.children[0].kind, "raw");
});
