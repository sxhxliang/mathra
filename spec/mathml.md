# MathML output

Every conversion also writes the equation as presentation MathML: `Output::mathml` in Rust, `result.mathml` in JavaScript, `result["mathml"]` in Python and `--mathml` in the CLI. It is a separate output: the SVG does not carry it. Word, LibreOffice and Google Docs paste it as an editable equation, and browsers draw it without the wasm.

```console
$ mathra '\frac{-b \pm \sqrt{b^2-4ac}}{2a}' --mathml
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mfrac><mrow><mo>−</mo><mi>b</mi><mo>±</mo><msqrt><msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac></math>
```

It is written from the tree of meaning (`crates/core/src/output/mathml.rs`), on one line, with no indentation. `display` is `"block"` for a display equation and `"inline"` with `Options::display` false (`--inline`).

## Profile: MathML Core, intent where it adds meaning

Only the elements of [MathML Core](https://www.w3.org/TR/mathml-core/), the part of MathML that Chrome, Firefox and Safari draw: `math`, `mrow`, `mi`, `mn`, `mo`, `mtext`, `mspace`, `mfrac`, `msqrt`, `mroot`, `msub`, `msup`, `msubsup`, `munder`, `mover`, `munderover`, `mtable`, `mtr`, `mtd`, `mstyle`, `mpadded`, `mphantom`, `semantics` and `annotation`. No `menclose`, `mfenced` or content MathML. A test checks every equation of the corpus against that list.

| Tree | MathML |
|---|---|
| number | `<mn>` as the locale writes it (`3,14` in pt-BR, L-NUM-2), with the author's thousands separator (L-NUM-3) or siunitx's thin spaces; digits in another alphabet (`\mathbf{1}`, `\mathsf{1}`, `\mathtt{1}`) are Unicode's mathematical digits (`<mn>𝟏</mn>`) |
| letter | `<mi>`: MathML Core sets a single letter in italic on its own (L-LET-1); upright letters that it would slant (`\Gamma`, `\mathrm{d}`) take `mathvariant="normal"`; other alphabets are Unicode's mathematical letters (`𝐱`, `ℝ`, `ℒ`), which is how Core draws them |
| function | `<mi>` with the name as the locale writes it (L-FUN-1), followed by U+2061 (function application) before its argument, with TeX's thin space as its `rspace` unless a parenthesis follows; with limits under it (`lim`, `max`) an `<mo movablelimits="true">` |
| operator | `<mo>`; a class that is not the character's own (`{,}`, `\mathrel`) as `lspace` and `rspace`; a parenthesis or bracket outside `\left…\right` is `stretchy="false"`, as TeX keeps it its size |
| `\big(`… | `<mo>` with the same `minsize` and `maxsize` (1.2, 1.8, 2.4 and 3 em) |
| large operator | `<mo>`; ∑ and the others that take limits below are `munderover` (Core's `movablelimits` moves them aside in inline style), integrals `msubsup`; `\limits` adds `movablelimits="false"` |
| fraction | `<mfrac>`; `linethickness="0"` without a rule, the thickness in em when the input gave one; `\dfrac` and `\tfrac` as `displaystyle` |
| `\left…\right` | `<mrow>` with the delimiters at its ends, `\middle` as `<mo stretchy="true">`, the null delimiter `.` as an empty `<mo fence="true">` |
| matrices, cases, aligned, gather, array | `<mtable>` between its delimiters; alignment as `columnalign` and as CSS `text-align` on each cell (Chrome ignores `columnalign`), `columnlines` and `rowlines` as MathML 3 attributes (drawn by Firefox and Safari, not by Chrome); `\multicolumn` is `columnspan` |
| accents, bars, braces, `\xrightarrow` | `<mover>`/`<munder>` with the mark as an `<mo>` (`accent` written out), the label of a brace in an outer element, a stretchy arrow with its text |
| text | `<mtext>`, spaces as no-break spaces so the ones at the ends stay |
| color, `\colorbox`, `\bbox[color,5px]` | `mathcolor`, `mathbackground` on an `<mrow>`; `\bbox`'s padding as CSS `padding` (a `\bbox` border is S-MML-1) |
| `\class`, `\cssId`, `\style`, `\htmlData` | the attributes (`class`, `id`, `style`, `data-*`, global in MathML Core) on an `<mrow>`, as the tree keeps them, sanitized |
| `\vdotswithin{=}` | a one-column `<mtable>`: `⋮` over the relation in an `<mphantom>` with no height, so the dots take its width; `\shortvdotswithin` with `rowspacing="0em"` |
| `\overgroup`, `\undergroup` | `<mover>`/`<munder>` with a stretchy `⏠`/`⏡` as an accent |
| `\overlinesegment`, `\underlinesegment` (KaTeX) | `<mover>`/`<munder>` with a stretchy U+20E9 (combining wide bridge) as an accent: Unicode has no line with a tick at each end, and KaTeX writes no character for it; `\widebar` (mathabx) is `\bar`'s `¯` with `stretchy="true"` |
| mhchem's words (`\ce{Hydrogen + Oxygen -> Water}`) | `<mtext>` |
| `\slashed{D}` (slashed) | one token, the symbol and U+0338, the combining long solidus overlay (as Unicode writes ≠): `<mi>𝐷̸</mi>`, `<mo>∂̸</mo>`. Core does not italicize a token of two characters, so an italic letter is its mathematical italic; a slash over more than one symbol is S-MML-1 |
| `\displaystyle`… | `<mstyle displaystyle scriptlevel>` |
| `\phantom`, `\hphantom`, `\smash`, `\mathrlap`, `\raisebox` | `<mphantom>` and `<mpadded>` |

### Intent

The `intent` attribute of [MathML 4](https://www.w3.org/TR/mathml4/#mixing_intent) is written only where the tree knows something the drawing does not say. The concept names are those of the W3C's [Intent Core Concepts](https://w3c.github.io/mathml-docs/intent-core-concepts/) list; none is made up.

| Where | Intent |
|---|---|
| A function the locale writes with another name: `sen`, `tg`, `cotg`, `cossec`, `arcsen`, `arctg`, `senh`, `mdc`, `mmc` in pt-BR (L-FUN-1) | `sine`, `tangent`, `cotangent`, `cosecant`, `arcsine`, `arctangent`, `hyperbolic-sine`, `greatest-common-divisor`, `least-common-multiple` (and the other functions of the list: `cosine`, `logarithm`, `natural-logarithm`, `exponential`, `determinant`, `limit`, `max`, `min`, `complex-arg`…); a function with no core concept keeps its canonical name. Where the written name is the canonical one (`sin` in English) there is no intent |
| An interval with reversed brackets (L-INT-1, pt-BR, fr, de, it) | `open-interval($a,$b)` for `]a, b[`, `open-closed-interval($a,$b)` for `]a, b]`, with `arg="a"` and `arg="b"` on the bounds |
| `\binom` (two rows in parentheses, no rule) | `binomial-coefficient($n,$k)` |
| A siunitx unit | the `:unit` property |

## S-MML-1 · What MathML cannot draw

Chemical structures (chemfig), commutative diagrams (amscd, tikz-cd, xymatrix), `\divchave` and `\contaarmada`, crossed-out content (`\cancel`, `\not` on a letter, `\enclose{updiagonalstrike}`), framed content (`\boxed`, `\fbox`, a `\bbox` border, `\enclose{circle}`, the phasor and actuarial angles), graphicx's rotated, scaled and mirrored boxes, `\mathchoice` and the stmaryrd and mathabx symbols drawn by composition (`\llceil`, `\bigbox`…, spec/rules.md) have no MathML Core drawing. The equation is then a `<semantics>` element: the closest drawing first (the content without its frame or strike, the cells of a diagram as a table, a structure's formula as `<mtext>`, `125 ÷ 5` for a long division, the closest Unicode text for a composed symbol: `⌈⌈`, `□`), then the source in an `<annotation>`, with the encoding of its notation (`application/x-tex`, `text/x-asciimath` or `application/mathml-presentation+xml`).

```xml
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><mrow><mn>125</mn><mo>÷</mo><mn>5</mn></mrow></mrow><annotation encoding="application/x-tex">\divchave{125}{5}</annotation></semantics></math>
```

The conversion records a note `S-MML-1` naming the construction, in `applied`: as with `S-BRL-1`, the input has no problem, so it is not a warning, and strict mode still converts. `--mathml` prints the note on stderr.

## Round trip

Reading the output back with `--from mathml` gives the same tree as the original input. `crates/core/tests/mathml_output.rs` checks it over the whole corpus (`constructions.json`, `packages.json`, `gallery.json` and `reference.json`): of 498 equations whose MathML is not a fallback, 466 come back identical. The 32 others draw the same, and lose structure MathML has no place for; the test lists each one:

- siunitx, `\tablenum` and mhchem's `\pu` (14): a quantity and its units come back as their drawing (the number, a space and upright letters), and the grouping flag of a number under five digits draws nothing.
- An atom class forced on a group (6: `\mathrel`, `\mathop`, `\DeclarePairedDelimiter`, `\intop`, physics' `\dd`): MathML has spacing on a single `<mo>`, not a class for a group.
- An operator the author named like a known function (2: `\DeclareMathOperator{\sen}{sen}` in English) reads back as that function.
- Table structure (5): `\intertext` rows, `\cline` and dashed rules, rules around the table, `\arraystretch`.
- Math inside `\text` (2): MathML text holds no math, so it comes back as text and math side by side.
- `\rule` (an `mspace` with a background), `\vcenter` and `\bordermatrix` (3).

### Reading it back

For the round trip, the MathML reader (spec/input.md) also reads what this output writes, which is also what MathML Core writes:

- Unicode's mathematical letters as a letter in a variant (`𝐱` is a bold x).
- An `<mrow>` around a single element is a group, like TeX's braces (`{x}^2`).
- `stretchy="false"` keeps a fence plain; `stretchy="true"` inside a fenced row is `\middle`; an empty `<mo fence="true">` is the null delimiter.
- `minsize` equal to `maxsize` is a delimiter of fixed size; `lspace` and `rspace` written out give the class.
- A large operator that takes limits below by default (∑) in `munderover` leaves them to the style; in `msubsup` it is `\nolimits`; `movablelimits="false"` is `\limits`.
- `mfrac`'s `displaystyle` and `linethickness` in em; `mstyle`'s `scriptlevel`; `mtd`'s `columnspan`; `mtable`'s `displaystyle` (gather), alternating right and left columns with no space between a pair (aligned), `scriptlevel` (smallmatrix).
- `mpadded` with no height and depth (`\smash`, around a phantom `\hphantom`), with no width (a lap, around a phantom `\vphantom`), with a `voffset` (`\raisebox`).
- `accent` written out, also `accent="false"`; any single mark with `accent="true"` is an accent of that character; a stretchy arrow with text over or under it is `\xrightarrow`.
- An `<mrow>` with an interval intent, or with an `arg`, only groups for the intent: its children go into the row.
- No-break spaces in `<mtext>` are spaces.
- An `<mrow>` with `class`, `id`, `style` or `data-*` (not MathJax's `data-mjx-*`) carries them, sanitized as the LaTeX reader does; with `mathbackground`, a CSS `padding` is `\bbox`'s.
- An empty `<mrow>` in a row is TeX's empty group `{}`; `columnspan="1"` is a line of multline aligned on its own; a one-column table of `⋮` over a phantom with no height is `\vdotswithin`.
