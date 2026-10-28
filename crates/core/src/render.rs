//! SVG for desktop images and document exporters, in explicit logical units.
use crate::font::MathFont;
use crate::output::svg::NativeOptions;
use crate::{Applied, Error, Options};

/// Native image settings. `font_size` is logical units per em, not a DPI-dependent point size.
#[derive(Debug, Clone, Copy)]
pub struct SvgRenderOptions {
    pub font_size: f32,
    /// Foreground ink, `0xRRGGBB`. Explicit LaTeX colors override it.
    pub color: u32,
    pub font: MathFont,
}

impl Default for SvgRenderOptions {
    fn default() -> Self {
        Self { font_size: 16.0, color: 0x111111, font: MathFont::default() }
    }
}

/// A self-contained path drawing, measured from its full ink bounds.
#[derive(Debug, Clone)]
pub struct RenderedSvg {
    pub svg: String,
    pub width: f32,
    pub height: f32,
    /// Distance from the image's top to the math baseline, in the same units as height.
    pub ascent: f32,
    pub warnings: Vec<Applied>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RenderError {
    Formula(Error),
    InvalidFontSize,
    InvalidDimensions,
}

impl std::fmt::Display for RenderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Formula(error) => error.fmt(f),
            Self::InvalidFontSize => f.write_str("font size must be finite and positive"),
            Self::InvalidDimensions => f.write_str("rendered SVG dimensions must be finite and positive"),
        }
    }
}

impl std::error::Error for RenderError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Formula(error) => Some(error),
            _ => None,
        }
    }
}

/// Render a standalone SVG with explicit size, foreground color and baseline metrics.
///
/// Unlike [`crate::convert`], dimensions have no `em`/`pt` suffix, the SVG needs no theme
/// inheritance, and there is no transparent `<text>` layer or system-font dependency.
/// Source, tree, speech and braille metadata are retained. The caller chooses strictness
/// with `options.strict`, and can apply its own image-size limits before rasterization.
/// Empty/zero-area drawings and invalid sizes return an error.
///
/// ```
/// let options = mathra::Options { strict: true, display: false, ..Default::default() };
/// let image = mathra::render_svg(r"\frac{a}{b}", &options, &mathra::SvgRenderOptions {
///     font_size: 20.0,
///     color: 0xddeeff,
///     ..Default::default()
/// })?;
/// assert!(image.width > 0.0 && image.ascent <= image.height);
/// assert!(!image.svg.contains("<text"));
/// # Ok::<(), mathra::RenderError>(())
/// ```
pub fn render_svg(tex: &str, options: &Options, render: &SvgRenderOptions) -> Result<RenderedSvg, RenderError> {
    if !render.font_size.is_finite() || render.font_size <= 0.0 {
        return Err(RenderError::InvalidFontSize);
    }
    let native = NativeOptions { font_size: render.font_size, color: render.color };
    let (output, metrics) = crate::convert_internal(tex, options, render.font, Some(native)).map_err(RenderError::Formula)?;
    // The formatter rounds SVG dimensions to .001; refuse values which would round to zero.
    if !metrics.width.is_finite()
        || !metrics.height.is_finite()
        || !metrics.ascent.is_finite()
        || metrics.width < 0.0005
        || metrics.height < 0.0005
        || metrics.ascent < 0.0
        || metrics.ascent > metrics.height
    {
        return Err(RenderError::InvalidDimensions);
    }
    Ok(RenderedSvg { svg: output.svg, width: metrics.width, height: metrics.height, ascent: metrics.ascent, warnings: output.warnings })
}
