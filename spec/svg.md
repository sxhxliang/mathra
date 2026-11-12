# The SVG contract

A mathra SVG is an outline drawing that carries the speech, the source and the tree along with it. The default web output follows every item below and has a test in `crates/core/tests/rules.rs`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:mathra="urn:mathra:1"
     viewBox="0 -645 1730 658" width="1.73em" height="0.658em"
     style="vertical-align: -0.013em"
     role="img" aria-labelledby="mathra-0f561d1c-speech" lang="en" data-mathra-version="1.6.0">
  <title id="mathra-0f561d1c-speech">3.14</title>
  <metadata>
    <mathra:source type="latex">3.14</mathra:source>
    <mathra:tree>{"type":"row","children":[{"type":"number","value":"3.14"}]}</mathra:tree>
    <mathra:braille code="nemeth">⠼⠒⠨⠂⠲</mathra:braille>
    <mathra:font>STIX Two Math</mathra:font>
  </metadata>
  <style>svg:root{color:#111}</style>
  <defs><path id="mathra-0f561d1c-g19" d="…"/> …</defs>
  <g fill="currentColor" transform="scale(1,-1)"><use href="#mathra-0f561d1c-g19" x="0"/> …</g>
  <text … fill="transparent" aria-hidden="true">3.14</text>
</svg>
```

Warnings from tolerant mode go into the metadata as `<mathra:warning rule="E-REC-1">…</mathra:warning>`.

### S-SVG-1 · Size and baseline

Coordinates in font units, with the baseline at y = 0. `width` and `height` in `em`, to follow the size of the surrounding text. `vertical-align` lowers the SVG by its depth, lining up the equation's baseline with the text's.

The view covers the equation's box and every bit of ink that passes it: an SVG clips what falls outside its view, and some ink does pass the box TeX measures (the hook of a bold f at the end of an equation, the tail of ρ at its start, the line of `\cancel`). Where no ink passes, the view is the box, starting at x = 0; where it does, the view starts before 0 or ends after the width by exactly that much, never by a fixed margin.

A formula broken into lines (S-SVG-12) keeps the same rules: the baseline at y = 0 is the first line's, and `vertical-align` lines it up with the text; the height is what rises above it, and the depth covers every line below, so `height` spans all the lines. The width is the widest line, indent included.

### S-SVG-2 · Speech

`role="img"` and `aria-labelledby` pointing to a `<title>` with the phrase in the locale's language.

### S-SVG-3 · Recoverable source

`<metadata>` keeps the original input, with its notation in `<mathra:source type="latex|mathml|asciimath">`, the tree of meaning as JSON and the font name. The namespace is `urn:mathra:1`.

### S-SVG-4 · Color

Glyphs use `fill="currentColor"`.

- **Inline in a page**, the SVG inherits the text color, and the page theme applies.
- **As a standalone document** (`<img>`, an opened file), `svg:root` matches and applies a fixed dark ink (`#111`).

A `<style>` inside an inline SVG applies to the whole page. That is why the only rule is `svg:root`, which does not match when the SVG is inside HTML.

> **Open decision.** Inside `<img>`, the image does not know the page theme. Following `prefers-color-scheme` made the equation almost invisible on a light page with the system in dark mode (Chrome). A `--theme` option may come later.

### S-SVG-5 · Each glyph drawn once

Each glyph becomes a `<path>` in `<defs>`, in order of first appearance, and is reused with `<use>`. A turned or unevenly scaled box (`\rotatebox`, `\scalebox{2}[1]`, L-BOX-1) is a `<g transform="matrix(…)">` around its drawing; its glyphs are in `<defs>` like the others.

A character the math font lacks comes from the first fallback font that has it (`Options::fallback_fonts`; Noto Emoji, the monochrome one, with the `emoji` feature, on in the CLI and the Python package). Its outline is a `<path>` in `<defs>` like the others, once however many times it is used, with an id that names its font: `…-g42` is the math font's glyph 42, `…-f1a2b3c4g42` glyph 42 of the fallback font whose tag is `1a2b3c4` (a hash of its bytes, or of its name for an embedded font). It is scaled from its font's em to the math font's, sits on the baseline, has no italic correction, and is an ordinary symbol (class Ord). It is filled with `currentColor` like every glyph (S-SVG-4): color layers (COLR, CBDT, SVG) are not read, only outlines (`glyf`, `CFF`, `CFF2`). `<mathra:font>` keeps the math font's name. Speech, text and braille do not change: they keep the character, as for any character without a name (braille writes the full cell ⠿, S-BRL-1). A character no font has is a box, or refused in strict mode (E-REC-8).

### S-SVG-6 · Text layer

A transparent `<text>`, stretched with `textLength` over the width of the equation, holding the linear text (`3.14 + x`). When the SVG is inline in the page, selection and find-in-page pick up this text. Inside `<img>`, nothing is selectable: that is a browser rule.

### S-SVG-7 · Unique ids per equation

Ids (`…-speech`, `…-g19`) start with a prefix derived from the input, the locale and the version (32-bit FNV-1a). Several equations on one page do not clash, and the same equation always gets the same ids (D-DET-1).

### S-SVG-8 · Always valid XML

All text that comes from outside (source, speech, linear text, warnings, colors) is escaped for `& < > "`. Characters XML 1.0 cannot take even when escaped (control characters from U+0000 to U+001F except tab, LF and CR, plus U+FFFE/U+FFFF) become U+FFFD. Without this, a `\0` pasted into the input made the SVG unreadable for every browser.

### S-SVG-9 · Braille

`<metadata>` also keeps the equation in braille, as Unicode braille cells, with its code: `<mathra:braille code="cmu|nemeth">`. A braille display or an app can read it without converting the equation again. What each code covers is in `braille.md`.

### S-SVG-10 · Steps and the writing animation

Off by default; without them the SVG is the same, byte for byte.

- **Steps** (`steps`, `--steps`): each glyph, rule, line and ellipse carries `data-step="k"`, from 0, in the order the layout set it (numerator before denominator, the content before the delimiters it measured), and the `<svg>` carries `data-steps` with the count. No CSS: a page can walk through the equation itself, showing the elements whose step is below k.
- **Animation** (`animate`, `--animate`, steps included): the equation writes itself, with CSS alone, in that order. A glyph fades in; a rule grows along its length (a wide one from the left, a tall one from the top); a line or an ellipse (`\cancel`, `\phase`, `\textcircled`) is drawn along its length (`pathLength="1"`). The whole equation takes about three seconds: the interval between two steps is 3 s divided by their count, at most 0.15 s. Each element carries its index (`style="--i:k"`) and the `<svg>` the interval (`--mr-step`): the `<style>` itself is the same in every equation, since an inline SVG's style applies to the whole page, and two animated equations on one page must not change each other's timing. With `prefers-reduced-motion: reduce` nothing moves.

### S-SVG-11 · HTML attributes on part of the equation

MathJax's `\class`, `\cssId` and `\style` and KaTeX's `\htmlClass`, `\htmlId`, `\htmlStyle` and `\htmlData` put their content in a `<g>` that carries `class`, `id`, `style` or `data-*`, so a page can style or animate that part (`\class{highlight}{x^2}` gives `<g class="highlight">`). The content is drawn exactly as without them; speech, linear text and braille ignore them. They are read in strict mode too.

What comes from the input is made safe before it reaches the SVG, and what is dropped is a warning (E-REC-9):

- classes, ids and `data-` keys keep only `A–Z a–z 0–9 _ -` (several classes stay separated by spaces); `data-` keys are lowercased, and their values are escaped like any text (S-SVG-8);
- a style keeps only `color`, `background`, `background-color` and `opacity`, with plain values (letters, digits, `#(),.% -`): no `url(`, no `expression(`, no quotes, `;`, `<` or `>`.

The `\htmlStyle` command additionally applies the native font-size, font-weight, font-style and underline properties described in [RaTeX compatibility](ratex-compatibility.md); those properties become math nodes rather than CSS attributes.

A style's `color` also colors the content, as `\color` does, so the glyphs carry it as `fill` and outputs without CSS have it too. An id is the author's: two equations with the same `\cssId` on one page share it.

### S-SVG-12 · Lines

Off by default: only with a maximum width (`max_width`, `--max-width`, `{ maxWidth }`) and only when the formula is wider than it is broken (L-BRK-1); otherwise the SVG is the same, byte for byte. A broken formula draws each line in its own group, in order, inside the drawing's `<g>`, and the `<svg>` carries `data-lines` with their count:

```xml
<svg … data-lines="2">
  …
  <g fill="currentColor" stroke="none" transform="scale(1,-1)">
    <g data-line="0"><use …/> …</g>
    <g data-line="1"><use …/> …</g>
  </g>
```

Lines are numbered from 0, as steps are (S-SVG-10), and the steps run on across them. The glyphs of every line are in the one `<defs>`. Each line's baseline sits below the previous one by its depth and the next line's height, each at least a strut's (0.36 em and 0.84 em, `\baselineskip` 12pt at 10pt), plus `\jot` (0.3 em) in display style, as amsmath's `multline` and `split` space their lines: 1.5 em between plain lines in display style, 1.2 em inline. The speech, the metadata and the text layer (S-SVG-6, still as wide as the drawing) do not change.

## Native image variant

`render_svg` uses the same glyph paths, source/speech/tree/braille metadata and ink bounds, with explicit native-image variants of S-SVG-1 (absolute logical dimensions, including the baseline), S-SVG-4 (an explicit foreground) and S-SVG-6 (no transparent text layer). See [native image output](native-svg.md). The default `convert` and public `output::svg::generate` contracts are unchanged.
