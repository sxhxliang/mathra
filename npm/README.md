<p align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/banner.svg" alt="mathra" width="100%"></p>

# @mathlabs/mathra

Math LaTeX to accessible SVG, without a TeX install, chemistry (chemfig structures, reaction schemes, mechanisms) and commutative diagrams (tikz-cd, xymatrix) included. Every SVG carries the phrase a screen reader says, in 16 languages, and draws with the STIX Two Math font embedded, so it looks the same everywhere. **[Try it in the browser](https://matheusmota-dev-br.github.io/mathra/)**.

```sh
npm install @mathlabs/mathra
```

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

And what a screen reader hears, from the SVG's `<title>`:

| Equation | `locale` | Speech |
|---|---|---|
| `x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}` | `en` | x equals fraction, negative b plus or minus square root of b squared minus 4 a c, end root, over 2 a, end fraction |
| `\frac{3}{4} + \sqrt{x}` | `fr` | trois quarts plus racine carrée de x |
| `\frac{3}{4} + \sqrt{x}` | `ja` | 4 分の 3 プラス ルート x |
| `\sin^2 \theta + \cos^2 \theta = 1` | `pt-BR` | seno ao quadrado de teta mais cosseno ao quadrado de teta é igual a 1 |
| `\chemfig{H_3C-*6(=-=-=-)}` | `en` | structure of C7 H8, with 1 aromatic ring |
| `\begin{tikzcd} A \arrow[r, "f"] & B \end{tikzcd}` | `en` | diagram: row 1: A, B; arrow from A to B (f) |

## Node

Works right away:

```js
import { texToSvg, render } from "@mathlabs/mathra";      // or: const { texToSvg } = require("@mathlabs/mathra")

const svg = texToSvg(String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`);
const { speech } = render(String.raw`\frac{3}{4}`, { locale: "fr" });   // "trois quarts"
```

## Browsers and bundlers (Vite, webpack, esbuild)

Await `init()` once; it fetches `mathra.wasm` next to the module:

```js
import { init, texToSvg } from "@mathlabs/mathra";

await init();
document.querySelector("#eq").innerHTML = texToSvg(String.raw`e^{i\pi} + 1 = 0`);
```

Without a bundler, from a CDN:

```html
<script type="module">
  import { init, texToSvg } from "https://cdn.jsdelivr.net/npm/@mathlabs/mathra/web/index.js";
  await init();
  document.body.innerHTML = texToSvg("3,14", { locale: "pt-BR" });
