//! README banner, drawn by mathra itself: every letter, the tagline and the equations come
//! from the embedded font, with no text or external font. The same version always writes the same bytes.
//!
//! `cargo run -p mathra --example banner` writes `docs/banner.svg`;
//! `tests/banner.rs` checks that the file in the repository is up to date.

use mathra::{convert, font, Options};

const WIDTH: f32 = 1280.0;
const HEIGHT: f32 = 320.0;

const BOARD: &str = "#21403A";
const CHALK: &str = "#F2EFE4";
const DIM: &str = "#BFD0C8";
const YELLOW: &str = "#F4E59A";
const PINK: &str = "#F4B6BE";
const WOOD: &str = "#8A5B33";

/// mathra's SVG for `tex`, placed with its baseline at `(x, base)` and 1 em = `em` px.
/// Returns the element and the width it takes, in px.
fn equation(tex: &str, x: f32, base: f32, em: f32, color: &str) -> (String, f32) {
    let svg = convert(tex, &Options::default()).expect("the banner equations are valid").svg;
    // viewBox="left -top width top+bottom", in font units (1000 per em); left is below 0 when ink
    // passes the start of the box, which stays at x
    let vb: Vec<f32> = svg.split("viewBox=\"").nth(1).unwrap().split('"').next().unwrap().split(' ').map(|n| n.parse().unwrap()).collect();
    let per_unit = em / font::font().units_per_em();
    let (width, height) = (vb[2] * per_unit, vb[3] * per_unit);
    let top = base + vb[1] * per_unit;
    let placed = svg.replacen("<svg ", &format!(r#"<svg x="{}" y="{}" "#, num(x + vb[0] * per_unit), num(top)), 1);
    let placed = placed.replacen(r#"width=""#, r#"data-w=""#, 1).replacen(r#"height=""#, r#"data-h=""#, 1);
    let placed = placed.replacen("<svg ", &format!(r#"<svg width="{}" height="{}" "#, num(width), num(height)), 1);
    (format!(r#"<g color="{color}">{placed}</g>"#), width)
}

fn num(v: f32) -> String {
    let r = (v * 100.0).round() / 100.0;
    if r.fract() == 0.0 {
        format!("{}", r as i64)
    } else {
        format!("{r}")
    }
}

pub fn generate() -> String {
    let mut body = String::new();

    body.push_str(&equation(r"\mathit{mathra}", 84.0, 176.0, 124.0, CHALK).0);
    body.push_str(&equation(r"\text{LaTeX to accessible SVG, no TeX install}", 88.0, 246.0, 26.0, DIM).0);

    // on the right, what it draws: a derivation, written down the board
    let right = 700.0;
    body.push_str(&equation(r"ax^2 + bx + c = 0", right, 62.0, 27.0, CHALK).0);
    body.push_str(&equation(r"x^2 + \frac{b}{a}x = -\frac{c}{a}", right, 126.0, 27.0, CHALK).0);
    body.push_str(&equation(r"\left(x + \frac{b}{2a}\right)^2 = \frac{b^2 - 4ac}{4a^2}", right, 196.0, 27.0, YELLOW).0);
    body.push_str(&equation(r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}", right, 268.0, 27.0, PINK).0);

    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="mathra: LaTeX to accessible SVG, no TeX install"><rect width="{w}" height="{h}" fill="{BOARD}"/>{body}<rect y="304" width="{w}" height="16" fill="{WOOD}"/><rect x="1120" y="294" width="46" height="10" rx="3" fill="{CHALK}"/><rect x="1176" y="294" width="30" height="10" rx="3" fill="{PINK}"/></svg>
"#,
        w = num(WIDTH),
        h = num(HEIGHT),
    )
}

#[allow(dead_code)]
fn main() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../docs/banner.svg");
    std::fs::write(path, generate()).expect("writes docs/banner.svg");
    println!("docs/banner.svg");
}
