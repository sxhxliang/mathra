//! PNG output (the `png` feature): the SVG rasterized with resvg.
//!
//! The glyphs are outlines (`<path>` drawn with `<use>`), so no font is loaded: the text layer
//! (S-SVG-6) is left out, since resvg is built without text support. `currentColor` is the ink of
//! [`PngOptions::color`], and the CSS of the SVG (the standalone color and the animation) is dropped,
//! so the PNG is the finished drawing.
//!
//! Size: the equation is set over a 12pt body, so an em is 12pt and `dpi × 12 / 72` pixels (50 at
//! 300 dpi). Each side is the SVG's size in em times that, rounded up to a whole pixel (at least
//! one), so no ink is cut; the drawing keeps the exact scale and the extra fraction of a pixel stays
//! empty on the right and at the bottom.

use std::fmt;
use std::str::FromStr;

use resvg::{tiny_skia, usvg};

/// How the SVG becomes pixels.
#[derive(Debug, Clone, PartialEq)]
pub struct PngOptions {
    /// Dots per inch over a 12pt body (1em = 12pt): an em is `dpi × 12 / 72` pixels. 300 by default.
    pub dpi: f32,
    /// The background, a CSS color (`white`, `#fff`, `rgb(255,255,255)`); `None`, transparent.
    pub background: Option<String>,
    /// The ink, a CSS color: what `currentColor` is in the SVG. `#111` by default, the color of a
    /// standalone SVG (S-SVG-4). Colors set in the equation (`\color`) keep their own.
    pub color: String,
}

impl Default for PngOptions {
    fn default() -> Self {
        PngOptions { dpi: 300.0, background: None, color: "#111".into() }
    }
}

impl PngOptions {
    /// The pixels of one em: `dpi × 12 / 72`.
    pub fn pixels_per_em(&self) -> f32 {
        self.dpi * 12.0 / 72.0
    }

    /// The dpi is a positive number and both colors are CSS colors: what [`from_svg`] checks first,
    /// for a caller that wants to know before converting anything.
    pub fn check(&self) -> Result<(), PngError> {
        self.parsed().map(|_| ())
    }

    /// The ink and the background, parsed.
    fn parsed(&self) -> Result<(svgtypes::Color, Option<svgtypes::Color>), PngError> {
        if !(self.dpi.is_finite() && self.dpi > 0.0) {
            return Err(PngError::Dpi(self.dpi));
        }
        Ok((color(&self.color)?, self.background.as_deref().map(color).transpose()?))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum PngError {
    /// Not a CSS color.
    Color(String),
    /// The dpi is not a positive number.
    Dpi(f32),
    /// Too large an image to draw, in pixels: more than [`MAX_SIDE`] on a side or [`MAX_PIXELS`] in all.
    Size { width: u32, height: u32 },
    /// Not an SVG written by mathra.
    Svg(String),
}

impl fmt::Display for PngError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PngError::Color(c) => write!(f, "not a color: {c}"),
            PngError::Dpi(d) => write!(f, "the dpi must be a positive number, not {d}"),
            PngError::Size { width, height } => write!(f, "the image would be too large: {width}×{height} pixels"),
            PngError::Svg(e) => write!(f, "cannot read the SVG: {e}"),
        }
    }
}

impl std::error::Error for PngError {}

/// The longest side of a PNG, in pixels.
pub const MAX_SIDE: u32 = 32_768;
/// The most pixels of a PNG: 256 MB of RGBA to draw it.
pub const MAX_PIXELS: u64 = 1 << 26;

/// The size of one side in pixels: `em × pixels_per_em`, rounded up, at least 1. A thousandth of a
/// pixel of float error does not round up a whole pixel.
pub fn pixels(em: f32, pixels_per_em: f32) -> u32 {
    ((em * pixels_per_em - 1e-3).ceil().max(1.0)) as u32
}

fn color(css: &str) -> Result<svgtypes::Color, PngError> {
    svgtypes::Color::from_str(css.trim()).map_err(|_| PngError::Color(css.to_string()))
}

/// The `width` or `height` of the root `<svg>`, in em (what S-SVG-1 writes).
fn root_em(svg: &str, name: &str) -> Result<f32, PngError> {
    let root = svg.find("<svg").and_then(|start| svg[start..].find('>').map(|end| &svg[start..start + end])).ok_or_else(|| PngError::Svg("no <svg> element".into()))?;
    let key = format!(" {name}=\"");
    let value =
        root.find(&key).map(|i| &root[i + key.len()..]).and_then(|rest| rest.split_once('"')).map(|(v, _)| v).ok_or_else(|| PngError::Svg(format!("no {name} on <svg>")))?;
    value.strip_suffix("em").and_then(|v| v.parse::<f32>().ok()).filter(|v| v.is_finite() && *v >= 0.0).ok_or_else(|| PngError::Svg(format!("{name}=\"{value}\" is not in em")))
}

/// The SVG to draw: without its `<style>` (the standalone color and the animation's CSS) and with
/// the ink as the root's `color`, which `currentColor` takes.
fn prepared(svg: &str, ink: svgtypes::Color) -> String {
    let mut s = String::with_capacity(svg.len() + 40);
    let mut rest = svg;
    while let Some(start) = rest.find("<style>") {
        s.push_str(&rest[..start]);
        rest = match rest[start..].find("</style>") {
            Some(end) => &rest[start + end + "</style>".len()..],
            None => "",
        };
    }
    s.push_str(rest);
    let ink = format!(r#"<svg color="rgba({},{},{},{})""#, ink.red, ink.green, ink.blue, f32::from(ink.alpha) / 255.0);
    s.replacen("<svg", &ink, 1)
}

/// An SVG written by mathra ([`crate::Output::svg`]) as a PNG.
pub fn from_svg(svg: &str, options: &PngOptions) -> Result<Vec<u8>, PngError> {
    let (ink, background) = options.parsed()?;
    let per_em = options.pixels_per_em();
    let (width_em, height_em) = (root_em(svg, "width")?, root_em(svg, "height")?);
    let (width, height) = (pixels(width_em, per_em), pixels(height_em, per_em));
    if width > MAX_SIDE || height > MAX_SIDE || u64::from(width) * u64::from(height) > MAX_PIXELS {
        return Err(PngError::Size { width, height });
    }
    let mut pixmap = tiny_skia::Pixmap::new(width, height).ok_or(PngError::Size { width, height })?;
    if let Some(c) = background {
        pixmap.fill(tiny_skia::Color::from_rgba8(c.red, c.green, c.blue, c.alpha));
    }
    // an empty equation (0em × 0em) is one blank pixel; usvg refuses an SVG of no size
    if width_em > 0.0 && height_em > 0.0 {
        // usvg reads `em` with this font size, so the tree is `em × 12` units on each side
        const FONT_SIZE: f32 = 12.0;
        let usvg_options = usvg::Options { font_size: FONT_SIZE, ..Default::default() };
        let tree = usvg::Tree::from_str(&prepared(svg, ink), &usvg_options).map_err(|e| PngError::Svg(e.to_string()))?;
        let scale = per_em / FONT_SIZE;
        resvg::render(&tree, tiny_skia::Transform::from_scale(scale, scale), &mut pixmap.as_mut());
    }
    // the png encoder fails only on a zero side or pixels that do not fill the image; a pixmap has
    // neither, and it writes into memory
    Ok(pixmap.encode_png().expect("a pixmap encodes as a PNG"))
}
