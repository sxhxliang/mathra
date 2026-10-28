# Native image output

Desktop editors and document exporters can call `render_svg` instead of rewriting the SVG produced by `convert`.

```rust
use mathra::{render_svg, Options, SvgRenderOptions};

let options = Options { strict: true, display: false, ..Default::default() };
let image = render_svg(r"\frac{a}{b}", &options, &SvgRenderOptions {
    font_size: 20.0,
    color: 0xddeeff,
    ..Default::default()
})?;
// image.svg, image.width, image.height, image.ascent, image.warnings
# Ok::<(), mathra::RenderError>(())
```

## Contract

- `font_size` is logical units per em; 16 means a 16-unit em. It is independent of monitor DPI. The SVG root's `width` and `height` are numbers without `em` or `pt`, avoiding implicit em sizes or the SVG pt-to-px conversion.
- `width`, `height` and `ascent` use those same logical units. Ascent is the distance from the image's top to the formula baseline. Descent is `height - ascent`. Place an inline image at `text_baseline - ascent`; scale all metrics together when fitting an image.
- Bounds include the layout box, all overhanging ink and the baseline. A raised box entirely above or below the baseline includes transparent space up to the baseline, keeping ascent within `[0, height]`. The SVG's numeric attributes round to .001 units, matching the existing SVG formatter; metrics retain f32 precision.
- `color` is `0xRRGGBB`; its low 24 bits set the SVG root's `color` attribute. The existing `currentColor` glyphs and strokes inherit it. There is no `svg:root` stylesheet that could override the caller's theme. Explicit LaTeX colors still override this foreground.
- `font` defaults to STIX Two Math. Enable `latin-modern` and select `MathFont::LatinModern` to use the same font as tikra. Fonts have different metrics; this does not reproduce KaTeX-font geometry.
- Visible glyphs use embedded outline paths. There is no `<text>` layer and no system-font registration is needed. Speech, source, semantic tree and braille metadata remain in the SVG.
- Input format, display/inline style, locale, strictness, animation and steps retain the meaning of the existing `Options`. For an editor that must preserve invalid formulas as source, set `strict: true`. A tolerant result retains `warnings` and their metadata.
- Invalid font sizes (zero, negative or non-finite), empty/zero-area images, non-finite metrics and dimensions that would round to zero return `RenderError`. Formula errors are wrapped in `RenderError::Formula`, retaining the original error as `source()`.

The caller still owns source length, image-size limits, rasterization scale, image caching, and document pagination. This API does not choose an editor's 4096 × 1024 limit or turn unsupported LaTeX into a successful render.

## Compatibility verification

`tests/fixtures/genius-math.json` freezes 48 unique formulas from Genius's `docs/math.md`, `docs/chemistry.md` and `src/editor/fixtures/scientific-math.md`. Paths are provenance, not runtime dependencies. There are 47 valid examples and one intentionally unknown command that must fail. `tests/native_svg.rs` renders them in both styles and every enabled font, and separately checks scaling, colors, full ink bounds, invalid inputs and unchanged web geometry.

This verifies conversion and geometry invariants. It does not claim visual identity with RaTeX, or validate the host editor's HTML/PDF/DOCX integration. Proof layout support and remaining bussproofs exclusions are listed in [proof trees](proofs.md).

`cargo run -p mathra --example native_svg -- target/native-preview` writes light/dark proof SVGs and prints their metrics.
