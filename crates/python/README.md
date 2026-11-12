<p align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/banner.svg" alt="mathra" width="100%"></p>

# mathra

Math LaTeX to accessible SVG, without a TeX install, chemistry (chemfig structures, reaction schemes, mechanisms) and commutative diagrams (tikz-cd, xymatrix) included. Every SVG carries the phrase a screen reader says, in 16 languages, and draws with the STIX Two Math font embedded, so it looks the same everywhere. **[Try it in the browser](https://matheusmota-dev-br.github.io/mathra/)**.

```sh
pip install mathra
```

Wheels for Linux, macOS and Windows, for Python 3.9 and later; nothing else to install.

## Usage

```python
import mathra

svg = mathra.tex_to_svg(r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}")
open("quadratic.svg", "w", encoding="utf-8").write(svg)

r = mathra.render(r"\frac{3}{4}", locale="fr")
r["speech"]        # 'trois quarts'
r["warnings"]      # [] — broken LaTeX is drawn anyway and reported here (E-REC-*)

mathra.tex_to_svg(r"\sum_{n=1}^{\infty} \frac{1}{n^2}", display=False)   # inline style
mathra.tex_to_svg(r"\vertA\vert", strict=True)                           # ValueError, like TeX
mathra.render("sqrt(x)/2", input="asciimath")["speech"]                   # also input="mathml"
mathra.render(r"\chemfig{H_3C-*6(=-=-=-)}")["speech"]                     # 'structure of C7 H8, with 1 aromatic ring'

png = mathra.tex_to_png(r"e^{i\pi} + 1 = 0", background="white")           # PNG bytes, 300 dpi
open("euler.png", "wb").write(png)
```

| | |
|---|---|
| `tex_to_svg(tex, locale="en", *, display=True, strict=False, input="latex", braille=None, animate=False, steps=False, max_width=None, fallback_fonts=None, labels=None, citations=None)` | The SVG as a string. |
| `render(tex, locale="en", *, display=True, strict=False, input="latex", braille=None, animate=False, steps=False, max_width=None, fallback_fonts=None, labels=None, citations=None)` | A dict: `svg`, `speech`, `text`, `braille`, `braille_code`, `mathml`, `tree`, `applied`, `warnings`, `boxes`. `mathml` is the equation as MathML Core (`display` decides `display="block"` or `"inline"`), with `intent` where it adds meaning, and a `<semantics>` with the source for what MathML cannot draw ([spec/mathml.md](https://github.com/matheusmota-dev-br/mathra/blob/main/spec/mathml.md)). | |
| `tex_to_png(tex, locale="en", *, display=True, strict=False, input="latex", braille=None, font=None, dpi=300, background=None, color="#111", max_width=None, fallback_fonts=None, labels=None, citations=None)` | The PNG as bytes. |
| `tex_to_tree(tex, locale="en", *, display=True, strict=False, input="latex", braille=None, animate=False, steps=False, max_width=None, fallback_fonts=None, labels=None, citations=None)` | The tree of meaning as JSON. |
| `locales()` | `[{"code": "en", "name": "English"}, …]`: en, pt-BR, es, fr, de, it, ru, zh, ja, ko, hi, ar, id, tr, nl, pl. |

`input` is `"latex"`, `"mathml"` or `"asciimath"`; MathML passed as LaTeX, starting with `<math`, is recognized on its own. `braille` is `"cmu"` or `"nemeth"`; by default the locale's (CMU in pt-BR and es, Nemeth elsewhere). `tex_to_png` is for where SVG is not accepted (e-mail, some editors and LMSs): `dpi` is over a 12pt body, so an em is `dpi * 12 / 72` pixels (50 at 300 dpi), each side rounded up to a whole pixel; `background` (transparent by default) and `color`, the ink, are CSS colors, and colors set in the equation keep their own. A PNG is only the drawing, with no speech or source: give it the speech as its alt text. `labels` and `citations` give the numbers of the document's cross-references, which an equation converted alone cannot know: with `labels={"eq:a": 3}` and `citations={"knuth": 1}`, `\eqref{eq:a}` shows `(3)`, `\ref{eq:a}` shows `3` and `\cite{knuth}` shows `[1]`; an unknown key is `(??)`, `??` or `[?]`, as on LaTeX's first run, with a warning (a `ValueError` with `strict=True`). Errors are `ValueError`. Types are included (`py.typed`).

## What it draws

Every image below is an SVG written by mathra, on a white card so it reads well on dark pages.

<table>
<tr><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/quadratic.svg" alt="Quadratic formula"><br><sub>Quadratic formula</sub></td><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/gaussian.svg" alt="Gaussian integral"><br><sub>Gaussian integral</sub></td></tr>
<tr><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/matrix.svg" alt="m × n matrix with dots"><br><sub>Matrix with dots</sub></td><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/piecewise.svg" alt="Piecewise definition"><br><sub>Piecewise definition</sub></td></tr>
<tr><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/chemistry.svg" alt="Chemical equation (mhchem)"><br><sub>Chemistry (<code>\ce</code>)</sub></td><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/units.svg" alt="Quantity with units (siunitx)"><br><sub>Units (<code>\SI</code>)</sub></td></tr>
<tr><td align="center" colspan="2"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/maxwell.svg" alt="Maxwell's equations"><br><sub>Maxwell's equations</sub></td></tr>
<tr><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/caffeine.svg" alt="Caffeine: fused rings (chemfig)"><br><sub>Caffeine (<code>\chemfig</code>)</sub></td><td align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/tikzcd.svg" alt="Pullback with bent arrows (tikz-cd)"><br><sub>Commutative diagram (tikz-cd)</sub></td></tr>
<tr><td align="center" colspan="2"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/examples/nitration.svg" alt="Nitration of benzene: structures, mhchem and conditions on the arrow"><br><sub>Reaction scheme (<code>\schemestart</code>)</sub></td></tr>
</table>

## Chemistry and diagrams

chemfig works inside any equation: structures (rings, wedges, Lewis marks), reaction schemes (`\schemestart … \arrow{->[above][below]} … \schemestop`) and mechanism arrows (`\chemmove`). The speech gives each structure's molecular formula, counted from the drawing. Commutative diagrams come in amscd, tikz-cd and xymatrix. Every construction, drawn live, is in the [gallery](https://matheusmota-dev-br.github.io/mathra/gallery.html) and the [reference](https://matheusmota-dev-br.github.io/mathra/reference.html).

## What the SVG carries

Speech in `<title>` linked with `aria-labelledby`, the source equation and the tree of meaning in `<metadata>`, color from the page (`currentColor`), size in `em`, a selectable text layer and ids unique to each equation. The same input always gives the same bytes, in Python and in every other package.

With `animate=True` the equation writes itself in the browser, with CSS alone: each glyph fades in, each rule grows and each line is drawn, in the order the layout set them, in about three seconds (nothing moves with `prefers-reduced-motion`); `steps=True` numbers each element by that order (`data-step`) with no animation. Both are off by default, and without them the SVG is unchanged byte for byte.

With `max_width=30` (in em) an equation wider than that is broken into lines: after a relation (`=`, `≤`, `→`…), and only when relations alone are not enough, after `+` and `−` too, only at its top level (never inside a fraction, a root, `\left…\right`, scripts or a table). Each line is a `<g data-line>` of the SVG; speech, text and braille do not change.

## Other math fonts

STIX Two Math is embedded and is the default. Any OpenType math font (an `.otf` or `.ttf` with a MATH table, such as Libertinus Math or Fira Math) can be loaded from a path or its bytes:

```python
font = mathra.load_font("LibertinusMath-Regular.otf")  # Font(id=0, name='Libertinus Math')
mathra.tex_to_svg(r"e^{i\pi} + 1 = 0", font=font)
```

A font without a MATH table raises ValueError. The SVG carries the font's outlines, so check that its license allows that.

The fonts of [mathfonts](https://matheusmota-dev-br.github.io/mathfonts/), a catalog of math fonts checked with mathra, load by their name. Nothing is downloaded until you ask; a font is downloaded once, kept in `~/.cache/mathra/fonts` (`$XDG_CACHE_HOME` or `$MATHRA_CACHE` when set, `cache=` for another folder, `cache=False` for none) and refused if it does not match the catalog's sha256:

```python
mathra.catalog_fonts()  # [{'slug': 'euler-math', 'name': 'Euler Math', 'license': 'OFL-1.1', ...}, ...]
font = mathra.load_font_from_catalog("euler-math")
mathra.tex_to_svg(r"e^{i\pi} + 1 = 0", font=font)
```

All the fonts of the catalog are under licenses that let the SVG carry their outlines (OFL, GUST, Apache-2.0, MIT).

## Emoji and other characters the math font lacks

Emoji are drawn from Noto Emoji (the monochrome one), embedded in the package: `mathra.tex_to_svg("E = mc^2 😀")` draws the face, with no warning, in the text color. For other characters the math font lacks, such as Chinese in `\text{…}`, pass fallback fonts: any `.otf` or `.ttf` with outlines, tried in order before Noto Emoji. A math font from `load_font` can be one too.

```python
cjk = mathra.load_fallback_font("NotoSansSC-Regular.otf")  # FallbackFont(id=0, name='Noto Sans SC')
mathra.tex_to_svg(r"\text{面积} = \pi r^2", fallback_fonts=[cjk])
```

A character no font has is drawn as a box, with the warning E-REC-8, or raises ValueError with `strict=True`. Noto Emoji adds about 540 KB to the wheel.

## Also for JavaScript, Rust and the terminal

The same core is an npm package (`@mathlabs/mathra`), a Rust crate and a command-line tool: [github.com/matheusmota-dev-br/mathra](https://github.com/matheusmota-dev-br/mathra#install-and-use). Rules, languages and the full list of supported commands are there too.

## License

The code is MIT or Apache-2.0; the embedded STIX Two Math and Noto Emoji fonts are under the SIL Open Font License 1.1.
