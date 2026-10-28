# Office Math output

## S-OMML-1 — standalone native formula fragments

`mathra::tex_to_omml(source) -> Result<String, OmmlError>` reads LaTeX strictly
and writes a single self-contained `<m:oMath xmlns:m="…">…</m:oMath>` element.
There is no XML declaration, `m:oMathPara`, Word paragraph, document, SVG or
image in the result. Insert it directly into a Word `w:p`; for a display
paragraph, wrap it in `m:oMathPara`. All text and attribute values are XML
escaped; invalid XML 1.0 control characters are replaced by U+FFFD.

The writer uses the semantic tree directly, without font lookup or SVG layout.
`output::omml::generate(&Node)` also accepts an existing tree. Bare fragments
use display-style placement of sum/product limits; integrals default to side
limits. Explicit `\limits`/`\nolimits` and style nodes control placement.

Supported structures: numbers, identifiers and math alphabets, functions,
operators, rows, fractions (including ruleless binomials), radicals, sub/super
scripts, n-ary operators, paired and invisible delimiters, matrices and cases,
text with embedded math, nonnegative spaces, upper accents, bars, over/under
labels and arrows, rectangular boxes, braces/brackets, phantoms and mathchoice.
A n-ary operator takes the following non-relation/non-binary/non-punctuation
atom as its operand. Group a longer operand in braces to place it all inside
the native n-ary object.

This is a structural converter, not a TeX layout engine. Fixed delimiter sizes,
fraction style/thickness and table stretch are left to Word. Tables currently
use Word's default cell alignment and spacing; aligned environments are
represented as matrices. Heterogeneous middle delimiters are ordinary operator
runs inside a native delimiter object. Negative spacing, lower accents,
colors, cancellation, custom frames, units, geometric transforms, table rules,
intertext, spanning cells, proof trees, diagrams, structural chemistry and
school arithmetic are unsupported and return `OmmlError::Unsupported` rather
than flattening their content. Malformed/unknown LaTeX returns
`OmmlError::Parse`. No tolerant conversion API is provided.

The example owns DOCX packaging (ZIP is a development dependency only):

```sh
cargo run -p mathra --example omml_docx -- target/equations.docx
```

It creates a minimal OPC package with content types, the root document
relationship and `word/document.xml`, containing editable equations.

Reference: [Microsoft's OMML object mapping](https://devblogs.microsoft.com/math-in-office/officemath/).
