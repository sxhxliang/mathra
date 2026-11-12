# Reading and layout rules

Every rule has a stable id. The code cites the id where the rule is applied (`crates/core/src/rules.rs`), the matching test starts with the same id (`crates/core/tests/rules.rs`), and `mathra --explain` lists the rules that changed the result.

Prefixes: `L` layout and locale, `S` speech and SVG output (see `svg.md`), `D` determinism, `E` recovery from invalid input (see `tolerance.md`). The ids keep their original Portuguese abbreviations (`ESP` spacing, `LET` letters, `ENT` input, `CONTA` arithmetic).

## Numbers

### L-NUM-1 · Decimal comma in the input

In the languages that write a decimal comma (pt-BR, es, fr, de, it, ru, id, tr, nl, pl), a comma directly between two digits is a decimal separator: `3,14` is the number 3.14.

A comma followed by a space is still a list separator: `f(1, 5)` has two arguments.

A dot between digits is decimal in every locale, because that is the LaTeX convention: `3.14` is 3,14 in pt-BR and 3.14 in en.

In **en, zh, ja, ko, hi and ar**, the comma is never decimal.

The number is kept in the tree in canonical form, with a dot: `{"type":"number","value":"3.14"}`.

> A consequence to know about: in pt-BR, `f(1,5)` has **one** argument (1.5). For two, write `f(1, 5)` or `f(1; 5)`.

### L-NUM-2 · How the number is written in the output

The decimal separator drawn comes from the locale, not from the input. The same `3.14` comes out as `3,14` in every language that writes a decimal comma:

| Decimal | Thousands (L-NUM-3) | Languages |
|---|---|---|
| `.` | `,` | en, zh, ja, ko, hi, ar |
| `,` | `.` | pt-BR, es, de, it, id, tr, nl |
| `,` | none | fr, ru, pl (they group thousands with spaces, which LaTeX math drops) |

The comma between digits is decimal in the input (L-NUM-1) exactly in the languages that write it.

### L-NUM-3 · Thousands separator written by the author

The locale's thousands separator (table in L-NUM-2) followed by groups of exactly three digits separates thousands. In **pt-BR**, `1.000` is one thousand and `12.345,67` is a bit over twelve thousand; in **en**, the comma plays the same role: `1,000.5`. Indian grouping (`1,00,000`) is not recognized. The number is stored without the separator (`"value":"1000"`, `"thousands":"."`) and drawn the way the author wrote it.

> Why: authors write `5,3\times1.000` meaning 5300. Treating the dot as a decimal point wrote `1,000` and changed the meaning. TeX never changes the text; mathra must not change the meaning.

## Intervals

### L-INT-1 · Open interval with reversed brackets

In **pt-BR, fr, de and it**, where `]a, b[` is the usual notation, a `]` without an operand before it (at the start, or after a relation, operator or punctuation) opens an interval, and a `[` after an operand, in a span already opened with `]`, closes it. `]2, 5[` gets delimiter spacing, and the speech says "abre intervalo … fecha intervalo" (pt-BR), "ouvre l'intervalle … ferme l'intervalle" (fr).

## Units

### L-UNI-1 · siunitx quantities

`\SI{9,8}{\meter\per\second\squared}` and `\qty{…}{…}` write the number, a thin space and the unit in upright letters. Negative exponents (`\per`) become a slash: `m/s²`, and more than one unit in the denominator gets parentheses: `J/(mol·K)`. `\num{…}` groups with thin spaces from five digits on; `\ang{30}` writes `30°`. `\tothe{4}` raises the unit before it and `\raiseto{4}` the unit after it: `\unit{\raiseto{4}\metre}` is m⁴. A value with an uncertainty is a number and is drawn as written, with no warning: `\qty{1.23(4)}{\kilo\gram}` is `1.23(4) kg` (the compact form, siunitx's default `uncertainty-mode`), and `\qty{1.23 \pm 0.04}{\kilo\gram}` (or `+-`) is `(1.23 ± 0.04) kg`, in parentheses before a unit as siunitx's `separate-uncertainty-units = bracket` sets them (`\num{1.23 \pm 0.04}` has none).

The slash is mathra's choice (siunitx's own default is `power`, `m s⁻²`); only `\sisetup{per-mode=…}` changes it, for the rest of the input: `fraction` (`\frac{m}{s²}`), `power` (`m s⁻²`), `repeated-symbol` (`J/mol/K`), `symbol` and `single-symbol` (the slash). `\sisetup` also honors `inter-unit-product`, `quantity-product`, `output-complex-root`, `complex-root-position` and `retain-explicit-plus`; any other option is ignored with a warning (E-REC-9). `\DeclareSIUnit{\rpm}{rpm}` adds a unit for the rest of the input, as `\definecolor` adds a color; a unit declared as other units (`{\kilo\watt\hour}`) is read as those. `\complexnum{1+2i}` and `\complexqty{3+4i}{\ohm}` write each part as `\num` does, with the language's decimal marker, the upright i after the number, and parentheses around a quantity's value with both parts: `(3 + 4i) Ω`.

### L-UNI-2 · Ranges, lists and products

