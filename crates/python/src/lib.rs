use std::collections::BTreeMap;

use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;

#[allow(clippy::too_many_arguments)]
fn convert(
    tex: &str,
    locale: &str,
    display: bool,
    strict: bool,
    input: &str,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<usize>,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i64>>,
    labels: Option<BTreeMap<String, String>>,
    citations: Option<BTreeMap<String, String>>,
) -> PyResult<mathra::Output> {
    let locale = locale.parse().map_err(PyValueError::new_err)?;
    let input = input.parse().map_err(PyValueError::new_err)?;
    let braille = braille.map(str::parse).transpose().map_err(PyValueError::new_err)?;
    let font = match font {
        None => mathra::font::MathFont::default(),
        Some(id) => *mathra::font::MathFont::loaded().get(id).ok_or_else(|| PyValueError::new_err(format!("no font loaded with id {id}")))?,
    };
    let fallback_fonts = fallbacks(&fallback_fonts.unwrap_or_default())?;
    let labels = labels.unwrap_or_default();
    let citations = citations.unwrap_or_default();
    mathra::convert(tex, &mathra::Options { locale, display, strict, input, braille, animate, steps, font, max_width, fallback_fonts, labels, citations, ..Default::default() })
        .map_err(|e| PyValueError::new_err(e.to_string()))
}

/// The fallback fonts by id, in order, then Noto Emoji: an id `n >= 0` is what `load_fallback_font`
/// gave, and `-(n + 1)` the math font `load_font` gave as `n`.
fn fallbacks(ids: &[i64]) -> PyResult<Vec<mathra::font::FallbackFont>> {
    let loaded = mathra::font::FallbackFont::loaded();
    let math = mathra::font::MathFont::loaded();
    let mut list = Vec::with_capacity(ids.len() + 1);
    for &id in ids {
        let font = if id >= 0 { loaded.get(id as usize).copied() } else { math.get((-(id + 1)) as usize).map(|f| (*f).into()) };
        list.push(font.ok_or_else(|| PyValueError::new_err(format!("no fallback font loaded with id {id}")))?);
    }
    list.extend(mathra::font::FallbackFont::defaults());
    Ok(list)
}

/// Loads a fallback font (any OpenType or TrueType font with outlines) from its bytes: its id, to
/// pass in `fallback_fonts`, and its name.
#[pyfunction]
fn load_fallback_font(data: Vec<u8>) -> PyResult<(usize, String)> {
    let font = mathra::font::FallbackFont::load(data).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let id = mathra::font::FallbackFont::loaded().iter().position(|f| *f == font).expect("a loaded font is listed");
    Ok((id, font.name().to_string()))
}

/// Loads an OpenType math font from its bytes: its id, to pass as `font`, and its name.
#[pyfunction]
fn load_font(data: Vec<u8>) -> PyResult<(usize, String)> {
    let font = mathra::font::MathFont::load(data).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let id = mathra::font::MathFont::loaded().iter().position(|f| *f == font).expect("a loaded font is listed");
    Ok((id, font.name().to_string()))
}

/// Converts an equation (LaTeX, MathML or AsciiMath, by `input`) to SVG.
#[pyfunction]
#[pyo3(signature = (tex, locale = "en", *, display = true, strict = false, input = "latex", braille = None, animate = false, steps = false, font = None, max_width = None, fallback_fonts = None, labels = None, citations = None))]
#[allow(clippy::too_many_arguments)]
fn tex_to_svg(
    tex: &str,
    locale: &str,
    display: bool,
    strict: bool,
    input: &str,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<usize>,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i64>>,
    labels: Option<BTreeMap<String, String>>,
    citations: Option<BTreeMap<String, String>>,
) -> PyResult<String> {
    convert(tex, locale, display, strict, input, braille, animate, steps, font, max_width, fallback_fonts, labels, citations).map(|r| r.svg)
}

