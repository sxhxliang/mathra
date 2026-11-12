use wasm_bindgen::prelude::*;

/// What JavaScript gets, without JavaScript types: testable outside the browser.
pub fn convert(tex: &str, locale: Option<&str>) -> Result<mathra::Output, String> {
    convert_with(tex, locale, true, false, None, None, false, false)
}

/// `input`: "latex" (default), "mathml" or "asciimath"; `braille`: "cmu" or "nemeth" (default: the locale's);
/// `animate`: the SVG writes itself; `steps`: each element numbered by its step (S-SVG-10).
#[allow(clippy::too_many_arguments)]
pub fn convert_with(
    tex: &str,
    locale: Option<&str>,
    display: bool,
    strict: bool,
    input: Option<&str>,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
) -> Result<mathra::Output, String> {
    convert_in(tex, locale, display, strict, input, braille, animate, steps, None, None)
}

/// `convert_with`, set in a font loaded with `load_font` (its id), or in STIX Two Math, with lines
/// broken at `max_width` em, if given (L-BRK-1).
#[allow(clippy::too_many_arguments)]
pub fn convert_in(
    tex: &str,
    locale: Option<&str>,
    display: bool,
    strict: bool,
    input: Option<&str>,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<u32>,
    max_width: Option<f32>,
) -> Result<mathra::Output, String> {
    convert_full(tex, locale, display, strict, input, braille, animate, steps, font, max_width, &[], None, None)
}

/// `convert_in` (in one line), for an equation of a document: `labels` and `citations` are JSON objects
/// from a key to its number (a string or a number), as `{"eq:a": 3}`, for `\ref`, `\eqref` and `\cite`.
#[allow(clippy::too_many_arguments)]
pub fn convert_document(
    tex: &str,
    locale: Option<&str>,
    display: bool,
    strict: bool,
    input: Option<&str>,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<u32>,
    labels: Option<&str>,
    citations: Option<&str>,
) -> Result<mathra::Output, String> {
    convert_full(tex, locale, display, strict, input, braille, animate, steps, font, None, &[], labels, citations)
}

/// `convert_in`, with fallback fonts for the characters the math font lacks, tried in order (see
/// `fallbacks_by_ids`), and the numbers of the document's labels and citations (see
/// `convert_document`).
#[allow(clippy::too_many_arguments)]
pub fn convert_full(
    tex: &str,
    locale: Option<&str>,
    display: bool,
    strict: bool,
    input: Option<&str>,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<u32>,
    max_width: Option<f32>,
    fallbacks: &[i32],
    labels: Option<&str>,
    citations: Option<&str>,
) -> Result<mathra::Output, String> {
    let locale = locale.map_or(Ok(mathra::Locale::default()), str::parse)?;
    let input = input.map_or(Ok(mathra::Input::default()), str::parse)?;
    let braille = braille.map(str::parse).transpose()?;
    let font = font_by_id(font)?;
    let fallback_fonts = fallbacks_by_ids(fallbacks)?;
    let labels = numbers(labels, "labels")?;
    let citations = numbers(citations, "citations")?;
    mathra::convert(tex, &mathra::Options { locale, display, strict, input, braille, animate, steps, font, max_width, fallback_fonts, labels, citations, ..Default::default() })
        .map_err(|e| e.to_string())
}

/// A JSON object from keys to numbers (strings or numbers) as `mathra::Labels`; none, empty.
pub fn numbers(json: Option<&str>, what: &str) -> Result<mathra::Labels, String> {
    let Some(json) = json else { return Ok(mathra::Labels::new()) };
    let value: serde_json::Value = serde_json::from_str(json).map_err(|e| format!("{what}: {e}"))?;
    let serde_json::Value::Object(map) = value else { return Err(format!("{what}: an object from keys to numbers, as {{\"eq:a\": 3}}")) };
    map.into_iter()
        .map(|(key, n)| match n {
            serde_json::Value::String(s) => Ok((key, s)),
            serde_json::Value::Number(n) => Ok((key, n.to_string())),
            other => Err(format!("{what}: {key} is {other}, not a string or a number")),
        })
        .collect()
}

/// The fallback fonts by id, in order, then the build's own (none in the npm package, which leaves
/// out the `emoji` feature): an id `n >= 0` is what `load_fallback_font` gave, and `-(n + 1)` the font
/// `load_font` gave as `n` (a math font can stand in for another).
pub fn fallbacks_by_ids(ids: &[i32]) -> Result<Vec<mathra::font::FallbackFont>, String> {
    let fallbacks = mathra::font::FallbackFont::loaded();
    let mut list = Vec::with_capacity(ids.len() + 1);
    for &id in ids {
        list.push(if id >= 0 { *fallbacks.get(id as usize).ok_or_else(|| format!("no fallback font loaded with id {id}"))? } else { font_by_id(Some((-(id + 1)) as u32))?.into() });
    }
    list.extend(mathra::font::FallbackFont::defaults());
    Ok(list)
}

