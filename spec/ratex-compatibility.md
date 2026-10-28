# RaTeX command compatibility

Reference: the parser and layout sources of RaTeX 0.1.15. This adds useful user-facing commands; it does not claim complete command, macro or pixel compatibility.

## Added commands

| Commands | Meaning and implementation |
| --- | --- |
| `\slashed{D}` | Feynman slash: center a slash glyph over the body, with the `D`, `A`, `k`, `f`, `\partial` optical corrections used by RaTeX/carlisle's slashed package. The slash keeps the math font when the body's alphabet changes. This is separate from `\cancel`'s diagonal. |
| `\htmlStyle{properties}{body}` | Convert the supported drawing properties to math nodes; no HTML is generated. See below. |
| `\mathsfit{…}` | Sans-serif italic Latin letters, using Unicode's mathematical alphabet. Digits remain sans-serif upright. |
| `\frak{…}` | Alias of `\mathfrak`. |
| `\ctg`, `\arcctg` | Function aliases for `\cot` and `\arccot`, using mathra's existing locale rules. |
| `\Overrightarrow{…}` | Stretchable double right arrow above the base. |
| `\overgroup{…}`, `\undergroup{…}` | Top/bottom tortoise-shell group marks, built as outline segments so both fonts work. |
| `\overlinesegment{…}`, `\underlinesegment{…}` | A line above/below the base. |
| `\r{…}` | Ring accent (already accepted in text arguments; now accepted in math too). |
| `\xrightleftarrows[below]{above}` | Alias of the existing `\xtofrom`: opposed arrows that stretch under their labels. |
| `\sixptsize` | The .6-em size declaration; the other LaTeX size declarations now actually change math layout too. |

## Sizes

The math-mode declarations `\tiny`, `\sixptsize`, `\scriptsize`, `\footnotesize`, `\small`, `\normalsize`, `\large`, `\Large`, `\LARGE`, `\huge`, `\Huge` use RaTeX's multipliers .5, .6, .7, .8, .9, 1, 1.2, 1.44, 1.728, 2.074, 2.488.

They apply through the current group's end (or table-cell delimiter). Nested declarations replace the current absolute declaration; `\Huge{\normalsize x}` gives a normal-sized x, not a huge x. Explicit sizing also resets script style to text style, as RaTeX does. The output's caller-supplied em is still the base unit. Size commands inside running `\text{…}` retain the existing text reader's handling; this is not a general document typography engine.

## htmlStyle

Supported properties follow RaTeX's drawing subset:

- `color`, `background`, `background-color`: foreground/background color using the existing reader's color spellings. The background exactly covers the box, without `\colorbox` padding.
- `font-size`: positive, finite `em`, `rem`, `%`, `px` (16 px is 1 em).
- `font-weight`: `bold`, `bolder`, numeric weights >= 600.
- `font-style`: `italic`, `oblique`.
- `text-decoration`, `text-decoration-line`: an `underline` token.

Later declarations replace earlier values for the same property. Unknown CSS properties are ignored, as in RaTeX. Values are not copied into a browser stylesheet. URLs and executable CSS are not rendering features. This does not implement arbitrary HTML/CSS or RaTeX's internal `\html@mathml` command.

## Accessible outputs and boundaries

Feynman slash has its own localized speech, `slashed(…)` linear text, and `Canceled { shape: Slash }` in the semantic tree. Neither supported braille code currently implements a Feynman-slash modifier; it keeps the base and reports `╱` in `missing`, rather than silently treating it as algebraic cancellation.

Text, speech, native SVG and the tree preserve the body of style wrappers. Alphabet and decorative geometry still depend on the selected font. `\xrightequilibrium` and `\xleftequilibrium` (unequal-length harpoon pairs), advanced TeX primitives and other untested commands remain outside this batch. Multi-row equation-number alignment is a separate layout gap.

Tests: `crates/core/tests/ratex_commands.rs`, in both inline/display styles and enabled fonts, plus L-SIZ-1 in `tests/rules.rs`. No RaTeX dependency is needed at build or test time.
