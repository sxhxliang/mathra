// Every formula of the corpus, read into the editor and written back, draws exactly what it drew;
// its marked LaTeX (what the field shows) draws the same; and the cursor, at every place it can be,
// sits in its row.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor, type Row } from "../src/model.ts";
import { atomRect, boxesById, caretRect, cursorAt, rowRect, type Box } from "../src/geometry.ts";
import { render } from "../../npm/pkg/node/index.mjs";
import { drawing } from "./drawing.ts";
export { drawing };

export const CORPUS = [
  String.raw`x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}`,
  String.raw`e^{i\pi} + 1 = 0`,
  String.raw`f(x) = \sin(x) + \cos^2 x`,
  String.raw`\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}`,
  String.raw`\int_0^1 x^2\,dx = \frac{1}{3}`,
  String.raw`\lim_{x \to 0} \frac{\sin x}{x} = 1`,
  String.raw`\left(\frac{a}{b}\right)^2 = \frac{a^2}{b^2}`,
  String.raw`\left|x - 1\right| \le \varepsilon`,
  String.raw`\sqrt[3]{x+1} - \sqrt{y}`,
  String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix}`,
  String.raw`\det \begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} = -2`,
  String.raw`|x| = \begin{cases} x & x \ge 0 \\ -x & x < 0 \end{cases}`,
  String.raw`\vec{v} \cdot \hat{n} = \bar{x} + \overline{AB}`,
  String.raw`\mathbf{F} = m\mathbf{a}`,
  String.raw`x \in \mathbb{R}, \quad y \in \mathbb{N}`,
  String.raw`\text{se } x > 0 \text{ então } f(x) > 0`,
  String.raw`\binom{n}{k} = \frac{n!}{k!\,(n-k)!}`,
  String.raw`a_{ij} = a_{ji}`,
  String.raw`x_1^2 + x_2^2`,
  String.raw`\prod_{k=1}^{n} k = n!`,
  String.raw`\oint_C \vec{F} \cdot d\vec{r}`,
  String.raw`\nabla \times \vec{B} = \mu_0 \vec{J}`,
  String.raw`\alpha + \beta = \gamma`,
  String.raw`\{ x \mid x > 0 \}`,
  String.raw`\langle u, v \rangle`,
  String.raw`\lfloor x \rfloor + \lceil y \rceil`,
  String.raw`P(A \cup B) = P(A) + P(B) - P(A \cap B)`,
  String.raw`\forall x \exists y : x < y`,
  String.raw`a \Rightarrow b \iff c`,
  String.raw`\log_2 8 = 3`,
  String.raw`3.14 + 2.71`,
  String.raw`\frac{\partial f}{\partial x}`,
  String.raw`\left[ \frac{1}{2} \right]`,
  String.raw`\max_{x \in S} f(x)`,
  String.raw`\operatorname{sen} x`,
  String.raw`\dfrac{1}{2} + \tfrac{1}{3}`,
  String.raw`\left\{ \frac{a}{b} \right\}`,
  String.raw`\overrightarrow{AB}`,
  String.raw`\underbrace{a+b}_{n}`,
  String.raw`\cfrac{1}{1+\cfrac{1}{2}}`,
  String.raw`\begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix}`,
  String.raw`{\color{red} x} + y`,
  String.raw`\color{blue} a + b`,
  String.raw`\textcolor{red}{x} + y`,
  String.raw`\ce{H2O}`,
  String.raw`f'(x) = 2x`,
  String.raw`\left\langle \frac{a}{2} \right\rangle`,
  String.raw`c = 3 \times 10^{8}`,
  String.raw`f''(x) + f'(x) = 0`,
  String.raw`a \not\equiv b`,
  String.raw`\operatorname*{arg\,max}_{x} f(x)`,
  String.raw`\cancelto{0}{x} + y`,
  String.raw`a \overset{?}{=} b`,
  String.raw`A \xrightarrow{\Delta} B`,
  String.raw`\ce{2H2 + O2 -> 2H2O}`,
];

const pictures = new Map<string, string[]>();
function picture(latex: string, locale: string): string[] {
  const k = `${locale}\u0000${latex}`;
  if (!pictures.has(k)) pictures.set(k, drawing(render(latex, { locale }).svg));
  return pictures.get(k)!;
}

for (const locale of ["en", "pt-BR"]) {
  test(`read and written back, each formula draws the same (${locale})`, () => {
    for (const latex of CORPUS) {
      const e = new Editor(latex);
      assert.deepEqual(picture(e.toLatex(), locale), picture(latex, locale), `${latex}\n  became ${e.toLatex()}`);
    }
  });

  test(`marked, each formula draws the same as plain (${locale})`, () => {
    for (const latex of CORPUS) {
      const e = new Editor(latex);
      e.decimalComma = locale === "pt-BR";
      const marked = e.toLatex({ marked: true });
      const r = render(marked, { locale });
      const plainWarnings = render(e.toLatex(), { locale }).warnings.length;
      assert.equal(r.warnings.length, plainWarnings, `${latex}: ${JSON.stringify(r.warnings)}`);
      assert.deepEqual(drawing(r.svg), picture(e.toLatex(), locale), `${latex}\n  marked ${marked}`);
    }
  });
}

test("at every place, the cursor sits in its row", () => {
  for (const latex of CORPUS) {
    const e = new Editor(latex);
    const boxes = boxesById(render(e.toLatex({ marked: true })).boxes as Box[]);
    for (const row of e.rows()) {
      const rb = rowRect(row, boxes);
      assert.ok(rb, `${latex}: no box for a row`);
      for (let offset = 0; offset <= row.children.length; offset++) {
        const c = caretRect({ row, offset }, boxes);
        assert.ok(c, `${latex}: no caret at ${offset}`);
        const mid = c.x + c.width / 2;
        assert.ok(mid >= rb.x - 1 && mid <= rb.x + rb.width + 1, `${latex}: caret ${offset} at ${mid}, row [${rb.x}, ${rb.x + rb.width}]`);
        assert.ok(c.height > 0 && c.y < rb.y + rb.height + 1 && c.y + c.height > rb.y - 1, `${latex}: caret ${offset} not level with its row`);
      }
    }
  }
});

test("a click on the left of a symbol puts the cursor before it, on the right after it", () => {
  let checked = 0;
  for (const latex of CORPUS) {
    const e = new Editor(latex);
    const boxes = boxesById(render(e.toLatex({ marked: true })).boxes as Box[]);
    for (const row of e.rows()) {
      row.children.forEach((a, i) => {
        if (a.kind !== "symbol" && a.kind !== "char") return;
        const b = atomRect(a, boxes);
        if (!b || b.width < 50) return;
        const y = b.y + b.height / 2;
        const before = cursorAt(e, boxes, b.x + b.width * 0.2, y);
        const after = cursorAt(e, boxes, b.x + b.width * 0.8, y);
        assert.equal(before.row, row as Row, `${latex}: click on ${a.latex ?? a} landed in another row`);
        assert.deepEqual([before.offset, after.offset], [i, i + 1], `${latex}: click on ${"latex" in a ? a.latex : a.ch}`);
        checked++;
      });
    }
  }
  assert.ok(checked > 300, `only ${checked} symbols checked`);
});