/// Loads a fallback font (any `.otf`/`.ttf` with outlines) from its bytes: its id, to pass in
/// `fallback_fonts`, and its name. The same bytes again give the same id.
pub fn load_fallback_font_bytes(bytes: Vec<u8>) -> Result<(u32, String), String> {
    let font = mathra::font::FallbackFont::load(bytes).map_err(|e| e.to_string())?;
    let id = mathra::font::FallbackFont::loaded().iter().position(|f| *f == font).expect("a loaded font is listed");
    Ok((id as u32, font.name().to_string()))
}

/// Loads a fallback font for the characters the math font lacks (emoji, CJK): any OpenType or
/// TrueType font with outlines. Returns `{"id": …, "name": …, "fallback": true}` as JSON.
#[wasm_bindgen(js_name = loadFallbackFont)]
pub fn load_fallback_font(bytes: Vec<u8>) -> Result<String, JsError> {
    load_fallback_font_bytes(bytes).map(|(id, name)| serde_json::json!({ "id": id, "name": name, "fallback": true }).to_string()).map_err(|e| JsError::new(&e))
}

/// A font loaded with `load_font`, by the id it gave; none, STIX Two Math.
pub fn font_by_id(id: Option<u32>) -> Result<mathra::font::MathFont, String> {
    match id {
        None => Ok(mathra::font::MathFont::default()),
        Some(id) => mathra::font::MathFont::loaded().get(id as usize).copied().ok_or_else(|| format!("no font loaded with id {id}")),
    }
}

/// Loads an OpenType math font from its bytes: its id, to pass as `font`, and its name. The same
/// bytes again give the same id.
pub fn load_font_bytes(bytes: Vec<u8>) -> Result<(u32, String), String> {
    let font = mathra::font::MathFont::load(bytes).map_err(|e| e.to_string())?;
    let id = mathra::font::MathFont::loaded().iter().position(|f| *f == font).expect("a loaded font is listed");
    Ok((id as u32, font.name().to_string()))
}

/// Loads an OpenType math font (`.otf`/`.ttf` with a MATH table) from its bytes. Returns
/// `{"id": …, "name": …}` as JSON; pass the id as `font`.
#[wasm_bindgen(js_name = loadFont)]
pub fn load_font(bytes: Vec<u8>) -> Result<String, JsError> {
    load_font_bytes(bytes).map(|(id, name)| serde_json::json!({ "id": id, "name": name }).to_string()).map_err(|e| JsError::new(&e))
}

/// Everything at once, as JSON: `svg`, `speech`, `text`, `braille`, `braille_code`, `mathml`, `tree`, `applied` and `warnings`.
#[allow(clippy::too_many_arguments)]
pub fn render_json(tex: &str, locale: Option<&str>, display: bool, strict: bool, input: Option<&str>, braille: Option<&str>, animate: bool, steps: bool) -> Result<String, String> {
    convert_with(tex, locale, display, strict, input, braille, animate, steps).map(|r| r.to_json())
}

/// `render_json`, set in a loaded font (its id), with lines broken at `max_width` em, if given.
#[allow(clippy::too_many_arguments)]
pub fn render_json_in(
    tex: &str,
    locale: Option<&str>,
    display: bool,
    strict: bool,
    input: Option<&str>,
    braille: Option<&str>,
    animate: bool,
    steps: bool,
    font: Option<u32>,
    max_width: Option<f32>,
) -> Result<String, String> {
    convert_in(tex, locale, display, strict, input, braille, animate, steps, font, max_width).map(|r| r.to_json())
}

