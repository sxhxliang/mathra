# Changelog

What changed in each release of mathra: the crates `mathra` and `mathra-cli`, `@mathlabs/mathra` on npm and `mathra` on PyPI, which are released together. The site shows the same, with the equations drawn live: [the project's evolution](https://matheusmota-dev-br.github.io/mathra/changelog.html).

Each release has a headline (the line under its title), what changed, and the equations that show it (`Equations:`): a name from the gallery ([`corpus/gallery.json`](corpus/gallery.json)) or the LaTeX itself, drawn by the site with today's mathra. `scripts/release.sh` will not release a version without its section here, and makes the GitHub release from it.

## Unreleased

A caret or a tilde written alone in text, as LaTeX writes them.

- **Fixes.** In text, a text accent with an empty argument is the accent alone, as LaTeX sets it: `\text{x\^{}2}` is xˆ2 and `\~{}user` is ˜user (L-TXT-6). The accent took the `}` that closes its argument as its letter, drawing a stray brace under it ([#306](https://github.com/matheusmota-dev-br/mathra/issues/306)).

Equations: `\text{x\^{}2 and \~{}user}`

## 1.12.0 - 2026-11-10

Where each marked piece is drawn, chemistry included: what a visual editor needs. And what the measured formulas still asked for: commands inside real formulas, and chemfig as its manual writes it.

- **Inside real formulas.** `\setlength{\arraycolsep}{…}` spaces the columns of the arrays and matrices after it; `\lefteqn` overlaps to the right in display style, as in `eqnarray`; `\linebreak[n]` is a break hint, as `\allowbreak`, and amsthm's `\qedhere` draws nothing, since an equation converted alone is not a proof. Measured on the 174,525 formulas: 39 more convert with no warning (the Stacks Project's `\linebreak[0]`, arXiv's `\qedhere` and `\arraycolsep`), and none is drawn worse.
- **chemfig as its manual writes it.** A branch may start with defaults of its own, `B([:60]-D-E)`, `([::-30,1.5]-X-Y)`, valid in all of it; `-#(d1,d2)` (or `\#`, `\CFhash`) sets the space a bond leaves before the letters; `**[30,330]5(…)` draws the aromatic circle as an arc, dashed when its TikZ options say so. 17 more examples of the chemfig manual convert with no warning, and none is drawn worse.
- **Mechanisms and submolecules.** A curved arrow of `\chemmove` can point at a bond, `-[@{db,0.5}::30]`, and is read as the bond between its atoms; `\definesubmol` (with arguments and the dual `[code1]{code2}`) and `!{name}`; `\arrow(--name[yshift=5mm])` moves the compound it brings. An unknown `!{name}` is drawn as written, as before, now with a warning that its definition is missing.
- **The rest of the measured formulas.** `\noalign{\vspace{…}}` and `\vspace` inside a formula are read as the `[length]` of `\\` is, and `\noalign{\hrule}` is a rule; a `\chemname` breaks into lines at `\\`; `\chemleft{[}` takes its delimiter between braces; an arrow can leave a `\subscheme`'s box; a `\+` right after an arrow is drawn (it was left out); a `\chemmove` point may carry its own move, `([yshift=7pt]b1.180)`. What the 174,505 measured formulas still flag, 202 of them, is listed with the reason for each in `tools/coverage/REMAINING.md`.
- **Marks inside chemistry.** In `\ce`, a mark around a piece (a species, its coefficient, formula or state, an arrow with its conditions) is read through: the piece is read as chemistry and the mark goes around it. In `\chemfig`, a mark around an atom's label is kept on the atom (bonds still reach the same letter), and a mark on a vertex without a label gives its point. Either way the drawing is the one without the marks, and `boxes` says where each piece is: what lets an editor edit reactions and structures piece by piece. In a scheme, a mark around an arrow's label keeps its text as text.
- **Where a structure's atoms and bonds are written.** In the tree, each chemfig atom and bond has a `span`: the characters of the structure's code it is written in (none after a submolecule rewrote the code). An editor changes one atom or bond in place with it.
- **Where each marked piece sits.** `render` returns `boxes`: for each group marked with `\htmlData`, `\htmlId` or `\class`, the box its content was set in, in the SVG's coordinates (left, top, width, height, baseline and nesting level). What a visual editor needs to place its cursor and read clicks over the SVG; marking draws exactly what the bare formula draws, as long as a marked operator keeps its class with `\mathrel{…}`, `\mathbin{…}` (a group alone is an ordinary atom, as in TeX). In Rust, `Output::boxes` and `Item::Group`'s `bounds`, a change to the public API.
- **`&` in a one-column environment.** `\begin{gather}a&b\end{gather}`, and the same in `gather*`, `gathered`, `multline` and `multline*`, is refused in strict mode, as amsmath stops on it ("Misplaced alignment tab character &"); tolerant mode warns (E-REC-9) and joins the cells into the line, which `multline` then aligns as any other ([#288](https://github.com/matheusmota-dev-br/mathra/issues/288)). None of the 174,505 measured formulas changes.
- **Nemeth braille.** A numeric subscript of a unit's letter takes no subscript indicator, as of any letter (§14.6): `\si{m}_1` is ⠍⠂, as `m_1`; it was ⠍⠰⠂ ([#287](https://github.com/matheusmota-dev-br/mathra/issues/287)).
- **Nemeth braille.** `\overleftarrow`, `\overleftrightarrow` and their `\under…` forms are written as modified expressions with the arrow's full sign, ⠐⠭⠣⠫⠪⠒⠒⠻ (§22); they were the letter and ⠿ ([#286](https://github.com/matheusmota-dev-br/mathra/issues/286)).
- **CMU braille.** An expression already in ( ), [ ] or { } written with plain signs no longer takes the auxiliary parentheses ⠢…⠔ as a radicand, numerator, denominator, exponent or index: `\sqrt{(a+b)}` is ⠫⠱⠣⠁⠖⠃⠜, as `\left(…\right)` already was (§1.3); `\sqrt{(a)+(b)}`, two terms, keeps them ([#285](https://github.com/matheusmota-dev-br/mathra/issues/285)).
- **Fixes.** A tikz-cd arrow with `from=` starts at that cell and ends at the current one, unless `to=` or a direction names the end, which count from the current cell as in tikz-cd: `A & B \arrow[from=1-1]` and `\arrow[from=1-1, to=1-2]` are an arrow from A to B (they were left out, as an arrow without a direction or to itself) ([#284](https://github.com/matheusmota-dev-br/mathra/issues/284)).
- **MathML.** An `mlabeledtr` whose only cell is its label keeps the label, alone in its row; it was dropped, leaving an empty row ([#283](https://github.com/matheusmota-dev-br/mathra/issues/283)).
- **Fixes.** In AsciiMath, a closing bracket where an argument or a script is expected (`sqrt)`, `x^)`, `frac(a))`) leaves it empty, with a warning (E-REC-7, as a missing argument in LaTeX), and strict mode refuses it; it made the reader panic ([#282](https://github.com/matheusmota-dev-br/mathra/issues/282)).

Equations: `\setlength{\arraycolsep}{2pt} \left[ \begin{array}{c|ccc} 0 & 1 & 1 & 2 \\ \hline 1 & 0 & 2 & 1 \end{array} \right]` `\chemfig{A-B([1]-X([4]-Z)-Y)(-[7]D)-C} \quad \chemfig{**[30,330]5(-----)}` `\htmlData{m=1}{x} \mathrel{\htmlData{m=2}{=}} \htmlData{m=3}{\frac{\htmlData{m=4}{a}}{\htmlData{m=5}{b}}}`

## 1.11.0 - 2026-11-08

MathML and PNG out, lines that break, a fallback font, and the commands physics and chemistry papers use, measured against 174,525 formulas of real LaTeX.

- **New outputs.** MathML Core next to the SVG, with `intent` where the tree knows more than the drawing (pt-BR `sen` is `sine`), read back by mathra to the same tree; what MathML cannot draw (chemfig, diagrams, `\divchave`) keeps its source in an annotation ([#112](https://github.com/matheusmota-dev-br/mathra/issues/112)). PNG from the terminal and Python, with `--dpi`, `--background` and `--color`; the npm package leaves rasterizing to the browser ([#113](https://github.com/matheusmota-dev-br/mathra/issues/113)).
- **Long equations break into lines** with `--max-width`, `{ maxWidth }` or `max_width=`: after a relation first, then after `+` and `−`, never inside a fraction or a root; the continuation starts under the right-hand side ([#111](https://github.com/matheusmota-dev-br/mathra/issues/111)).
- **A fallback font** for what the math font lacks: emoji from Noto Emoji (in the terminal and Python), CJK or anything else from a font you give ([#125](https://github.com/matheusmota-dev-br/mathra/issues/125)).
- **Reading.** Content MathML from CAS and assessment tools ([#114](https://github.com/matheusmota-dev-br/mathra/issues/114)); words in mhchem as words, `\ce{sodium chloride -> sodium + chlorine}` ([#115](https://github.com/matheusmota-dev-br/mathra/issues/115)); `\eqref`, `\ref` and `\cite` with numbers you pass in, `(??)` and `[?]` without them, as LaTeX's first run ([#126](https://github.com/matheusmota-dev-br/mathra/issues/126), [#127](https://github.com/matheusmota-dev-br/mathra/issues/127)).
- **Physics.** `\slashed` for the Feynman slash, physics' matrices (`\mqty`, `\pmqty`, `\paulimatrix`…), spaced text (`\qq`, `\qand`…), the starred forms (`\abs*`, `\dv*`) and `\sin[2](x)`; a bold `\nabla` under `\bm`; 𝟙 for `\mathds{1}`; the rest of esint (`\ointclockwise`) and upgreek ([#157](https://github.com/matheusmota-dev-br/mathra/issues/157)–[#159](https://github.com/matheusmota-dev-br/mathra/issues/159), [#165](https://github.com/matheusmota-dev-br/mathra/issues/165)–[#168](https://github.com/matheusmota-dev-br/mathra/issues/168)).
- **Packages.** The rest of mathtools (`\splitfrac`, `\adjustlimits`, `psmallmatrix`…), siunitx 3 (`\complexqty`, `\DeclareSIUnit`, `\sisetup`, constant units), `\definecolor` and xcolor mixes, MathJax's `\bbox`, `\enclose` and `\class`/`\style`, `\vv` and the accents packages, unicode-math's alphabets, textcomp, KaTeX's texvc aliases (`\R`, `\Rarr`), stmaryrd and mathabx (the symbols Unicode lacks are drawn from the font's own pieces), `\vdotswithin`, `\stackbin`, `\overgroup`, `\shoveleft`, `\tablenum`, `\root…\of`, the corner delimiters ([#116](https://github.com/matheusmota-dev-br/mathra/issues/116)–[#124](https://github.com/matheusmota-dev-br/mathra/issues/124), [#169](https://github.com/matheusmota-dev-br/mathra/issues/169)–[#177](https://github.com/matheusmota-dev-br/mathra/issues/177)).
- **Chemistry and diagrams.** chemfig's start options, distant bonds, `\charge`, `-U>`, `\chemleft`, offset double bonds; xymatrix paths through entries, `\hole` and 2-cells ([#210](https://github.com/matheusmota-dev-br/mathra/issues/210), [#214](https://github.com/matheusmota-dev-br/mathra/issues/214), [#215](https://github.com/matheusmota-dev-br/mathra/issues/215)).
- **Real LaTeX.** Measured on 174,525 formulas (the Stacks Project, 95 arXiv papers, the mhchem and chemfig manuals): a line break or tab is whitespace, `\` before a line break is a control space, a line break in `\text` is a space, a measure mathra cannot read is a warning instead of a refusal, and the one crash, in a chemfig ring, is gone. Against 1.10.1, 535 more formulas convert with no warning and none is drawn worse ([#206](https://github.com/matheusmota-dev-br/mathra/issues/206), [#208](https://github.com/matheusmota-dev-br/mathra/issues/208)–[#213](https://github.com/matheusmota-dev-br/mathra/issues/213), [#216](https://github.com/matheusmota-dev-br/mathra/issues/216)).
- **mhchem.** The bonds `\bond{~}` (a dashed line, as mhchem draws it; it was ∼), `\bond{~-}`, `\bond{~=}`, `\bond{-~-}` and `\bond{....}` are drawn as mhchem draws them and read as what they are; an arrow label between braces is text (`->[{text above}]`); `$…$` in a subscript is math; `&` and `\\` inside `\ce` go to the alignment around it ([#267](https://github.com/matheusmota-dev-br/mathra/issues/267)–[#270](https://github.com/matheusmota-dev-br/mathra/issues/270)).
- **Fixes.** A chemfig label like `Nu` is kept whole, no longer read as N ([#271](https://github.com/matheusmota-dev-br/mathra/issues/271)); `%` starts a comment in strict mode; `^²` reads as `^2`; braces have a minimum width; `\upvarrho` is ϱ; `\mathbf{1}` is bold; `\unicode{8918}` is decimal; `\not` over a long arrow is a short slash ([#128](https://github.com/matheusmota-dev-br/mathra/issues/128)–[#132](https://github.com/matheusmota-dev-br/mathra/issues/132), [#160](https://github.com/matheusmota-dev-br/mathra/issues/160)–[#164](https://github.com/matheusmota-dev-br/mathra/issues/164), [#202](https://github.com/matheusmota-dev-br/mathra/issues/202)–[#205](https://github.com/matheusmota-dev-br/mathra/issues/205), [#207](https://github.com/matheusmota-dev-br/mathra/issues/207)).
- **What may change for you.** An unknown command is drawn whole in red; it is no longer cut into a known one (`\vertA` was `\vert A`) ([#209](https://github.com/matheusmota-dev-br/mathra/issues/209)). A stray `$`, `&` or `y__k` now warns, and strict mode refuses it ([#129](https://github.com/matheusmota-dev-br/mathra/issues/129), [#130](https://github.com/matheusmota-dev-br/mathra/issues/130)). `\color[rgb]{1,0,0}` is red; it came out nearly black ([#122](https://github.com/matheusmota-dev-br/mathra/issues/122)). In Rust, the tree and `Options` have new variants and fields: code that matches them all or lists every field needs a new arm or `..Default::default()`.

Equations: `\mathcal{L} = -\frac{1}{4} F_{\mu\nu} F^{\mu\nu} + i \bar{\psi} \slashed{D} \psi + \left| D_\mu \phi \right|^2 - V(\phi)` `\sigma_x = \pmqty{0 & 1 \\ 1 & 0}` `\ce{Hydrogen + Oxygen -> Water}` `\llceil x \rrceil + \mathbf{1} \otimes \mathds{1}`

## 1.10.1 - 2026-11-07

The fonts of the mathfonts catalog, by name.

- [mathfonts](https://matheusmota-dev-br.github.io/mathfonts/) is a catalog of 30 OpenType math fonts that are free to share, each one checked with mathra. JavaScript gets `catalogFonts()` and `loadFontFromCatalog(slug)`, and Python gets `catalog_fonts()` and `load_font_from_catalog(slug)`, which keeps the file in `~/.cache/mathra`. A font is downloaded only when asked for, once, and refused if it does not match the catalog's sha256, so the same name always gives the same SVG ([#109](https://github.com/matheusmota-dev-br/mathra/pull/109)).
- The playground lists the catalog's fonts in its font picker and downloads one only when it is picked.
- The Rust crate and the terminal download nothing; `--font` in the help points to the catalog. Loading a font from a file is unchanged, and so is what mathra draws.

Equations: `e^{i\pi} + 1 = 0`

## 1.10.0 - 2026-11-07

A pen that writes the equation, and any OpenType math font.

- `mathra::pen` draws an SVG where a pen tip goes over each glyph's outline, rule and line in the order the layout set them, and each one fills in once drawn. It uses SMIL only, plays in a loop and needs no script. Its time follows the length of the ink. wasm gets `texToPen`, and the playground gets a Pen button and a Pen SVG download ([#104](https://github.com/matheusmota-dev-br/mathra/issues/104)).
- Any OpenType math font (an `.otf` or `.ttf` with a MATH table, such as Libertinus Math, Fira Math or Euler Math) can set an equation. Use `MathFont::load(bytes)` and `Options::font` in Rust, `--font` in the terminal, `loadFont` and `{ font }` in JavaScript, and `load_font` and `font=` in Python. The playground loads one from your computer. A font without a MATH table is refused with a reason. STIX Two Math stays embedded and is the default, and without a font the SVG is unchanged ([#106](https://github.com/matheusmota-dev-br/mathra/issues/106)).
- Code that builds an `Options` listing every field needs the new one (`..Default::default()`). A missing glyph now reads "the math font has no …" (#106).

Equations: `x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`

## 1.9.3 - 2026-10-31

The site, banner and icon take an identity of their own, and a new demo video.

- A slate board with a wood tray in the banner, the icon and the top of the site, where a derivation writes itself line by line. Around it the site is plain paper, or charcoal in the dark theme.
- Code blocks are colored on every page, the SVG, the tree and the reference's grammar included.
- In the reference tables the braille wraps, so the source keeps its room.
- A new 60-second demo video in the README and on the site.
- What the packages draw does not change.

Equations: `x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`

## 1.9.2 - 2026-10-30

`\boldmath` in bold italic, and `\SI`'s values as siunitx prints them.

- `\SI{+10}{V}` leaves out the plus and `\SI{.25}{V}` gets its zero, as siunitx does ([#97](https://github.com/matheusmota-dev-br/mathra/issues/97)).
- `\boldmath` sets letters in bold italic, as TeX's bold math font does, and reaches the text of a `\rotatebox` ([#97](https://github.com/matheusmota-dev-br/mathra/issues/97)).

Equations: `\text{{\boldmath $x$}}`, `\text{{\boldmath \rotatebox{90}{$x$}}}`, `\SI{+10}{V}`, `\SI{.25}{V}`

## 1.9.1 - 2026-10-29

Italic text set as a text font sets it, and `\mathit`'s letters as one word.

- Inside `\text{…}`, `\textit{…}` and `\emph{…}` set their argument in italic and `\itshape`, `\it` and `\em` the rest of their group, with no italic correction between the letters or after a word; after `\textit{…}` and `\emph{…}` comes their last letter's correction, as LaTeX's `\/`, except before a period or a comma. `\textit{…}` in math is text in italic (L-TXT-5, [#93](https://github.com/matheusmota-dev-br/mathra/issues/93)).
- `\mathit{…}`'s letters make one word, with no italic correction between them, as in TeX's text font: since 1.9.0 each letter had one, as in math italic ([#92](https://github.com/matheusmota-dev-br/mathra/issues/92)).

Equations: `\text{an \emph{italic} word, {\itshape and more}}`, `\mathit{diff} \ne diff`

## 1.9.0 - 2026-10-29

Chemistry, color, fills and math environments inside text, and TeX's italic correction at the end of a formula.

- Inside `\text{…}`, mhchem's `\ce{…}` and `\pu{…}` are read as in math (`\text{water, \ce{H2O}}`), instead of being written as is (L-CHE-1, [#84](https://github.com/matheusmota-dev-br/mathra/issues/84)).
- Inside `\text{…}`, `\color{…}` (also `\color[model]{…}`) colors the rest of its group and `\textcolor{…}{…}` its argument, math included, keeping the text's bold, small capitals or monospace (L-TXT-4, [#85](https://github.com/matheusmota-dev-br/mathra/issues/85)).
- Inside `\text{…}`, `\hfill`, `\hfil` and `\hss` take no room, as in a box of natural width, and `\newline` and `\linebreak` are a space, as `\\` is (L-TXT-3, [#86](https://github.com/matheusmota-dev-br/mathra/issues/86)).
- Inside `\text{…}`, `\begin{equation}`, `align`, `gather`, `multline` and the other displays are read as math up to their `\end`, like `\[…\]`; `array`, `pmatrix`, `cases`, `aligned` and the other math-only environments too, with a warning (E-REC-1), since TeX refuses them in text (L-TXT-2, [#87](https://github.com/matheusmota-dev-br/mathra/issues/87)).
- A slanted letter that ends a math list gets its italic correction after it, as TeX does (Appendix G, rule 17). That covers the end of the formula, of a script, a fraction's parts, a radicand, a phantom, a lap and a table cell. In scripts, the base letter's correction stands in at the script's size. `$V$` was 5.83pt wide, TeX gives 8.06pt ([#89](https://github.com/matheusmota-dev-br/mathra/issues/89)).
- `layout::compose_list`: a math list composed on its own, with that correction.

Equations: `\text{water, \ce{H2O}, at \pu{20 mol}}`, `\text{the {\color{red}warm} and {\color{blue}cold} sides}`, `\text{so \begin{align*}a&=1\\b&=2\end{align*}}`, `V = f`, `V_0 + R_1`, `\frac{V}{f}`, `\sqrt{f}`

## 1.8.0 - 2026-10-29

Space and phantoms inside text, and text kerned as TeX kerns it.

- Inside `\text{…}`, `\hspace{…}` and `\hspace*{…}` add their space, and `\phantom`, `\hphantom` and `\vphantom` leave the room of their argument, instead of being written in red (L-TXT-3, [#79](https://github.com/matheusmota-dev-br/mathra/issues/79)).
- `Options::text_kerning`: text in `\text{…}` kerned by the pairs of TeX's OT1 Computer Modern (`cmr10`, `cmbx10`) or T1 Latin Modern (`ec-lmr10`, `ec-lmbx10`) fonts, as TeX's tables do (`va`, `AV`, `To`); none by default, as before (#81).
- Code that builds an `Options` or a `layout::Context` listing every field needs the new one (`..Default::default()`) (#81).

Equations: `\text{a\hspace{1cm}b}`, `\text{a\phantom{xy}b}`, `\text{AVA Today}`

## 1.7.1 - 2026-10-29

Bold text stays bold after math inside it.

- Inside `\text{…}`, the text after math (`$…$`, `\(…\)`, `\ensuremath`, `\textsubscript`, siunitx, graphicx boxes) keeps the bold, small capitals or monospace of its group: in `\textbf{Z $x$ Z}` the second Z was upright ([#77](https://github.com/matheusmota-dev-br/mathra/pull/77)).

Equations: `\text{\textbf{Z $x$ Z} and \textsc{Small $x$ Caps}}`

## 1.7.0 - 2026-10-29

Labels as LaTeX sets them: subscripts, siunitx and graphicx boxes inside text, and `\phi` in italic.

- `\phi` is in math italic, as TeX sets it, like `\varphi` and the other lowercase Greek letters; so are `\epsilon`, `\vartheta`, `\varkappa`, `\varrho` and `\varpi`, which were upright too ([#66](https://github.com/matheusmota-dev-br/mathra/issues/66)).
- Inside `\text{…}`: `\textsubscript{…}` and `\textsuperscript{…}` (`H\textsubscript{2}O`), `\ensuremath{…}`, and `\boldmath`, which sets the math that follows in bold until the end of its group; `\fontsize{…}{…}\selectfont` is ignored like the other sizes. A math command written in text (`\mathrm{V}`, `\frac{1}{2}`) is read as math, with a warning (E-REC-1), instead of being written as is ([#70](https://github.com/matheusmota-dev-br/mathra/issues/70)).
- siunitx ranges read as siunitx sets them: `\qtyrange{1}{5}{\volt}` is `1 V to 5 V`, with the language's word (`1 V a 5 V` in pt-BR), and an en dash only where the font cannot write it. The siunitx commands (`\SI`, `\qty`, `\si`, `\unit`, `\num`, the ranges, lists and products) work inside `\text{…}` as in math, and `\qty[options]{…}{…}` is siunitx's, not physics's ([#71](https://github.com/matheusmota-dev-br/mathra/issues/71)).
- graphicx's boxes, in math and inside `\text{…}`: `\scalebox{h}[v]` scales across and up apart, and a negative factor mirrors (`\scalebox{-1}[1]`) or turns upside down; `\rotatebox[origin=…]{angle}` turns the box; `\resizebox{width}{height}` (and `*`) scales it to a size, `!` keeping the ratio; `\raisebox{lift}[height][depth]` sets the height and depth asked for, so `\raisebox{0pt}[\height][0pt]` removes the depth. Lengths take `\width`, `\height`, `\depth` and `\totalheight` ([#69](https://github.com/matheusmota-dev-br/mathra/issues/69)).

Equations: `\phi \varphi \epsilon \vartheta \varrho \varpi` `\text{H\textsubscript{2}O and {\boldmath $x$} $x$}` `\text{from \qtyrange{1}{5}{\volt}}` `\rotatebox{90}{$I_0$} \scalebox{-1}[1]{Q1} \resizebox{1cm}{!}{abc}`

## 1.6.2 - 2026-10-28

The limits of an integral sit next to its sign.

- The limits of an integral sit next to the sign, as the font's italic correction asks: the upper one at the sign's advance width, the lower one moved left by the italic correction ([#65](https://github.com/matheusmota-dev-br/mathra/issues/65)).

Equations: `gaussian` `stokes` `\int_0^1 x\,dx`

## 1.6.1 - 2026-10-28

How to contribute, and how to report a vulnerability.

- A code of conduct (Contributor Covenant 2.1), a contributing guide and a security policy, in `.github/`. Vulnerabilities are reported privately through the repository's Security tab.
- The checks run on the contributor's machine: `scripts/check.sh` runs fmt, clippy and the Rust, wasm, npm and Python tests, and the git hooks in `.githooks/` run it before each commit and push. GitHub runs them again on `main`, not on pull requests.
- Conversion is unchanged: every SVG is the same as 1.6.0's, apart from the version it carries.

Equations: `euler` `quadratic`

### OMML

Proof trees retain their branches, labels and inference rules.

- Bussproofs-style `prooftree`: axioms, unary through quinary inferences, command aliases, left/right labels, solid/dashed/omitted lines and top/bottom roots, including persistent settings. Inference line weights and dash/gap proportions match the RaTeX reference across fonts. Nested branches attach at their conclusions; malformed structures and excessive depth are rejected. Proofs retain their structure in the SVG metadata, with localized speech and linear text/braille.

- Native image output: `render_svg` accepts `SvgRenderOptions` and returns explicit dimensions and baseline ascent, a fixed theme foreground and no transparent text layer. Existing web SVG output stays byte-for-byte compatible. Real Genius math/chemistry/proof examples are checked in both styles and available fonts.

- More RaTeX commands: `\slashed`, `\htmlStyle`, `\mathsfit`, `\frak`, `\ctg`, `\arcctg`, `\Overrightarrow`, `\overgroup`, `\undergroup`, `\overlinesegment`, `\underlinesegment`, `\r`, `\xrightleftarrows` and `\sixptsize`. Math-mode LaTeX size declarations now affect drawing instead of being ignored; nested declarations reset the absolute size.

Equations: `\begin{prooftree}\AxiomC{P}\AxiomC{Q}\RightLabel{cut}\BinaryInfC{R}\end{prooftree}`

## 1.6.0 - 2026-10-27

The equation writes itself, and reads the LaTeX of the packages it names.

- The writing animation: `--animate`, `{ animate: true }`, `animate=True`. Each glyph fades in, each rule grows along its length and each line is drawn, in the order the layout set them, all in about three seconds; off by default, and the SVG without it is unchanged byte for byte (S-SVG-10).
- The steps apart from the animation: `--steps`, `{ steps: true }`, `steps=True` number each element (`data-step`), for a page that walks through the equation.
- The playground walks through the equation step by step and downloads the animation as a GIF, a video or an animated SVG with its own controls; every equation of the gallery animates.
- Ink is never cut at the edge of the SVG: the view covers the ink that passes the box, such as the hook of a bold f at the end of an equation (S-SVG-1).
- Equilibrium and long arrows stretch under their labels, mhchem's `<=>` and `\xrightleftharpoons` included, built from the arrows the font can stretch.
- Packages read as LaTeX defines them: `\phase` (steinmetz), `\angl` (actuarialangle), arydshln's `:`, `\hdashline` and `\cdashline`, `\arraystretch`, the colons of mathtools and colonequals, `\varGamma` and family, `\intop`, `\injlim`, `\char`, `\reflectbox`, `\url`, `\href`, and TeX's `\mathchoice`, `\vcenter` and `\above`. Of the 1002 examples of KaTeX's support table, 925 convert in strict mode, up from 810; the rest are names LaTeX does not know.
- Fixes: `\circledcirc` is the operator ⊚, not a frame; vertical rules of `array` stay inside the table, an outer `|` at its edge; `\textbf` and `\texttt` in math are bold and typewriter; `\genfrac` draws the thickness it is given.
- This changelog, from 1.0.0 on; each release on GitHub is made from it, and the site's evolution page shows it.

Equations: `\ce{Zn^2+ <=>[+ 2OH-][+ 2H+] $\underset{\text{amphoteres Hydroxid}}{\ce{Zn(OH)2 v}}$}` `\rho \left( \frac{\partial \mathbf{u}}{\partial t} + (\mathbf{u} \cdot \nabla) \mathbf{u} \right) = - \nabla p + \mu \nabla^2 \mathbf{u} + \mathbf{f}` `V = 10\phase{-48\degree}\,\mathrm{V}` `\ddot{a}_{\angl{n}} = \frac{1 - v^n}{d}` `\def\arraystretch{1.5}\begin{array}{c:c:c} a & b & c \\ \hline d & e & f \\ \hdashline g & h & i \end{array}`

## 1.5.0 - 2026-10-26

In Latin Modern, scripts and limits sit where pdfTeX puts them.

- Scripts in the font's own forms for scripts (`ssty`), and `\ldots` and `\cdots` set as TeX sets them.
- In Latin Modern, scripts shift as pdfTeX shifts them, and the limits of an operator get the room above and below that TeX leaves.
- TeX's other delimiters, and the moustaches (`\lmoustache`, `\rmoustache`) built from brace halves in Latin Modern, which has no glyph for them.

Equations: `basel` `zeta` `\left\lmoustache \frac{a}{b} \right\rmoustache \quad x_1, \ldots, x_n`

## 1.4.0 - 2026-10-26

Structures and diagrams: chemfig molecules and commutative diagrams.

- Structural chemistry with chemfig, behind the `chem` feature (on by default): structures with rings, bonds, angles and Lewis marks, reaction schemes and mechanisms with curved arrows, each spoken by its molecular formula.
- Commutative diagrams from tikz-cd and xymatrix, besides amscd: arrows in any direction, bent, dashed, hooked and labelled.
- A gallery page on the site, by group, and more famous and big equations in the README, Navier–Stokes among them.
- The shipped wasm is built for size, and the embedded math fonts are subsets, a third smaller.

Equations: `caffeine` `sn2` `tikzcd` `xymatrix` `navierstokes`

## 1.3.0 - 2026-10-25

Meaning read aloud: number sets, units and the dot product.

- Double-struck letters are read as the number sets they name (L-LET-2), the dot between vectors as the dot product (L-OPR-1), and siunitx units by name in English and Portuguese (L-UNI-3).
- Braces and their labels placed by the ink of the brace; binomials say and write their parentheses once; large operators spaced from their operand in the plain text.
- The site gets one menu on every page, a documentation page, code samples colored by language, the 60-second demo video and a Sponsor link.

Equations: `units` `braces` `binomial`

## 1.2.0 - 2026-10-21

A second font: Latin Modern Math, the OpenType Computer Modern.

- Latin Modern Math as a second font, behind the `latin-modern` feature, chosen with `convert_in_font` and `typeset_in_font`.
- Words in text as far apart as the font says: Latin Modern Math's space is a third of an em.

Equations: `einstein`

## 1.1.1 - 2026-10-20

Braille checked against the codes.

- Nemeth and CMU signs settled against BANA 2022 and the 2006 CMU, and the review against MathCAT reported with the tool that repeats it; the reference page tells how far to trust the braille.
- MathJax's MathML and command arguments without braces read as meant.

Equations: `quadratic` `\frac{3}{4}`

## 1.1.0 - 2026-10-20

MathML and AsciiMath in, braille out.

- MathML and AsciiMath input, beside LaTeX.
- Every equation in braille, in the CMU and in Nemeth, the code chosen by the language.
- amssymb's negations, mhchem, physics, siunitx ranges and mathtools structures read.
- The site chooses LaTeX, MathML or AsciiMath, shows the braille and has a reference page; one script releases every package.

Equations: `chemistry` `\nleq \nsim \nRightarrow \lneqq` `\expval{H}{\psi} = \mel{\psi}{H}{\psi}`

## 1.0.1 - 2026-10-20

Sixteen languages, and mathra on npm and PyPI.

- Equations spoken and written in 16 languages.
- The npm package `@mathlabs/mathra` for Node, bundlers and browsers, and the Python package on PyPI with the same API.
- A browser playground on GitHub Pages, compared with KaTeX and MathJax; `render` returns every output as one JSON.
- `|x|` read as absolute value and `‖v‖` as norm; function scripts stay attached to the name in the linear text.

Equations: `euler` `ptbr` `\left| x \right| + \left\| v \right\|`

## 1.0.0 - 2026-10-17

Math LaTeX to a tree of meaning, accessible SVG, speech and text.

- The core: LaTeX read into a tree of meaning and drawn with explicit, numbered rules, as SVG that carries its speech, source and tree.
- The `mathra` command with `--explain`, `--batch` and the speech, text and tree outputs; `tex_to_svg` and `tex_to_tree` for Python, `texToSvg` and `texToTree` for wasm.
- TeX's quote ligatures in text become typographic quotes; a benchmark over a hand-written corpus; a README banner drawn by mathra itself.

Equations: `gaussian` `maxwell` `schrodinger`
