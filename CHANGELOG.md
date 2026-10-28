# Changelog

What changed in each release of mathra: the crates `mathra` and `mathra-cli`, `@mathlabs/mathra` on npm and `mathra` on PyPI, which are released together. The site shows the same, with the equations drawn live: [the project's evolution](https://matheusmota-dev-br.github.io/mathra/changelog.html).

Each release has a headline (the line under its title), what changed, and the equations that show it (`Equations:`): a name from the gallery ([`corpus/gallery.json`](corpus/gallery.json)) or the LaTeX itself, drawn by the site with today's mathra. `scripts/release.sh` will not release a version without its section here, and makes the GitHub release from it.

## Unreleased

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
