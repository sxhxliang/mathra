# Office Math output

## S-OMML-1 — standalone native formula fragments

`mathra::tex_to_omml(source) -> Result<String, OmmlError>` parses LaTeX strictly
and returns one self-contained `<m:oMath xmlns:m="…">…</m:oMath>` element.
It contains no XML declaration, paragraph, document, SVG or image. Insert the
fragment directly into `w:p`, optionally wrapped in `m:oMathPara` for display.
`output::omml::generate(&Node)` accepts an existing semantic tree. Conversion
requires neither glyph lookup nor SVG layout.

Text/attributes are XML escaped; XML 1.0 invalid controls become U+FFFD. Unknown
or invalid LaTeX returns `OmmlError::Parse`. Constructs without a corresponding
native representation return `OmmlError::Unsupported`, without flattening them.
The match on `Node` is exhaustive: adding a new node requires an explicit export
decision. Accepted parser macros/packages reuse the same node mappings.

## S-OMML-2 — accents and labels

Upper accents use `m:acc`; lower accents and labeled extensible arrows use
`m:groupChr`. Bars use `m:bar`, braces use `m:groupChr` and optional `m:limLow` /
`m:limUpp` labels. These preserve editable content; exact glyph stretching and
placement depend on the math font, particularly for combining lower tildes.

## S-OMML-3 — compact identical runs

Adjacent sibling `m:r` elements with identical serialized math and Word run
properties are merged. Structural boundaries, different alphabets/styles,
colors and alignment markers remain separate. Escaping and spaces are preserved;
no fixed percentage reduction is promised.

## S-OMML-4 — foreground, background and border colors

Foreground color uses `w:color` on runs and `m:ctrlPr` on structural control
characters (bars, radicals, delimiters, etc.). Inner colors override outer
colors. Supported color values are the 148 CSS named sRGB colors, `currentColor`
(Word `auto`), `#RGB`, `#RRGGBB`, and the parser's `[HTML]` / `[rgb]` forms.
Normalized RGB requires three finite channels in 0–1. Unknown values return an
explicit error. A `w` namespace is included only when Word properties are used.

Background color is native run shading (`w:shd`), including control characters;
it does not promise TeX's single continuous padded rectangle around a complex
formula. Border color is confined to the border-box control properties, leaving
content color independent. Word processing properties compose independently:
color does not replace font size, shading or baseline shifts.

## S-OMML-5 — native node mapping

| Parser nodes / syntax | Native representation |
|---|---|
| Numbers, identifiers, alphabets, operators, text | Math runs with `m:scr` / `m:sty` |
| Function followed by an atom, including scripted functions | `m:func`, `m:fName`, `m:e` |
| Fraction, binomial, zero-thickness fraction | `m:f` (`bar` / `noBar`) |
| Root / indexed root | `m:rad`, degree visibility |
| Postfix scripts / empty-base scripts before an atom | `m:sSub`, `m:sSup`, `m:sSubSup` / `m:sPre` |
| Sum, product, integral family | `m:nary`, explicit visibility and limit position |
| Paired / invisible / middle delimiters | `m:d`; homogeneous middles use `m:sepChr` |
| Matrices, arrays, cases, substack | `m:m`, column `m:mcJc`, hidden empty placeholders |
| aligned / align without intertext | Native matrix with alternating right/left column alignment |
| gathered, intertext | `m:eqArr`; alignment attached to nonempty `m:box` arguments |
| Array `@{…}` insertions | Editable extra matrix cells or equation-array content |
| `smallmatrix`, styles, fraction size variants | `m:box` / `m:argSz` |
| Quantity / named unit nodes | Existing value-space-unit subtree (metadata is not duplicated) |
| `cancel`, `bcancel`, `xcancel`, `slashed` | Hidden-edge `m:borderBox`, diagonal strike properties |
| Rectangle, phase, actuarial-angle frames | `m:borderBox` with selected edges hidden |
| phantom, hphantom, vphantom | Hidden `m:phant` with zero dimension flags |
| smash, smash[t], smash[b] | Visible `m:phant` with zero ascent/descent |
| mathrlap / rlap | Visible zero-width `m:phant` (left-anchored content) |
| raisebox, scalebox, explicit LaTeX font sizes | `w:position`, `w:sz` on runs and controls |
| Positive / negative explicit spaces | Zero-width text plus signed `w:spacing` |
| Fixed-size delimiters | Explicit run size, instead of dropping the requested size |
| vcenter | Centered single-cell native matrix |
| mathchoice | Context-selected display/text/script/scriptscript branch |
| Solid / ruleless proof trees | Nested native fractions; editable premises, conclusions, labels |
| Column arithmetic, long division | Computed native digit matrices, bars and partial borders |

