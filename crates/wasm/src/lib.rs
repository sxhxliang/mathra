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
    convert_in(tex, locale, display, strict, input, braille, animate, steps, None)
}

/// `convert_with`, set in a font loaded with `load_font` (its id), or in STIX Two Math.
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
) -> Result<mathra::Output, String> {
    let locale = locale.map_or(Ok(mathra::Locale::default()), str::parse)?;
    let input = input.map_or(Ok(mathra::Input::default()), str::parse)?;
    let braille = braille.map(str::parse).transpose()?;
    let font = font_by_id(font)?;
    mathra::convert(tex, &mathra::Options { locale, display, strict, input, braille, animate, steps, font, ..Default::default() }).map_err(|e| e.to_string())
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

/// Everything at once, as JSON: `svg`, `speech`, `text`, `braille`, `braille_code`, `tree`, `applied` and `warnings`.
#[allow(clippy::too_many_arguments)]
pub fn render_json(tex: &str, locale: Option<&str>, display: bool, strict: bool, input: Option<&str>, braille: Option<&str>, animate: bool, steps: bool) -> Result<String, String> {
    convert_with(tex, locale, display, strict, input, braille, animate, steps).map(|r| r.to_json())
}

/// `render_json`, set in a loaded font (its id).
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
) -> Result<String, String> {
    convert_in(tex, locale, display, strict, input, braille, animate, steps, font).map(|r| r.to_json())
}

/// Converts an equation to SVG. `locale`: a language code such as "en" (default), "pt-BR", "es" or "ja";
/// `display` defaults to true, `strict` to false; `input` is "latex" (default), "mathml" or "asciimath";
/// `animate` and `steps` default to false; `font` is the id `loadFont` gave (none: STIX Two Math).
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
) -> Result<String, JsError> {
    convert_in(
        tex,
        locale.as_deref(),
        display.unwrap_or(true),
        strict.unwrap_or(false),
        input.as_deref(),
        braille.as_deref(),
        animate.unwrap_or(false),
        steps.unwrap_or(false),
        font,
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
/// `input` to "latex", `animate` and `steps` to false; `font` is the id `loadFont` gave.
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
) -> Result<String, JsError> {
    render_json_in(
        tex,
        locale.as_deref(),
        display.unwrap_or(true),
        strict.unwrap_or(false),
        input.as_deref(),
        braille.as_deref(),
        animate.unwrap_or(false),
        steps.unwrap_or(false),
        font,
    )
    .map_err(|e| JsError::new(&e))
}

/// The equation written by a pen, as an SVG that plays by itself (SMIL). `seconds`: how long the
/// pen takes; none, from how much it writes.
pub fn pen_svg(tex: &str, locale: Option<&str>, display: bool, input: Option<&str>, seconds: Option<f64>, font: Option<u32>) -> Result<String, String> {
    let locale = locale.map_or(Ok(mathra::Locale::default()), str::parse)?;
    let input = input.map_or(Ok(mathra::Input::default()), str::parse)?;
    let font = font_by_id(font)?;
    let pen = mathra::output::pen::Pen { seconds, ..Default::default() };
    mathra::pen(tex, &mathra::Options { locale, display, input, font, ..Default::default() }, &pen).map_err(|e| e.to_string())
}

/// The equation written by a pen (see `pen_svg`). `display` defaults to true, `input` to "latex".
#[wasm_bindgen(js_name = texToPen)]
pub fn tex_to_pen(tex: &str, locale: Option<String>, display: Option<bool>, input: Option<String>, seconds: Option<f64>, font: Option<u32>) -> Result<String, JsError> {
    pen_svg(tex, locale.as_deref(), display.unwrap_or(true), input.as_deref(), seconds, font).map_err(|e| JsError::new(&e))
}