/// Converts an equation to SVG. `locale`: a language code such as "en" (default), "pt-BR", "es" or "ja";
/// `display` defaults to true, `strict` to false; `input` is "latex" (default), "mathml" or "asciimath";
/// `animate` and `steps` default to false; `font` is the id `loadFont` gave (none: STIX Two Math);
/// `max_width`, in em, breaks lines wider than that (none: one line); `fallback_fonts` the fonts for
/// characters the math font lacks (see `fallbacks_by_ids`); `labels` and `citations` JSON objects from
/// keys to numbers (see `convert_document`).
#[wasm_bindgen(js_name = texToSvg)]
#[allow(clippy::too_many_arguments)]
pub fn tex_to_svg(
    tex: &str,
    locale: Option<String>,
    display: Option<bool>,
    strict: Option<bool>,
    input: Option<String>,
    braille: Option<String>,
    animate: Option<bool>,
    steps: Option<bool>,
    font: Option<u32>,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i32>>,
    labels: Option<String>,
    citations: Option<String>,
) -> Result<String, JsError> {
    convert_full(
        tex,
        locale.as_deref(),
        display.unwrap_or(true),
        strict.unwrap_or(false),
        input.as_deref(),
        braille.as_deref(),
        animate.unwrap_or(false),
        steps.unwrap_or(false),
        font,
        max_width,
        fallback_fonts.as_deref().unwrap_or_default(),
        labels.as_deref(),
        citations.as_deref(),
    )
    .map(|r| r.svg)
    .map_err(|e| JsError::new(&e))
}

/// Tree of meaning as JSON.
#[wasm_bindgen(js_name = texToTree)]
pub fn tex_to_tree(tex: &str, locale: Option<String>) -> Result<String, JsError> {
    convert(tex, locale.as_deref()).map(|r| r.tree.to_json()).map_err(|e| JsError::new(&e))
}

/// The supported languages as JSON: `[{"code":"en","name":"English"}, …]`.
pub fn locales_json() -> String {
    let list: Vec<serde_json::Value> = mathra::Locale::ALL.iter().map(|l| serde_json::json!({ "code": l.code(), "name": l.name() })).collect();
    serde_json::Value::Array(list).to_string()
}

#[wasm_bindgen]
pub fn locales() -> String {
    locales_json()
}

/// Every output in one JSON string (see `render_json`). `display` defaults to true, `strict` to false,
/// `input` to "latex", `animate` and `steps` to false; `font` is the id `loadFont` gave; `max_width`,
/// in em, breaks lines wider than that; `fallback_fonts`, `labels` and `citations` as in `texToSvg`.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn render(
    tex: &str,
    locale: Option<String>,
    display: Option<bool>,
    strict: Option<bool>,
    input: Option<String>,
    braille: Option<String>,
    animate: Option<bool>,
    steps: Option<bool>,
    font: Option<u32>,
    max_width: Option<f32>,
    fallback_fonts: Option<Vec<i32>>,
    labels: Option<String>,
    citations: Option<String>,
) -> Result<String, JsError> {
    convert_full(
        tex,
        locale.as_deref(),
        display.unwrap_or(true),
        strict.unwrap_or(false),
        input.as_deref(),
        braille.as_deref(),
        animate.unwrap_or(false),
        steps.unwrap_or(false),
        font,
        max_width,
        fallback_fonts.as_deref().unwrap_or_default(),
        labels.as_deref(),
        citations.as_deref(),
    )
    .map(|r| r.to_json())
    .map_err(|e| JsError::new(&e))
}

/// The equation written by a pen, as an SVG that plays by itself (SMIL). `seconds`: how long the
/// pen takes; none, from how much it writes.
pub fn pen_svg(tex: &str, locale: Option<&str>, display: bool, input: Option<&str>, seconds: Option<f64>, font: Option<u32>) -> Result<String, String> {
    pen_svg_with(tex, locale, display, input, seconds, font, &[])
}

/// `pen_svg`, with fallback fonts (see `fallbacks_by_ids`).
pub fn pen_svg_with(tex: &str, locale: Option<&str>, display: bool, input: Option<&str>, seconds: Option<f64>, font: Option<u32>, fallbacks: &[i32]) -> Result<String, String> {
    let locale = locale.map_or(Ok(mathra::Locale::default()), str::parse)?;
    let input = input.map_or(Ok(mathra::Input::default()), str::parse)?;
    let font = font_by_id(font)?;
    let fallback_fonts = fallbacks_by_ids(fallbacks)?;
    let pen = mathra::output::pen::Pen { seconds, ..Default::default() };
    mathra::pen(tex, &mathra::Options { locale, display, input, font, fallback_fonts, ..Default::default() }, &pen).map_err(|e| e.to_string())
}

/// The equation written by a pen (see `pen_svg`). `display` defaults to true, `input` to "latex".
#[wasm_bindgen(js_name = texToPen)]
pub fn tex_to_pen(
    tex: &str,
    locale: Option<String>,
    display: Option<bool>,
    input: Option<String>,
    seconds: Option<f64>,
    font: Option<u32>,
    fallback_fonts: Option<Vec<i32>>,
) -> Result<String, JsError> {
    pen_svg_with(tex, locale.as_deref(), display.unwrap_or(true), input.as_deref(), seconds, font, fallback_fonts.as_deref().unwrap_or_default()).map_err(|e| JsError::new(&e))
}