A n-ary operator consumes leading explicit spaces and the next non-relation /
non-binary / non-punctuation atom as its operand. A function takes the next
adjacent atom. Group a longer operand in braces to keep it in the native object.

### Dimensions and fidelity

`tex_to_omml_with(source, &OmmlOptions { font_size: 12.0 })` and
`output::omml::generate_with` configure the destination font size in points for
explicit em dimensions; the default is 12 pt. Match it to the embedding document.
It is a reference for dimension conversion, not a document-wide font setting.
Nested scaling updates that reference. Word size/position/spacing limits apply.

This is structural Office Math output, not pixel-identical TeX layout. Fixed
bracket sizes use font scaling; display/text fraction sizes use argument-size
adjustment; row stretch is quantized to native half-line spacing. Proof and
school layouts use native composition rather than the SVG layout engine's exact
geometry. Feynman slashes use a diagonal strike across the expression, rather
than a separately sized slash glyph. Word decides normal mathematical atom
spacing; arbitrary TeX forced atom classes have no exact general equivalent.

## Explicit format boundaries

The following are rejected because native OMML has no direct faithful feature:

- Matrix column spanning (`multicolumn`, `hdotsfor`), continuous matrix grid
  lines (`hline`, `cline`, vertical rules, dashed rules), and outside border-matrix
  labels (`bordermatrix`). Word document tables are a different output contract.
- Circular frames, arbitrary filled `rule` rectangles, reflection, and left /
  centered overlaps requiring a different horizontal anchor from `mathrlap`.
- Dashed proof rules, structural chemistry drawings, and commutative-diagram
  geometry (including diagram-shaped tables).

Native OMML has no custom fraction rule thickness: zero means no bar; other
thicknesses use Word's bar. Heterogeneous middle delimiters remain operator
runs within one delimiter object. These unsupported *attributes* do not make an
otherwise representable formula fail.

## S-OMML-6 — validation and example

`tests/omml.rs` checks supported structures, formatting scope, metadata,
computation, parser failures, format boundaries and the package/reference corpus.
A fixture extracted from the Microsoft Open XML SDK schema checks sequence child
order across successfully converted corpus formulas. This is a sequence check,
not a claim of complete XSD validation or testing every LaTeX combination.

The example owns DOCX packaging; ZIP remains a development dependency:

```sh
cargo run -p mathra --example omml_docx -- target/equations.docx
```

The result is a minimal OPC package containing editable native formulas.
LibreOffice's preview does not preserve all Word math formatting (notably run
colors); native Word display fidelity must be checked in Word.

References: [Microsoft's OMML mapping](https://devblogs.microsoft.com/math-in-office/officemath/),
[border-box properties](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.math.borderboxproperties),
[argument sizes](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.math.argumentsize),
[matrix column alignment](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.math.matrixcolumnproperties),
[CSS named colors](https://www.w3.org/TR/css-color-4/#named-colors).


## S-OMML-7 — alignment and arithmetic layout regressions

Aligned equations without intertext use native matrices with right/left column
pairs and zero column gap; this guarantees a shared boundary at the equals sign.
Multiple pairs have an explicit spacer column between pairs. Equation arrays
with intertext attach alignment to nonempty math boxes instead of empty runs.
Literal ampersands are not emitted as a layout workaround, since renderers can
display them as visible characters.

Addition carries use script-sized visible digits over full-size zero-width
anchors and normal-width hidden digit placeholders. Blank cells use hidden
digits, not variable-width spaces; carry placeholders reserve width without
height. Thus carry columns match the addends without forcing full-size carries.

Long division writes the next brought-down digit as part of each intermediate
number. For `247 / 5`, the visible subtraction rows are `−20`, `47`, `−45`, `2`;
the `47` ends one digit column to the right of the first subtraction. The same
rule handles zero quotient digits and divisors larger than the dividend.
