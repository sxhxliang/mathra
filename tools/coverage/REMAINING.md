# What the coverage run still flags, and why

Measured on 2026-11-09 with `tools/coverage` (the Stacks Project, 95 arXiv papers, the mhchem and chemfig manuals): 174,505 distinct formulas, of which 202 convert with a warning or are refused. Each one is in exactly one group below, with the reason it stays. A later run that flags a formula outside these groups is news: a regression, or a gap to look at.

Regenerate the numbers with the commands of [README.md](README.md); `report.py` lists every problem with its examples.

## Right as it is (56)

| Formulas | What | Why it stays |
|---|---|---|
| 54 | `\ref`, `\eqref`, `\cite` with no number | A formula converted alone cannot know the document's numbers. mathra draws `??` or `[?]`, as LaTeX's first run, and warns; the `labels` and `citations` options give the numbers. |
| 2 | `\'e` inside math (the Stacks Project's `X_{spaces, \'etale}`) | A text accent in math is an error in LaTeX; mathra reads it as `\acute` and says so. |

## Outside what mathra converts (113)

| Formulas | What | Why |
|---|---|---|
| 77 | TeX programming inside a formula: `\setbox`, `\wd`, `\settoheight`, `\dimexpr`, `\expandafter`, `\def` with delimited parameters (inside TikZ loops), `\hskip` in text | mathra expands macros; it does not run TeX programs (spec/boundary.md). These are a paper's own constructions of a symbol (a slashed integral built with `\setbox`, for instance). |
| 14 | `customsmallmatrix`, a paper's own environment | It is amsmath's `smallmatrix` rewritten with package internals (`\Let@`, `\ialign`), which the extraction leaves alone as package programming. mathra reads it as a table and says so. |
| 10 | `tikzpicture` inside a formula | Drawings are outside mathra; diagrams are read as tikz-cd, xymatrix and amscd. |
| 4 | `\young`, `\yng` | Young diagrams (youngtab) are outside mathra, by decision. |
| 3 | chemfig arrows `s>` and `-.>` | They are not chemfig's: the manual defines them with `\definearrow` and TikZ code, as examples of how to define an arrow. |
| 3 | A chemfig ring with more bonds than sides | The manual shows it on purpose: chemfig leaves the extra bonds out, and so does mathra, with a warning. |
| 1 | latexdiff markup (`\DIFdelbegin`) | A diff of two versions of a paper, not a formula. |
| 1 | `\arabic*` | An `enumerate` label taken for a formula by the extraction. |

## Macros the extraction cannot see (8)

| Formulas | What | Why |
|---|---|---|
| 6 | The chemfig manual's own macros: `\typoscale`, `\frame`, `\Blue`, `\Red` | They come from the manual's style files, which the extraction does not download (it keeps only the manual's `.tex`). |
| 2 | `\nm` (hep-th), `\mathsection` (Stacks) | Defined in a way the extraction does not expand. |

## Errors in the document itself (3)

| Formulas | What |
|---|---|
| 2 | hep-th 2611.07557, line 885: text read as a formula after a `\(`…`\)` and a `$` the paper mixes on one line. |
| 1 | math.CO 2611.08244, line 1263: `\{\large…}`, a `\{` written for `{`. |

## Known gaps, not done (22)

Real constructions mathra does not draw yet. Each one is rare and was left for a reason given here.

| Formulas | What | Why it is not done |
|---|---|---|
| 14 | chemfig styles: a compound's fill, color or delimiters (`\arrow([fill=blue]--…)`), `\merge`'s style (`red,thick`) and its rotated labels (`*{45.north east}`) | Cosmetic: mathra draws the scheme right and warns that the style is ignored. Left for later, as agreed. |
| 2 | xymatrix arrows that turn, `` \ar `r[d] `d[l] [dll] `` (the Stacks Project) | The path of each turn follows xy-pic's reference; drawing it from a guess could draw it wrong without a warning. Today the arrow is left out, with a warning. |
| 2 | `tabular` inside a formula (math.CO, physics.chem-ph) | A text table with `$…$` cells inside math; mathra reads `array`, not `tabular`. |
| 2 | An arrow from a `\subscheme` box that holds only a `+` (`A\subscheme{\+}BCDEF … \arrow(@c2--)`), or whose number depends on how `\chemleft` counts (`\arrow(@c4--)` after `\chemleft[\subscheme…]`) | The box has no compound of mathra's to leave from, and the manual does not say how `\chemleft` is numbered. The arrow leaves from the last compound, with a warning. Arrows from a box with compounds in it are drawn. |
| 1 | A chemfig ring whose code starts with an atom, `*6(R\rlap{$'$}-N=…)` | The manual uses it in one example without saying what it means. |
| 1 | `\chemleft{[}` inside a `\charge` argument | `\chemleft{[}` is read everywhere else; inside `\charge` it goes through the atom label reader. |