`\SIrange`/`\qtyrange`, `\numrange` and `\angrange` join the two values with the language's "to", as siunitx's `range-phrase` does: `1 kg to 10 kg` in en, `1 kg a 10 kg` in pt-BR, `1 kg bis 10 kg` in de (the word is `op.–` in the language's file); where the embedded font cannot write that word (zh, ja, ko, hi, ar), with an en dash: `1 kg – 10 kg`. `\SIlist`/`\qtylist`, `\numlist` and `\anglist` separate the values with commas and close with the language's "and" (`1, 2 e 3` in pt-BR); where the embedded font cannot write that word (zh, ja, ko, hi, ar), the last separator is a comma too. `\SIproduct`/`\qtyproduct` and `\numproduct` join with ×. As in siunitx's defaults, the unit is repeated on every value. Options in brackets (`\SI[mode=text]{…}{…}`) are read and ignored; `\qty[…]{…}{…}`, with two arguments in braces after the brackets, is siunitx's, not physics's `\qty[…]`.

### L-UNI-4 · siunitx in text

The siunitx commands work inside `\text{…}` (and every text argument) as in math, as siunitx typesets them in text too: `\text{at \SI{12}{\volt}}` sets the number upright, a thin space and the unit upright. The same holds for `\qty`, `\si`, `\unit`, `\num`, `\ang` and the ranges, lists and products (L-UNI-2).

## Chemistry

### L-UNI-3 · Units spoken by name

The tree keeps the siunitx name of each unit and its prefix (`{"type": "unit", "prefix": "kilo", "name": "gram"}`, drawn `kg`), and the speech says the name: `\SI{9.81}{\meter\per\second\squared}` is "9.81 meters per second squared", "9,81 metros por segundo ao quadrado". `\per` is spoken "per" ("por"), and the parentheses and the dot of a denominator are not read ("joules per mole kelvin"). The last unit before "per" agrees in number with the value: in English only 1 is singular (1 meter, 1.5 meters); in pt-BR, values below 2 are (1,5 metro, 2 metros). Without a value (`\si`) the unit is plural. The names are in the `units` section of the language's file (`locales.md`); a language without it, or a unit it does not name, reads the symbol, as before. The drawing, the text and the braille keep the symbols.

### L-CHE-2 · Structural chemistry (chemfig)

With the `chem` feature (on by default), `\chemfig{…}`, `\schemestart … \schemestop`, `\chemname{…}{…}` and the `\chemmove{…}` that follows them are read as one chemistry node: a graph of atoms and bonds per structure, and the compounds, plus signs, arrows and mechanism arrows of a scheme. The structure is drawn by chemfig's directions with mathra's font and rules for its labels, and read aloud by its molecular formula, counted from the graph, and its rings. The layout, formula and reading rules (C-LAY-n, C-FOR-n, C-SCH-n) are in `spec/chemistry.md`.

### L-CHE-1 · mhchem

`\ce{…}` reads chemical formulas: element symbols upright, digits after them as subscripts, charges as superscripts (`Ag+`, `SO4^2-`, `[H+]`), radicals (`^{.}` → •), oxidation states (`^{II}`), states (`(aq)`, `(s)`, `(l)`, `(g)`), isotopes on an empty base (`^{14}_{6}C`) and bonds (`-`, `=`, `#`, `\bond{…}`), which are drawn as lines and are not read as minus, equals or congruence. Coefficients may be integers, decimals (`0.5`), fractions (`1/2`, drawn small) or math (`$x$`, or a lone lowercase letter); after the dot of a hydrate (`CuSO4.5H2O`, also `*`) a number is a coefficient again, not a subscript. The arrows are `->`, `<-`, `<->` (resonance), `<-->`, `<=>`, `<=>>` and `<<=>`; `[above][below]` right after an arrow are labels, read as `\ce` themselves (between braces, `[{text above}]`, as text), and the arrow stretches over them. `&` and `\\` inside `\ce` belong to the alignment around it. `\frac{…}{…}` inside `\ce` keeps formulas in numerator and denominator, and any other command (`\Delta`) is read as math. `\pu{123 kJ mol^-1}` writes a quantity with mhchem's unit syntax; `//` is a fraction bar, as in mhchem.js' `pu` state (a text-style `\frac`): `\pu{75.3 J // mol K}` is 75.3 J over mol K. Words are text (`\ce{Hydrogen + Oxygen -> Water}`), two formulas or words written apart get a word space (`sodium chloride`), and a state may hold more after a comma (`(aq,$\infty$)`), by the rules in `chemistry.md`. Both work inside `\text{…}` (and every text argument) as in math, as mhchem typesets them in text too (`\text{water, \ce{H2O}}`).

## Input coming from other systems

### L-ENT-1 · HTML entities

`&lt;`, `&gt;`, `&amp;`, `&nbsp;`, `&quot;` inside the equation are read as the characters they stand for. They show up when the equation went through an HTML editor.

### L-ENT-2 · Outer delimiters

`$…$`, `$$…$$`, `\(…\)` and `\[…\]` around the whole equation are removed.

### L-ENT-4 · MathML pasted as LaTeX

An input that starts with a `<math>` element (after an optional XML prolog or comments) is read as MathML, even in LaTeX mode: LaTeX never starts that way, and editors put MathML on the clipboard. The other notations are in `input.md`.

### L-ENT-3 · Document package commands

Package imports are ignored and noted:

- `\tiny`, `\scriptsize`, `\small`, `\large` and the rest of the size commands: the size comes from whoever uses the SVG. In text, `\fontsize{size}{skip}\selectfont` too. Written as an environment in math (`\begin{tiny} x \end{tiny}`), each one is the command over its body, `{\tiny x}`, and is ignored the same way.
- Plain TeX's fonts of its smaller sizes are not document sizes: they set the math one or two steps smaller, for the rest of the group, as plain.tex loads them beside 10-point text. `\sevenrm` (cmr7) is `\scriptstyle\rm`, `\fiverm` (cmr5) `\scriptscriptstyle\rm`, and `\sevenbf`, `\fivebf` the same in bold.
- `\usepackage{…}`, `\RequirePackage{…}` and MathJax's `\require{…}`, with their optional argument: the supported packages are already loaded.

### L-ENT-5 · Cross-references: labels, tags and citations

An equation is converted alone, so the numbers of the document around it come from the caller: `Options::labels` and `Options::citations` (`labels` and `citations` in JavaScript and Python, `--label key=n` and `--cite key=n` in the CLI) map a key to its number.

- `\ref{key}` shows the label's number and `\eqref{key}` the number in parentheses: `(3)`. `\cite{a,b}` shows `[1, 2]`, and `\cite[p.~5]{a}` adds the note, `[1, p. 5]`. They work inside `\text{…}` too. Speech, text and braille say the number, never the key.
- `\tag{3}` numbers the line it is on (in `equation`, `align`, `gather`, `multline`, `flalign`, `alignat`, `eqnarray` or a loose `\\` line), and a `\label` on the same line takes that number: `\ref` shows the tag as written, `\eqref` in parentheses. The labels an equation numbers this way come back in `Output::labels`, and in `--batch` they count for the lines after it. A `\label` with no `\tag` would take the automatic number of `equation` or `align`, which mathra does not give: equations are not numbered on their own.
- A key with no number is `??` (`(??)` for `\eqref`) or `?` inside the citation's brackets, as on LaTeX's first run, with an E-REC-9 warning; strict mode refuses it.

### L-TXT-1 · Quotes and dashes in text

Inside `\text{…}` (and every text argument), TeX's quote ligatures become typographic quotes: ``` `` ``` → “, `''` → ”, `` ` `` → ‘, `'` → ’. In math mode `'` is still a prime. The dash ligatures too, as LaTeX and KaTeX set them: `--` → – (en dash), `---` → — (em dash); not in typewriter type (`\texttt`, `\ttfamily`), whose font has no ligatures.

### L-TXT-2 · Math inside text

Inside `\text{…}` (and every text argument), these are set as LaTeX sets them:

- `\textsubscript{…}` and `\textsuperscript{…}`: a script of the text before it (`H\textsubscript{2}O`).
- `\ensuremath{…}`: its argument as math, as `$…$` would.
- `\boldmath`: the math that follows (`$…$`, `\(…\)`, `\ensuremath`) is bold, until the end of the group it is in; `\unboldmath` ends it.
- An environment that starts math, up to its `\end`: the displays `equation`, `align`, `gather`, `multline`, `flalign`, `alignat`, `eqnarray`, `displaymath` and `math` (and their `*` forms), read as math like `\[…\]`.
- Math does not end the text's style: in `\textbf{a $x$ b}`, b is bold, as are the letters after math in `\textsc`, `\texttt` and `\bf`, `\scshape`, `\ttfamily` until the end of their group. The math itself is not (that is `\boldmath`).

A math command written in text (`\mathrm{V}`, `\frac{1}{2}`, `\sqrt{2}`) is an error in TeX: strict mode refuses it, and tolerant mode reads it as math, with a warning (E-REC-1). So is an environment TeX allows only in math (`array`, `matrix`, `pmatrix` and the other matrices, `cases`, `aligned`, `gathered`, `split`, `subarray`), read as math up to its `\end`.

### L-TXT-3 · Space inside text

Inside `\text{…}` (and every text argument), `\hspace{…}` and `\hspace*{…}` add a space of that length (`a\hspace{1cm}b`). `\phantom{…}` leaves the room its argument takes, read as text, without drawing it; `\hphantom{…}` keeps only its width and `\vphantom{…}` only its height.

A text is a box of its natural width, as `\text{…}` is in TeX: `\hfill`, `\hfil` and `\hss` take no room in it (`1 \hfill IA` is `1 IA`), and a line break, `\newline` or `\linebreak` (with its optional `[n]`), is a space, as `\\` is.

A line break or a tab inside text is a space, as in TeX; with the spaces around it (the indentation of the next line, a blank line) it is a single space: `\text{can be`, a line break, `  used}` is `can be used`.

A backslash before a line break or a tab of the source is a control space, `\ `, as in plain TeX, in text and in math (`a\` and a line break, then `b`, is `a\ b`); `\\` before a line break is still a line break. A control space that ends the input (`a\ `) is a space too: trimming the input does not cut it (#254).

### L-TXT-4 · Color inside text

Inside `\text{…}` (and every text argument), `\textcolor{color}{…}` sets its argument in that color, and `\color{color}` the rest of the group it is in (`{\color{red}warm} and cold`), with the color models of math (`\color[rgb]{0.2,0.4,0.6}`). The colored text keeps the bold, small capitals or monospace around it, and the math in it is colored too.

### L-TXT-5 · Italic inside text

Inside `\text{…}` (and every text argument), `\textit{…}` and `\emph{…}` set their argument in italic, and `\itshape`, `\it` and `\em` the rest of their group; `\textit{…}` in math is text in italic. Italic text is a text font: its letters sit side by side, with no italic correction between them, nor after a word. After `\textit{…}` and `\emph{…}` comes the italic correction of their last letter, as LaTeX adds it (`\/`), except before a period or a comma. Italic goes on after math in its group, as bold does, and inside a color.

`\mathit{…}`'s font is a text font too: its letters make one word, with no italic correction between them (TeXbook, Appendix G, rule 17), where the math italic of `$ff$` has one after each letter.

### L-TXT-6 · Accents inside text

Inside `\text{…}` (and every text argument), LaTeX's text accents put their mark on the letter after them, with or without braces: `\'e`, `` \`a ``, `\^o`, `\~n`, `\"u`, `\=a`, `\.z`, and `\c{c}`, `\u{a}`, `\v{s}`, `\H{o}`, `\r{a}`, `\k{e}`, `\b{b}`, `\d{d}`, `\t{oo}` with their argument. The accented letter is one character where Unicode has it (é, ñ, ç, š), and an `i` takes the accent without its dot (`\'i` is í, as on ı); elsewhere it is the letter followed by the combining accent.

An accent with an empty argument, `\^{}`, is the accent alone, as LaTeX sets it: the usual way to write a caret or a tilde in text (`x\^{}2`, `\~{}user`). It is the accent's spacing character: ´ ` ˆ ˜ ¨ ¯ ˙ ¸ ˘ ˇ ˝ ˚ ˛ for `\'` `` \` `` `\^` `\~` `\"` `\=` `\.` `\c` `\u` `\v` `\H` `\r` `\k`, and the combining accent on a no-break space for `\b`, `\d` and `\t`, which have none (#306).

## Macros

### L-MAC-1 · Substitution macros

`\newcommand{\name}[n][default]{body}`, `\renewcommand`, `\providecommand`, `\def\name#1#2{body}`, `\let\a\b`, `\DeclareMathOperator{\name}{text}` (and `*`), `\DeclarePairedDelimiter{\name}{open}{close}` (with `*` for `\left…\right`) and `\newenvironment{name}{begin}{end}` apply to the rest of the equation. Expansion replaces `#1…#9` with the arguments and reads the result again. After 2,000 expansions mathra stops: the macro almost certainly calls itself (an error in strict mode; in tolerant mode the excess is discarded with a single E-REC-1 warning).

`\ifx`, `\expandafter`, `\catcode` and `\def` with delimited parameters are deliberately not supported (see `boundary.md`).

Package commands defined through other commands go through the same mechanism: from physics, `\dv`, `\pdv`, `\fdv`, `\dd`, `\eval`, `\expval`, `\mel`, `\braket{a}{b}`, `\ketbra`, `\comm`, `\acomm`, `\pb`, `\grad`, `\divergence`, `\curl`, `\laplacian`, `\vb`, `\vu`, `\va`, `\cross`, `\vdot`, `\order`, `\Tr`, `\tr`, `\rank`, `\erf`, `\Res`, `\qty`, `\pqty`, `\bqty`, `\vqty`, `\Bqty`, the matrices (`\mqty` with its `(…)`, `*(…)` (`\lgroup…\rgroup`), `[…]`, `|…|` and `{…}` (no delimiters) forms, `\pmqty`, `\Pmqty`, `\bmqty`, `\vmqty`, `\mdet`, the small `\smqty`, `\spmqty`, `\sPmqty`, `\sbmqty`, `\svmqty`, `\smdet`, and the contents `\imat`, `\xmat`, `\xmat*`, `\zmat`, `\dmat`, `\admat`, `\paulimatrix`, `\paulixmatrix`…, up to 64 rows and columns), the spaced text (`\qq{…}`, `\qc`, `\qcc`, `\qand`, `\qor`, `\qif`…, `\qin`, `\qas`, starred without the first `\quad`), `\var`, `\pv`, `\PV`, `\op`, `\vev`, `\flatfrac`, `\cp`, `\Trace`, `\absolutevalue`, `\acos`…`\acot`, the long names (`\sine`, `\hypsine`, `\arcsine`, `\asine`, `\exponential`, `\logarithm`, `\naturallogarithm`, `\determinant`, `\Residue`, `\Probability`…), `\vnabla`, `\gradientnabla`, `\diffd`, `\fderivative`, `\pderivative`, `\real` and `\imaginary` (ℜ and ℑ, the package's names for LaTeX's `\Re` and `\Im`); `\ket`, `\bra`, `\braket`, `\Set` (braket); `\tensor`, `\indices` (tensor); `\prescript` (mathtools); `\abs`, `\norm`, `\sfrac`, `\nicefrac`, `\unitfrac`. `\qty` is physics' brackets unless two braced groups follow (`\qty{3}{m}`, siunitx's quantity). `\div` stays ÷: physics' divergence is `\divergence`. `\Re` and `\Im` stay LaTeX's ℜ and ℑ too, where physics makes them the operators Re and Im (an equation written for physics can say `\operatorname{Re}`): mathra reads LaTeX without knowing which packages the document loads. physics' starred forms follow the package: `\abs*`, `\norm*`, `\pqty*` (and the other brackets), `\comm*`, `\ket*`, `\bra*`, `\braket*`, `\ketbra*`, `\expval*` and `\mel*` keep their brackets at the text size (`\expval**` and `\mel**` resize them); `\dv*`, `\pdv*` and `\fdv*` are the flat fraction df/dx. `\sin[2](x)` puts the power on the function, sin²(x), for the functions physics redefines (`\sin` to `\coth`, `\log`, `\ln`); without the parentheses, physics leaves `[2]` as written, and so does mathra.

## Column arithmetic (mathra extensions)

### L-CONTA-1 · Long division, Brazilian layout

`\divchave{247}{5}` computes the long division and draws it the way Brazilian schools do: dividend on the left, divisor to the right of the bracket, quotient under the divisor, and each step (product with a minus sign, rule, remainder with the next digit brought down) under the dividend. Steps whose product is zero only bring the digit down.

### L-CONTA-2 · Column arithmetic

`\contaarmada{+}{347}{285}` (also `-` and `\times`) aligns the terms on the right, writes the carries at script size above the first term, draws the rule and writes the computed result. When multiplying by a number with more than one digit, the shifted partial products appear before the sum.

## Functions

### L-FUN-1 · Function name by locale

The input accepts LaTeX's English names and the Brazilian ones (`\sen`, `\tg`, `\cotg`, `\cossec`, `\arcsen`, `\arctg`, `\senh`, `\mdc`, `\mmc`). The tree keeps the canonical English name (`sin`). The output writes it in the locale's language: `sin x` in en, `sen x` in pt-BR, es and it, `tg x` in ru, it and pl, `sh x` in fr, `ggT` in de. The names of each language are under `written` in `crates/core/src/locales/<code>.json`.

## Letters

### L-LET-1 · Math italic

Latin letters and lowercase Greek letters are drawn with Unicode's math italic characters (block U+1D400; `h` lives at U+210E). The lowercase Greek variants are lowercase letters too: `\phi` (ϕ), `\epsilon` (ϵ), `\vartheta` (ϑ), `\varkappa` (ϰ), `\varrho` (ϱ) and `\varpi` (ϖ) are in italic, at U+1D716–U+1D71B, as TeX sets them. Uppercase Greek letters stay upright, as in TeX.

### L-LET-2 · Double-struck letters spoken

A double-struck capital, written `\mathbb{R}`, `RR` (AsciiMath), `mathvariant="double-struck"` or as the character (ℝ, 𝔸), is read as the number set it names: ℕ, ℤ, ℚ, ℝ and ℂ are "the natural numbers", "the integers", "the rational numbers", "the real numbers" and "the complex numbers" ("os naturais", "os inteiros", "os racionais", "os reais", "os complexos"). Any other is read as a letter: "double-struck P", "P duplo". A double-struck digit, the 𝟙 of the indicator function and of the identity (`\mathbb{1}`, dsfont's `\mathds{1}`, bbm's `\mathbbm{1}`, U+1D7D8–U+1D7E1), is a symbol, not a number: it is drawn as the character (MathJax does the same) and read as "double-struck 1", "1 duplo". Where the language contracts a preposition with the article of the name, the speech does: `x \in \mathbb{R}` is "x pertence aos reais", `A \subset \mathbb{Z}` is "A está contido nos inteiros". The names are in the `double_struck` section of the language's file (`locales.md`); a language without it reads the letter alone, as before.

## Operators

### L-OPR-1 · The dot between vectors

`\cdot` (and physics' `\vdot`) between two vectors is the dot product and is spoken "dot" ("escalar" in pt-BR): `\vec{v} \cdot \vec{w}` is "vector v dot vector w". A vector is a letter with an arrow over it (`\vec`, `\overrightarrow`) or a bold letter (`\mathbf`, `\boldsymbol`, `\vb`), also with an index. Anywhere else the dot is "times" (`2 \cdot 3`, `a \cdot b`, `2 \cdot \vec{v}`). The word is in the `optional` section of the language's file (`locales.md`); a language without it keeps "times". The drawing is the same dot.

### Symbols drawn by composition

stmaryrd and mathabx have symbols that Unicode has no character for (neither unicode-math-table.tex nor unimathsymbols.txt lists one). mathra draws each one from the math font's own glyphs, as the package's METAFONT source builds it (stmaryjg.mf and stmaryaj.mf, with cmsy10's parameters; for mathabx, the drawings of its mathtest.pdf), and leaves out what it cannot draw that way rather than draw a look-alike:

| Command | Drawn as |
|---|---|
| `\llceil`, `\rrceil`, `\llfloor`, `\rrfloor` | two ⌈ (⌉, ⌊, ⌋) 0.45 x-height apart, stmaryrd's `spread`; after `\left`, `\right` and `\big`, the single one grown, twice (stmaryrd declares them as symbols only, as it does `\Lbag`, which mathra also grows) |
| `\varocircle`, `\varolessthan`, `\varogreaterthan`, `\varovee`, `\varowedge` | ○ with the strokes stmaryrd draws inside it (a circle at half the radius; <, >, ∨, ∧ from the circle's points), at the font's rule thickness |
| `\varotimes`, `\varoplus`, `\varominus`, `\varodot`, `\varoslash`, `\varobslash`, `\varobar`, `\varoast`, `\varbigcirc` | ⊗ ⊕ ⊖ ⊙ ⊘ ⦸ ⦶ ⊛ ◯ themselves: the var forms are the circle operators drawn circular and with the rule's pen where Computer Modern's are hairline, and STIX Two Math and Latin Modern Math already draw them so |
| `\Ydown`, `\Yleft`, `\Yright` | ⅄ (`\Yup`) turned; `\Yleft` and `\Yright` centered on the axis |
| `\shortrightarrow`, `\shortleftarrow`, `\shortuparrow`, `\shortdownarrow` | the head of → (the part the font assembles long arrows with) on a shaft three quarters as long (12u for 16u); the vertical ones are it turned, centered on the axis |
| `\nnearrow` | → turned to 7u across and 16u up, centered on the axis |
| `\arrownot` | no width: a slash 4u across, as tall as the arrow's head, over the middle of the arrow that follows (`\arrownot\rightarrow`) |
| `\mapsfromchar` | no width: the stem of ↤ at the tail of the arrow before it (`\leftarrow\mapsfromchar`) |
| `\trianglelefteqslant` | ⊲ with its lower side drawn again 0.45 x-height below, centered on the axis |
| `\inplus` | ∈ with a bar across its middle |
| `\bigbox`, `\bigboxplus` | ⨅ and ⨆ over each other, and a plus across |
| `\bigparallel` | the legs of ⨅, 6u apart where those are 13u (8u and 18u in display) |
| `\bignplus` | ⨄ upside down |
| `\bigcurlyvee`, `\bigcurlywedge` | two curved arms in the box of ⋁ (⋏ upside down), as thick as its strokes |
| `\bigominus`, `\bigoslash` | the circle of ⨁ with a bar across or a slash |

`\curvearrowbotright` is Unicode's ⤻ (BOTTOM ARC ANTICLOCKWISE ARROW), the arc and head mathabx draws.

The large operators take limits under and over in display style and grow there, as `\bigsqcup` does. In the tree each symbol is an ordinary symbol node whose character is a marker from the Supplementary Private Use Area-A (U+F0B00 on, `crate::composite`); the tree's JSON (`--tree`, `Node::to_json`, the SVG's metadata, S-SVG-3) names it by its command instead of the marker: `"symbol":"\\llceil"`. The linear text writes the closest Unicode text (`⌈⌈`, `∨⃝`, `-<`); speech reads a symbol that is another one drawn another way as that one (a short arrow as the arrow) and the others as that text; braille writes the short arrows as the arrows and the rest as the full cell ⠿ (S-BRL-1, naming the command); the MathML is the S-MML-1 fallback.

Left out: stmaryrd's `\curlyveedownarrow`, whose arms stop at the base of an arrow head the font has no glyph for (drawing them over the head would not be its drawing); and `\sqcupplus`, which mathabx does not define (its square union with a plus is `\squplus`).

## Spacing

### L-ESP-1 · Space between atoms

Every node has a TeX atom class (TeXbook, ch. 17): `ord`, `op`, `bin`, `rel`, `open`, `close`, `punct`. The space between neighbors comes from the table in the TeXbook, ch. 18, in *mu* (1/18 em):

| left \ right | ord | op | bin | rel | open | close | punct | inner |
|---|---|---|---|---|---|---|---|---|
| **ord**   | 0 | 3 | (4) | (5) | 0 | 0 | 0 | (3) |
| **op**    | 3 | 3 | – | (5) | 0 | 0 | 0 | (3) |
| **bin**   | (4) | (4) | – | – | (4) | – | – | (4) |
| **rel**   | (5) | (5) | – | 0 | (5) | 0 | 0 | (5) |
| **open**  | 0 | 0 | – | 0 | 0 | 0 | 0 | 0 |
| **close** | 0 | 3 | (4) | (5) | 0 | 0 | 0 | (3) |
| **punct** | (3) | (3) | – | (3) | (3) | (3) | (3) | (3) |
| **inner** | (3) | 3 | (4) | (5) | (3) | 0 | (3) | (3) |

3 = thin space, 4 = medium, 5 = thick. Values in parentheses vanish in script style. `–` cannot happen because of L-ESP-2. Fractions, `\left…\right` and matrices with delimiters are of class `inner`.

### L-ESP-2 · An operator without operands becomes ordinary

A `bin` becomes `ord` when it has no operand on the left (start, or after `bin`, `op`, `rel`, `open`, `punct`) or on the right (end, or before `rel`, `close`, `punct`). That is what keeps the minus of `-b` and of `x = -1` attached (TeXbook, Appendix G, rules 5 and 6).

### Grouping braces

As in TeX, an operator alone in braces becomes `ord`: `{,}` is a comma without punctuation spacing.

## Determinism

### D-DET-1 · Same input, same bytes

The same equation, locale, mathra version and embedded font produce identical output, byte for byte. Nothing depends on the clock, on hash order or on the system.

## Two-dimensional layout

The rules for fractions, roots, scripts, limits, accents, bars, braces and arrows follow Appendix G of the TeXbook with the parameters of the font's MATH table, as MathML Core formulates them. Each lives in `crates/core/src/layout/`:

| Structure | MATH table constants used |
|---|---|
| Fraction (`\frac`, `\dfrac`, `\tfrac`) | `FractionNumerator(DisplayStyle)ShiftUp`, `…DenominatorShiftDown`, `…GapMin`, `FractionRuleThickness`, `AxisHeight`; `\nulldelimiterspace` of 0.12 em on each side. A thickness the input gives (`\above`, `\genfrac`) is absolute and sets the clearance as TeX's rule 15d does: 3θ in display style, θ otherwise; 0 draws no rule |
| Binomial | `StackTopShiftUp`, `StackBottomShiftDown`, `StackGapMin` |
| Root | `RadicalVerticalGap`, `RadicalRuleThickness`, `RadicalExtraAscender`, `RadicalKernBefore/AfterDegree`, `RadicalDegreeBottomRaisePercent` |
| Scripts | `SuperscriptShiftUp(Cramped)`, `SubscriptShiftDown`, `…BaselineDrop…`, `SubSuperscriptGapMin`, `SpaceAfterScript`, italic correction |
| Limits (display `\sum`, `\lim`, `\overset`) | `UpperLimitGapMin`, `UpperLimitBaselineRiseMin`, `LowerLimit…` |
| Large operator | variant with height ≥ `DisplayOperatorMinHeight` in display style, centered on the axis |
| Delimiters (`\left`, matrices) | size variants and assembly from parts; height ≥ max(0.901 × 2δ, 2δ − 0.5 em), like `\delimiterfactor` and `\delimitershortfall` |
| Accents | `AccentBaseHeight`, the glyph's accent attachment; `\widehat` and extended arrows through horizontal assembly |
| Braces and brackets (`\underbrace`, `\overbrace`, `\underbracket`, `\overbracket`) | `OverbarVerticalGap`/`UnderbarVerticalGap` from the content, `UpperLimitGapMin`/`LowerLimitGapMin` to the label, measured on the ink; the horizontal variant or assembly as wide as the content, but never narrower than the font's first variant wider than the base glyph (1 em in STIX Two Math), as TeX gives a brace a minimum width: over a short base the brace is centered and sticks out, and the box widens to hold it |
| Matrices and `array` | strut of 0.84 em / 0.36 em per row, columns 1 em apart, `\jot` of 0.3 em in alignments |
| Arrow diagrams (`tikz-cd`, `xymatrix`) | `AxisHeight` (arrows leave and reach each cell at the axis, and the diagram is centered on it), `FractionRuleThickness` (the strokes); tikz-cd's separations: 2.4 em between columns and 2.1 em between rows, widened to fit a label; labels in script style; from the tikz-cd manual: an `\arrow` starts and ends at its own cell, and a direction (`r`, `du`), `to=` and `from=` move one end each, `row-column` naming a cell and a direction counting from the arrow's own cell, so `\arrow[from=1-1]` goes from 1-1 to the cell it is written in; a bend as tikz's `bend left`, a cubic Bézier with its control points 0.39 of the way along the leaving and arriving directions. From the xy-pic reference manual: `\ar'[d][dd]` goes through the entry `[d]` (relative to its own) in straight segments, each between the borders of the entries it joins, so an entry with something in it interrupts the path and an empty one does not (note 24d); a label belongs to the segment it follows; `\hole` as a break (`|\hole`) is a gap 0.6 em wide, an empty object with its 3 pt margins, and as an entry it is an empty cell (note 24j). 2-cells (`\rtwocell`, `\rrtwocell<5>^f_g{\alpha}`, `\..uppertwocell`, `\..lowertwocell`, section 25): two quadratic curves whose control point is the middle moved 3.5 dashes of 5 pt (or the nudge's number of dashes) to each side, cut at the entries' borders, the upper one labelled by `^` outside it and the lower one by `_`; a nudge of 0 is one straight arrow; the Arrow across the middle is a double arrow 0.6 em long, clockwise (`_`, the default), anticlockwise (`^`), without a head (`=`) or left out (`\omit`), moved by its own nudge, with its label 0.4 em beside it; the tokens `'`, `` ` ``, `"`, `!` leave the Arrow out and turn the curves' heads. Label nudges, module maps (`!`) and `~` objects are left out with a warning (E-REC-9) |

The prime of `f'` uses the ′ glyph at normal size, attached to the base, because it is already drawn as a superscript.

### L-BOX-1 · graphicx boxes

graphicx's box commands set their argument in text mode, and work in math and inside `\text{…}` alike (the CircuiTikZ manual uses them in node labels):

- `\scalebox{h}[v]{…}` scales the box by h across and v up (v is h when left out). A negative h mirrors it inside its own width, as `\reflectbox{…}` does (`\scalebox{-1}[1]`); a negative v turns it upside down, its height becoming its depth. Factors are kept between 0.05 and 20 in size.
- `\resizebox{width}{height}{…}` scales it to that size; `!` for one of them keeps the ratio. `\resizebox*` counts the depth in the height.
- `\rotatebox[origin=…]{angle}{…}` turns it counterclockwise, by degrees, and takes the smallest box around the turned one, as graphicx does. The turn is around the left end of the baseline; `origin` moves that point with graphicx's letters: `l`, `r` across, `t`, `b`, `B` (baseline) up and down, `c` the center; a direction it leaves out is centered (`origin=c`, `origin=lt`).
- `\raisebox{lift}[height][depth]{…}` raises it, then gives it that height and depth, if asked: `\raisebox{0pt}[\height][0pt]{…}` (the manual's `\killdepth`) removes its depth, so labels with and without descenders share a baseline.

The lengths take any TeX unit and the box's own `\width`, `\height`, `\depth` and `\totalheight`, with a factor (`2\height`); in `\raisebox`, those of the raised box. A length that cannot be read is an error in `\raisebox{lift}` and `\resizebox`; in `\raisebox`'s optional arguments it is ignored in tolerant mode (E-REC-9). Turned and unevenly scaled boxes are drawn through an SVG `matrix()` (S-SVG-5).

## Line breaking

### L-BRK-1 · Automatic line breaking

Off by default. With a maximum width in em (`Options::max_width`, `--max-width 30em`, `{ maxWidth: 30 }`, `max_width=30`), a formula wider than it is broken into lines, in display and inline style alike:

- **Where.** Only between the atoms of the formula's top-level row, so never inside a fraction, a root, `\left…\right`, scripts, a group (`{…}`) or a table. After a relation (`=`, `≤`, `→`, an extensible arrow) first: if breaking only after relations makes every line fit, no other break is taken. Otherwise after a relation or a binary `+`, `−`, `±` or `∓` (a unary minus is not binary, L-ESP-2; `·`, `×` and punctuation are never break points), each line taking as much as fits (first fit, as TeX's and MathJax's breaks without a penalty search). Never after a relation that another relation follows, as TeX's `\relpenalty` goes only after the last.
- **The operator.** It ends its line and is not repeated at the start of the next, as TeX and MathJax do, in every locale. Spaces at the start of a line are dropped, as TeX discards glue after a break.
- **Indent.** Continuation lines start under the right-hand side of the first top-level relation (where the atom after it starts), so they read as more of that side. With no relation, or one whose right-hand side starts more than half the maximum width in, they start 2 em in.
- **Lines.** Each line's baseline sits below the previous one's as table rows do: a strut of 0.84 em above and 0.36 em below, plus `\jot` (0.3 em) in display style (S-SVG-12). The first line's baseline is the formula's (S-SVG-1).
- **Not broken.** An equation the author already set in lines (`align`, `gather`, `aligned`… at its top level) is never broken again. Tables (`array`, matrices, `cases`) are atoms: a line breaks around them, never inside.
- **Hints.** KaTeX's break hints `\nobreak` and `\allowbreak` (and LaTeX's `\nolinebreak`) are read with no warning and ignored (#255): the tree has no node for a break hint, so the breaking does not see them.

Speech, linear text, braille and the tree are the same with and without it. `applied` gets one note: how many lines, and after which operators.

### L-BRK-2 · What cannot be broken

A formula, a line or a table that cannot be made narrower than the maximum width (a single wide fraction, a long alignment, a run without break points) is drawn as it is, overflowing, and `applied` notes by how much (`the table cannot be broken within 3em: drawn 4.2em wider`). It is a fact about the layout, not a problem of the input: it goes in `applied`, as the full braille cell of S-BRL-1 does, not in `warnings`, which hold what tolerant mode fixed and stay empty in strict mode (`tolerance.md`); so it does not show on the terminal's stderr or as `warning` in `--batch`, only in `--explain`.

## Measured coverage

`cargo run --release -p mathra --example bench` runs the hand-written constructions in `corpus/` in both modes and prints how many convert; the README has the numbers of one run. The constructions strict mode refuses are not equations: TeX programming (`\ifx`, `\expandafter`, `\catcode`) and drawings with coordinates (`\tikz`). Strict mode also "accepts" LaTeX escaped twice (`\\cdot`), because it is valid for TeX (a line break followed by the letters "cdot"); tolerant mode reads what the author meant and warns (E-REC-2).

## Proof trees

- **L-PRF-1**: proof branches attach at their conclusions; labels and ancestor widths enlarge the box without shifting that attachment. See [proof trees](proofs.md), tested in `crates/core/tests/proof.rs`.

## Explicit sizes

### L-SIZ-1 · Absolute LaTeX size declarations

In math input, `\tiny`, `\sixptsize`, `\scriptsize`, `\footnotesize`, `\small`, `\normalsize`, `\large`, `\Large`, `\LARGE`, `\huge`, `\Huge` set the remaining group to .5, .6, .7, .8, .9, 1, 1.2, 1.44, 1.728, 2.074, 2.488 times the caller's em. A nested declaration replaces the previous one; it does not multiply it. A declaration resets to text style, including inside a script, as in RaTeX. See [RaTeX command compatibility](ratex-compatibility.md), tested in `tests/ratex_commands.rs` and `tests/rules.rs`.
