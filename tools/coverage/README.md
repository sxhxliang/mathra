# Coverage over real LaTeX

Takes formulas out of large real documents (the Stacks Project, arXiv papers in math, physics and chemistry, the mhchem and chemfig manuals), converts each one with mathra and with KaTeX, and reports what mathra is missing, what it gets wrong and where it crashes.

```console
python3 tools/coverage/fetch.py                        # sources into target/coverage/sources/
python3 tools/coverage/extract.py                      # formulas.jsonl
cargo run --release -p mathra --example coverage       # results.jsonl
node tools/coverage/katex.mjs                          # katex.jsonl (npm install in bench/ first)
python3 tools/coverage/report.py                       # REPORT.md and summary.json
```

Everything downloaded or produced stays under `target/coverage/`, which git ignores: the sources keep their own licenses. The repository keeps only these scripts and `arxiv-ids.txt`, the list of papers, so a later run measures the same ones. Deleting that list picks the newest papers again.

What the run still flags, each formula with the reason it stays, is in [REMAINING.md](REMAINING.md).

What counts as what:

- `ok`: converted with no warning. It does not mean the drawing is right; nobody looked at the SVG.
- `warn`: converted, with something not understood and worked around (usually drawn in red).
- `error`, `panic`, `timeout`: refused, crashed, or no answer in 10 s.

A document's own macros (`\newcommand`, `\def`, `\DeclareMathOperator`, `\newenvironment`) are expanded before conversion, because mathra converts a formula, not a document. Macros built from `@` internals are package programming and are left alone. A chemfig structure that calls a submolecule (`!{name}`) gets the document's `\definesubmol` for it in front, the nearest one before it. The only other change to the input is removing `\label{…}`.

What looks like a formula and is not one is left out: a `$…$` that crosses a blank line (TeX ends math at a paragraph, so it is the text between two formulas, after a stray `$` put the pairing out of step; skipping it puts the pairing back in step), anything with a macro parameter `#1` (it is inside a definition, a `\tikzset` style say), and `\schemestart` quoted in a manual's text (`|\schemestart|`). A line a `%` comment emptied is no paragraph break, as in TeX. A `$` inside braces does not close a `$…$`: it is the inner math of `\text{$x$}` or of mhchem's `\ce{NaOH(aq,$\infty$)}`.
