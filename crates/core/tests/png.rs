//! PNG output (the `png` feature): size, background, ink, and what is left out of the drawing.
#![cfg(feature = "png")]

use mathra::output::png::{from_svg, pixels};
use mathra::{convert, Options, PngError, PngOptions};
use tiny_skia::Pixmap;

fn png(tex: &str, options: &PngOptions) -> (String, Vec<u8>) {
    let r = convert(tex, &Options::default()).unwrap();
    let bytes = r.png(options).unwrap();
    (r.svg, bytes)
}

fn decode(bytes: &[u8]) -> Pixmap {
    Pixmap::decode_png(bytes).unwrap()
}

/// The `width` or `height` of the root `<svg>`, in em.
fn em(svg: &str, name: &str) -> f32 {
    let key = format!(" {name}=\"");
    let rest = &svg[svg.find(&key).unwrap() + key.len()..];
    rest[..rest.find("em\"").unwrap()].parse().unwrap()
}

/// The pixels with full alpha, as (r, g, b).
fn opaque(p: &Pixmap) -> Vec<(u8, u8, u8)> {
    p.pixels().iter().filter(|c| c.alpha() == 255).map(|c| (c.red(), c.green(), c.blue())).collect()
}

#[test]
fn a_png_of_the_svg_size_at_50_pixels_per_em() {
    let options = PngOptions::default();
    assert_eq!(options.pixels_per_em(), 50.0);
    for tex in [r"e^{i\pi} + 1 = 0", r"\frac{1}{2}", r"\begin{pmatrix} a & b \\ c & d \end{pmatrix}", "x"] {
        let (svg, bytes) = png(tex, &options);
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"), "{tex}");
        let p = decode(&bytes);
        // each side is the size in em times the pixels per em, rounded up
        assert_eq!(p.width(), (em(&svg, "width") * 50.0 - 1e-3).ceil() as u32, "{tex}");
        assert_eq!(p.height(), (em(&svg, "height") * 50.0 - 1e-3).ceil() as u32, "{tex}");
    }
}

#[test]
fn the_dpi_scales_the_image() {
    let (svg, bytes) = png(r"\frac{1}{2}", &PngOptions { dpi: 72.0, ..Default::default() });
    let p = decode(&bytes);
    // 72 dpi: an em is 12 pixels
    assert_eq!(p.width(), pixels(em(&svg, "width"), 12.0));
    let (_, big) = png(r"\frac{1}{2}", &PngOptions { dpi: 600.0, ..Default::default() });
    assert_eq!(decode(&big).width(), pixels(em(&svg, "width"), 100.0));
}

#[test]
fn pixels_round_up_and_are_at_least_one() {
    assert_eq!(pixels(1.0, 50.0), 50);
    assert_eq!(pixels(1.001, 50.0), 51);
    assert_eq!(pixels(0.0, 50.0), 1);
    // float error of a thousandth of a pixel does not add a pixel
    assert_eq!(pixels(0.1 * 3.0, 50.0), 15);
}

#[test]
fn transparent_by_default_and_in_dark_ink() {
    let (_, bytes) = png(r"\frac{1}{2}", &PngOptions::default());
    let p = decode(&bytes);
    // the numerator is centered: the corners are empty
    for (x, y) in [(0, 0), (p.width() - 1, 0), (0, p.height() - 1), (p.width() - 1, p.height() - 1)] {
        assert_eq!(p.pixel(x, y).unwrap().alpha(), 0, "({x}, {y})");
    }
    let ink = opaque(&p);
    assert!(!ink.is_empty());
    assert!(ink.iter().all(|&c| c == (0x11, 0x11, 0x11)), "currentColor is #111");
}

#[test]
fn background_and_ink_colors() {
    let options = PngOptions { background: Some("white".into()), color: "rgb(0, 0, 255)".into(), ..Default::default() };
    let (_, bytes) = png(r"\frac{1}{2}", &options);
    let p = decode(&bytes);
    let corner = p.pixel(0, 0).unwrap();
    assert_eq!((corner.red(), corner.green(), corner.blue(), corner.alpha()), (255, 255, 255, 255));
    assert!(p.pixels().iter().all(|c| c.alpha() == 255), "an opaque background fills every pixel");
    let colors = opaque(&p);
    assert!(colors.contains(&(0, 0, 255)), "the ink is blue");
    assert!(colors.iter().all(|&(r, g, _)| r == g), "only white, blue and their blends");
}

#[test]
fn colors_set_in_the_equation_keep_their_own() {
    let options = PngOptions { color: "#00ff00".into(), ..Default::default() };
    let (_, bytes) = png(r"a + \textcolor{red}{b}", &options);
    let colors = opaque(&decode(&bytes));
    assert!(colors.contains(&(255, 0, 0)), "\\textcolor is red");
    assert!(colors.contains(&(0, 255, 0)), "the rest is in the ink");
}

#[test]
fn the_text_layer_is_not_drawn() {
    // S-SVG-6 is a <text> with fill="transparent"; with an empty drawing nothing else could be visible
    let svg =
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -800 1000 1000" width="1em" height="1em"><text x="0" y="0" font-size="1000" fill="currentColor">x</text></svg>"#;
    let p = decode(&from_svg(svg, &PngOptions::default()).unwrap());
    assert!(p.pixels().iter().all(|c| c.alpha() == 0), "no font is loaded: text is never drawn");
}

#[test]
fn animation_css_is_dropped() {
    // the animated SVG dashes its lines in CSS (stroke-dasharray); the PNG is the finished drawing
    let tex = r"\frac{1}{2} \cancel{x}";
    let still = convert(tex, &Options::default()).unwrap().png(&PngOptions::default()).unwrap();
    let animated = convert(tex, &Options { animate: true, ..Default::default() }).unwrap().png(&PngOptions::default()).unwrap();
    assert_eq!(decode(&still).data(), decode(&animated).data());
}

#[test]
fn an_empty_equation_is_one_blank_pixel() {
    let (_, bytes) = png("", &PngOptions::default());
    let p = decode(&bytes);
    assert_eq!((p.width(), p.height()), (1, 1));
    assert_eq!(p.pixel(0, 0).unwrap().alpha(), 0);
}

#[test]
fn bad_options_are_refused() {
    let r = convert("x", &Options::default()).unwrap();
    assert_eq!(r.png(&PngOptions { color: "notacolor".into(), ..Default::default() }), Err(PngError::Color("notacolor".into())));
    assert_eq!(r.png(&PngOptions { background: Some("#12".into()), ..Default::default() }), Err(PngError::Color("#12".into())));
    assert_eq!(r.png(&PngOptions { dpi: 0.0, ..Default::default() }), Err(PngError::Dpi(0.0)));
    assert!(matches!(r.png(&PngOptions { dpi: f32::NAN, ..Default::default() }), Err(PngError::Dpi(_))));
    assert!(matches!(r.png(&PngOptions { dpi: 1e9, ..Default::default() }), Err(PngError::Size { .. })));
    assert!(PngOptions::default().check().is_ok());
    assert!(matches!(from_svg("<html>", &PngOptions::default()), Err(PngError::Svg(_))));
}
