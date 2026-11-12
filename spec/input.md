# Input notations

mathra reads three notations into the same tree of meaning: **LaTeX** (the default), **MathML** and **AsciiMath**. Everything after the tree (layout, speech, linear text, SVG) is shared, so the same equation gives the same drawing and the same phrase whatever notation it came in. The notation is chosen with `Options::input` (Rust), `input` (JavaScript and Python) or `--from` (CLI), and `<mathra:source type="…">` in the SVG says which one was read (S-SVG-3).

## MathML

Presentation MathML, as Word, Google Docs, LibreOffice, MathType and MathJax export it. The input is XML: it must be well formed in both modes, because there is no tree to recover from broken XML. The root may be `<math>` with or without a namespace prefix (`<m:math>`), an XML prolog or comments; any other element is read as the content of a `<math>`.

| Element | Becomes |
|---|---|
| `mi` | one letter: a variable, in italic (uppercase Greek upright, as in TeX); several letters: a function (`sin`, `lim`) or an upright word; `mathvariant` chooses the alphabet |
| `mn` | a number, with the locale's decimal comma and thousands separator (L-NUM-1, L-NUM-3); Unicode's mathematical digits (`𝟏`, `𝟣`, `𝟷`) or `mathvariant` give the number its alphabet |
| `mo` | the character with its TeX class (`≰` a relation, `⊗` a binary operator); `∑ ∫ ∏…` large operators; words (`lim`, `max`) functions; invisible operators (U+2061–U+2064) draw nothing |
| `mtext`, `ms`, `mspace` | text; quoted text; a space (`em`, `ex`, `pt`, `px`, `mu` and the named spaces) |
| `mrow`, `mstyle`, `mpadded` | a row; `mstyle` carries `displaystyle`, `mathvariant`, `mathcolor` and `mathbackground` |
| `mfrac`, `msqrt`, `mroot` | fraction (`linethickness="0"` without the rule), roots |
| `msub`, `msup`, `msubsup`, `mmultiscripts` | scripts; prescripts (`<mprescripts/>`) on an empty base, as in isotopes |
| `munder`, `mover`, `munderover` | limits over a large operator or a function; an accent, a bar, an arrow, a brace or a bracket when the script is that single mark (`→` over a letter is the vector accent); a brace's label in the outer element, as MathJax writes it; anything else stacked |
| `mtable`, `mtr`, `mlabeledtr`, `mtd` | a table; `columnalign`, `columnlines` and `rowlines` are kept; the label of `mlabeledtr` goes at the end of its row, alone in it when the row has no other cell |
| `mfenced`, fences in `mrow` | an `mrow` that starts with an opening fence and ends with a closing one stretches them (`\left…\right`) when the inside is balanced; around a table they make a matrix (`(` `[` `|` `‖` `{…}`), `{` alone makes `cases` and `}` alone `rcases` |
| `menclose` | `box`/`roundedbox`, `circle`, the strikes, `top`, `bottom`, `radical`; LaTeX's `\enclose{notation}[mathcolor=…]{…}` (MathJax) reads the same notations into the same tree |
| `semantics`, `maction`, `merror`, `mphantom` | the presentation: the first child, or an `annotation-xml` in presentation MathML; without one, the content (the first child, or an `annotation-xml` in content MathML); other annotations are ignored. The selected child; content in red; space without drawing |

### Content MathML

Content MathML describes meaning without a drawing; Maple, Mathematica's MathML export, OpenMath converters and assessment tools write it, alone or inside `<semantics>`. mathra spells each content expression as the LaTeX an author would type for it and reads that LaTeX, so the tree is the one that LaTeX gives: `<apply><plus/><apply><power/><ci>x</ci><cn>2</cn></apply><cn>1</cn></apply>` is the tree of `x^2 + 1`, with the same drawing, speech and braille, and the locale's rules (`sen x` and `3,14` in pt-BR). The code is in `crates/core/src/input/mathml/content.rs`; each construction is checked against its LaTeX in `crates/core/tests/mathml.rs`.

| Content | LaTeX it is read as |
|---|---|
| `ci`, `csymbol` | a letter as is (`x`, `θ`), a longer name as one italic identifier (`\mathit{speed}`); presentation inside `ci` (`mi`, `mn`, `mo`, `mrow`, `msub`, `msup`, `msubsup`, `mover` with an accent, `mtext`) |
| `cn` | the number in the locale's spelling; a sign makes it negative; `type="rational"` `1<sep/>2` is `\frac{1}{2}`, `e-notation` `1.5<sep/>3` is `1.5 \times 10^{3}`, `complex-cartesian` is `a + bi` |
| `<pi/>` `<exponentiale/>` `<imaginaryi/>` `<infinity/>` `<emptyset/>`, `<reals/>` and the other number sets | `\pi` `e` `i` `\infty` `\emptyset`, `\mathbb{R}` … |
| `plus`, `minus` (one or two operands), `times`, `divide`, `power`, `root` with `degree`, `abs`, `factorial`, `floor`, `ceiling` | `a + b`, `-a`, `a - b`, `2x` or `a \cdot b`, `\frac{a}{b}`, `x^{n}`, `\sqrt[n]{x}`, `\|x\|`, `n!`, `\lfloor x \rfloor` |
| `eq`, `neq`, `lt`, `gt`, `leq`, `geq`, `approx`, `equivalent`, with two operands or more | `a = b`, `0 < x < 1` … |
| `sin`, `cos`, `tan`, `sec`, `csc`, `cot`, the `arc` and hyperbolic ones, `ln`, `log` with `logbase`, `exp`, `max`, `min`, `gcd`; a `ci` as operator | `\sin x`, `\sin(x + 1)`, `\sin^{2} x` for a power of one, `\log_{2} x`, `e^{x}`; `f(x)`, `g(x, y)` |
| `diff`, `partialdiff` with `bvar` (and `degree`) | `\frac{dy}{dx}`, `\frac{d^{2}y}{dx^{2}}`, `\frac{d}{dx}(x^2 + 1)`, `\frac{\partial f}{\partial x}`; without `bvar`, `f'` |
| `int`, `sum`, `product`, `limit` with `bvar`, `lowlimit`, `uplimit`, an `interval`, `condition` or `domainofapplication` | `\int_{0}^{1} x^{2} \, dx`, `\sum_{i=1}^{n} i^{2}`, `\lim_{x \to 0} …` |
| `set` (its elements, or `bvar` and `condition`), `in`, `notin`, `subset`, `prsubset`, `union`, `intersect`, `setdiff` | `\{1, 2, 3\}`, `\{x \mid x > 0\}`, `x \in A \cup B` |
| `interval` with `closure` | `[a, b]` (closed, the default), `(a, b)`, `(a, b]`, `[a, b)` |