</script>
```

## API

| | |
|---|---|
| `init(input?)` | Loads the wasm. Needed once in browsers and bundlers; does nothing in Node. `input` overrides where the wasm comes from (a URL, a `Response`, bytes or a `WebAssembly.Module`). |
| `texToSvg(tex, options?)` | The SVG as a string. |
| `render(tex, options?)` | `{ svg, speech, text, braille, braille_code, mathml, tree, applied, warnings, boxes }`. `mathml` is the equation as MathML Core (`display` decides `display="block"` or `"inline"`), with `intent` where it adds meaning, and a `<semantics>` with the source for what MathML cannot draw ([spec/mathml.md](https://github.com/matheusmota-dev-br/mathra/blob/main/spec/mathml.md)). `boxes` has the box of each group marked with `\htmlData`, `\htmlId` or `\class`, in the SVG's coordinates: what an editor needs to place a cursor. |
| `locales()` | `[{ code: "en", name: "English" }, …]`. |
| `version` | The version of mathra's core inside the package (the npm package has its own version). |

Options: `locale` (`"en"` by default, `"pt-BR"`, `"es"`, `"fr"`, `"de"`, `"it"`, `"ru"`, `"zh"`, `"ja"`, `"ko"`, `"hi"`, `"ar"`, `"id"`, `"tr"`, `"nl"`, `"pl"`), `display` (`true` by default; `false` for inline style) `strict` (`false` by default: broken LaTeX is drawn with warnings instead of throwing) and `input` (`"latex"` by default, `"mathml"` or `"asciimath"`; MathML passed as LaTeX, starting with `<math`, is recognized on its own) and `braille` (`"cmu"` or `"nemeth"`; by default the locale's: CMU in pt-BR and es, Nemeth elsewhere), `animate` (`false` by default; `true` makes the SVG write itself in the browser) `steps` (`false` by default; `true` numbers each element by its step, `data-step`, with no animation) and `maxWidth` (in em, none by default: a wider equation is broken into lines after a relation, or also after `+` and `−` when relations alone are not enough, only at its top level, each line a `<g data-line>` of the SVG; speech, text and braille do not change), `labels` and `citations` (objects from a key to its number, for the cross-references an equation converted alone cannot know: with `{ labels: { "eq:a": 3 }, citations: { knuth: 1 } }`, `\eqref{eq:a}` shows `(3)`, `\ref{eq:a}` shows `3` and `\cite{knuth}` shows `[1]`; an unknown key is `(??)`, `??` or `[?]`, as on LaTeX's first run, with a warning, or an error with `strict`). A plain string as the second argument is read as the locale.

## Chemistry and diagrams

chemfig works inside any equation: structures (rings, wedges, Lewis marks), reaction schemes (`\schemestart … \arrow{->[above][below]} … \schemestop`) and mechanism arrows (`\chemmove`). The speech gives each structure's molecular formula, counted from the drawing. Commutative diagrams come in amscd, tikz-cd and xymatrix.

```js
render(String.raw`\chemfig{*6((=O)-N(-CH_3)-*5(-N=-N(-CH_3)-=)--(=O)-N(-H_3C)-)}`).speech;
// "structure of C8 H10 N4 O2, with 1 aromatic ring, with 1 ring"
render(String.raw`\schemestart \ce{N2 + 3H2} \arrow{<=>[Fe]} \ce{2NH3} \schemestop`).text;
// "N_2 + 3 H_2 ⇌[Fe] 2 NH_3"
```

Every construction, drawn live, is in the [gallery](https://matheusmota-dev-br.github.io/mathra/gallery.html) and the [reference](https://matheusmota-dev-br.github.io/mathra/reference.html).

## What the SVG carries

Speech in `<title>` linked with `aria-labelledby`, the source equation and the tree of meaning in `<metadata>`, color from the page (`currentColor`), size in `em`, a selectable text layer and ids unique to each equation. The same input always gives the same bytes.

With `{ animate: true }` the equation writes itself, with CSS alone: each glyph fades in, each rule grows and each line is drawn, in the order the layout set them, in about three seconds (nothing moves with `prefers-reduced-motion`). Off by default, and without it the SVG is unchanged byte for byte. The [playground](https://matheusmota-dev-br.github.io/mathra/) turns it into a GIF, a video or an animated SVG with its own play bar.

## Other math fonts

STIX Two Math is embedded and is the default. Any OpenType math font (an `.otf` or `.ttf` with a MATH table, such as Libertinus Math or Fira Math) can be loaded from its bytes:

```js
import { readFile } from "node:fs/promises";
const font = loadFont(await readFile("LibertinusMath-Regular.otf")); // { id, name }
texToSvg(String.raw`e^{i\pi} + 1 = 0`, { font });
```

A font without a MATH table is refused. The SVG carries the font's outlines, so check that its license allows that.

The fonts of [mathfonts](https://matheusmota-dev-br.github.io/mathfonts/), a catalog of math fonts checked with mathra, load by their name. Nothing is downloaded until you ask; each font is downloaded once and refused if it does not match the catalog's sha256 (in Node this needs Web Crypto, Node 19 or later):

```js
const fonts = await catalogFonts(); // [{ slug, name, style, license, url, size, sha256, coverage, … }]
const font = await loadFontFromCatalog("euler-math");
texToSvg(String.raw`e^{i\pi} + 1 = 0`, { font });
```

All the fonts of the catalog are under licenses that let the SVG carry their outlines (OFL, GUST, Apache-2.0, MIT).

## Emoji and other characters the math font lacks

A character the math font does not have is drawn as a box, with the warning E-REC-8 (or refused with `strict`). Fallback fonts fill the gap: they are tried in order, and the glyph's outline goes in the SVG like any other, in the text color. Any `.otf` or `.ttf` with outlines works, MATH table or not, such as [Noto Emoji](https://fonts.google.com/noto/specimen/Noto+Emoji) (the monochrome one) or a CJK font for `\text{…}`. A math font from `loadFont` or `loadFontFromCatalog` can be one too.

```js
const emoji = loadFallbackFont(await readFile("NotoEmoji-Regular.ttf")); // { id, name, fallback: true }
texToSvg("E = mc^2 😀", { fallbackFonts: [emoji] });
```

The npm package embeds no emoji font, to keep the download small; the Python package and the terminal embed Noto Emoji, so emoji are drawn there without asking, and give a box here unless you pass a font.

## Also for Python, Rust and the terminal

The same core is a Python module, a Rust crate and a command-line tool, and every one gives the same SVG, byte for byte (emoji aside: see above). How to install each: [github.com/matheusmota-dev-br/mathra](https://github.com/matheusmota-dev-br/mathra#install-and-use). Rules, languages and the full list of supported commands are there too.

## License

The code is MIT or Apache-2.0; the embedded STIX Two Math font is under the SIL Open Font License 1.1.