/// The equation as PNG bytes: `dpi` over a 12pt body (an em is dpi × 12 / 72 pixels), `background`
/// and `color` as CSS colors (transparent and `#111` by default).
#[pyfunction]
#[pyo3(signature = (tex, locale = "en", *, display = true, strict = false, input = "latex", braille = None, font = None, dpi = 300.0, background = None, color = "#111", max_width = None, fallback_fonts = None, labels = None, citations = None))]
#[allow(clippy::too_many_arguments)]
fn tex_to_png(
    py: Python<'_>,
    tex: &str,
    locale: &str,
    display: bool,
    strict: bool,
    input: &str,
    braille: Option<&str>,
    font: Option<usize>,
    dpi: f32,
    background: Option<String>,
    color: &str,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i64>>,
    labels: Option<BTreeMap<String, String>>,
    citations: Option<BTreeMap<String, String>>,
) -> PyResult<Py<pyo3::types::PyBytes>> {
    let options = mathra::PngOptions { dpi, background, color: color.to_string() };
    options.check().map_err(|e| PyValueError::new_err(e.to_string()))?;
    let png = convert(tex, locale, display, strict, input, braille, false, false, font, max_width, fallback_fonts, labels, citations)?
        .png(&options)
        .map_err(|e| PyValueError::new_err(e.to_string()))?;
    Ok(pyo3::types::PyBytes::new(py, &png).unbind())
}

/// Tree of meaning as JSON.
#[pyfunction]
#[pyo3(signature = (tex, locale = "en", *, display = true, strict = false, input = "latex", braille = None, animate = false, steps = false, font = None, max_width = None, fallback_fonts = None, labels = None, citations = None))]
#[allow(clippy::too_many_arguments)]
fn tex_to_tree(
    tex: &str,
    locale: &str,
    display: bool,
    strict: bool,
    input: &str,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<usize>,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i64>>,
    labels: Option<BTreeMap<String, String>>,
    citations: Option<BTreeMap<String, String>>,
) -> PyResult<String> {
    convert(tex, locale, display, strict, input, braille, animate, steps, font, max_width, fallback_fonts, labels, citations).map(|r| r.tree.to_json())
}

/// Every output as JSON; `mathra.render` turns it into a dict.
#[pyfunction]
#[pyo3(signature = (tex, locale = "en", *, display = true, strict = false, input = "latex", braille = None, animate = false, steps = false, font = None, max_width = None, fallback_fonts = None, labels = None, citations = None))]
#[allow(clippy::too_many_arguments)]
fn render(
    tex: &str,
    locale: &str,
    display: bool,
    strict: bool,
    input: &str,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<usize>,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i64>>,
    labels: Option<BTreeMap<String, String>>,
    citations: Option<BTreeMap<String, String>>,
) -> PyResult<String> {
    convert(tex, locale, display, strict, input, braille, animate, steps, font, max_width, fallback_fonts, labels, citations).map(|r| r.to_json())
}

/// The supported languages as (code, name) pairs, English first.
#[pyfunction]
fn locales() -> Vec<(&'static str, &'static str)> {
    mathra::Locale::ALL.iter().map(|l| (l.code(), l.name())).collect()
}

#[pymodule]
#[pyo3(name = "_mathra")]
fn mathra_module(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(tex_to_svg, m)?)?;
    m.add_function(wrap_pyfunction!(tex_to_png, m)?)?;
    m.add_function(wrap_pyfunction!(tex_to_tree, m)?)?;
    m.add_function(wrap_pyfunction!(render, m)?)?;
    m.add_function(wrap_pyfunction!(locales, m)?)?;
    m.add_function(wrap_pyfunction!(load_font, m)?)?;
    m.add_function(wrap_pyfunction!(load_fallback_font, m)?)?;
    // the Python package has its own version (crates/python/Cargo.toml); the core's is `core_version`
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;
    m.add("core_version", mathra::VERSION)?;
    Ok(())
}