**Parentheses.** An operand that holds less tightly than its operator is put in parentheses, as an author would: `(a + b) \cdot c`, `c - (a + b)`, `(a + b)^{2}`, `(-3)^{2}`, `a + (-b)`, `(n + 1)!`. They stretch (`\left( … \right)`) around a fraction. **Products.** Side by side when they read like algebra (`2x`, `\frac{1}{2} x`, `2 \pi r`, `3 \sin x`: letters after one number or other single thing, a function last), with `\cdot` otherwise (`2 \cdot 3`, `(a + b) \cdot c`).

Anything else (`lambda`, `bind`, `piecewise`, `vector`, `matrix`, other operators) is reported (E-REC-10) and its operands are read as a row.

What MathML Core writes, and mathra's own MathML output, read back to the tree they came from: Unicode's mathematical letters, `stretchy`, `minsize`/`maxsize`, `lspace`/`rspace`, `movablelimits`, `mpadded`, `columnspan` and the rest are listed in [`mathml.md`](mathml.md#reading-it-back).

### L-ENT-4 · MathML pasted as LaTeX

In LaTeX mode, an input that starts with a `<math>` element (after an optional prolog or comments) is read as MathML. LaTeX never starts that way, and editors put MathML on the clipboard.

### Entities

XML knows only `&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;` and numeric references. MathML's named entities (`&InvisibleTimes;`, `&times;`, `&alpha;`, `&rarr;`…) become their characters before parsing. An unknown entity is an error in strict mode and is dropped with a warning (E-REC-10) in tolerant mode.

### Out of scope

Content MathML outside the subset above. Elementary math (`<mlongdiv>`, `<mstack>`) is read as rows; for long division and column arithmetic there are `\divchave` and `\contaarmada`.

## AsciiMath

The notation of asciimath.org: `sum_(i=1)^n i^2 = (n(n+1)(2n+1))/6`.

- **Grammar.** An expression is a sequence of `I` or `I/I`; `I` is `S`, `S_S`, `S^S` or `S_S^S`; `S` is a symbol, a bracketed expression, `unary S` or `binary S S`. The brackets around a fraction's parts, a script and an argument are removed: `(a+b)/(c+d)` has no parentheses, `x^(2n)` neither, `f(x)` keeps them.
- **Symbols.** Each AsciiMath symbol is given by its LaTeX spelling (`xx` is `\times`, `!=` is `\ne`, `RR` is `\mathbb{R}`, `sum` is `\sum`) and read by the LaTeX reader, so both notations draw and read a symbol the same way. The tokenizer takes the longest symbol; a word that is not a symbol is read letter by letter (`speed` is s·p·e·e·d), as asciimath.org does.
- **Brackets.** `(` `[` `{` `(:` `<<` and the invisible `{:` open; any closing bracket closes, so `(a,b]` is a half-open interval. `|x|` is an absolute value when a matching bar follows.
- **Matrices.** A bracket holding two or more bracketed rows of the same length, separated by commas, is a matrix: `[[a,b],[c,d]]`, `((1,2),(3,4))`. With `{` and the invisible `:}` it is `cases`: `{(x, x>0),(0, x<=0):}`.
- **Commands.** `sqrt`, `root(n)(x)`, `frac(a)(b)`, `abs`, `norm`, `floor`, `ceil`, accents (`hat`, `bar`, `vec`, `dot`, `ddot`, `tilde`, `ul`, `overarc`), braces with a label (`ubrace(…)_(…)`), `cancel`, alphabets (`bb`, `bbb`, `cc`, `tt`, `fr`, `sf`), `stackrel`, `overset`, `underset`, `color(red)(x)`, `text(…)` and `"quoted text"`.
- **Numbers.** A dot between digits is decimal; in the languages with a decimal comma, a comma between digits is too, and a comma followed by a space separates (L-NUM-1).

An unpaired bracket is an error in strict mode and is drawn as written, with a warning (E-REC-5), in tolerant mode. A closing bracket where an argument or a script is expected (`sqrt)`, `x^)`, `frac(a))`) leaves it empty and closes what it would have closed: an error in strict mode, a warning (E-REC-7, missing argument) in tolerant mode.
