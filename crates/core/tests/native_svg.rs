//! Absolute image sizing, baseline metrics and theme ink for desktop/export consumers.
use mathra::font::MathFont;
use mathra::{render_svg, Error, Options, RenderError, RenderedSvg, SvgRenderOptions};

fn options() -> Options {
    Options { strict: true, ..Options::default() }
}

fn render(tex: &str) -> RenderedSvg {
    render_svg(tex, &options(), &SvgRenderOptions::default()).unwrap_or_else(|e| panic!("{tex}: {e}"))
}

fn near(a: f32, b: f32) {
    assert!((a - b).abs() < 0.0011, "{a} differs from {b}");
}

#[test]
fn standalone_svg_has_absolute_dimensions_and_no_font_or_theme_dependencies() {
    let image = render(r"\frac{a}{b}");
    let xml = roxmltree::Document::parse(&image.svg).unwrap();
    let root = xml.root_element();
    near(root.attribute("width").unwrap().parse().unwrap(), image.width);
    near(root.attribute("height").unwrap().parse().unwrap(), image.height);
    assert_eq!(root.attribute("color"), Some("#111111"));
    assert!(root.attribute("style").unwrap().contains("px"));
    assert!(!xml.descendants().any(|n| matches!(n.tag_name().name(), "text" | "style" | "image")));
    assert!(xml.descendants().any(|n| n.has_tag_name("path")));
    assert!(xml.descendants().any(|n| n.has_tag_name("use")));
    for name in ["source", "tree", "font", "braille"] {
        assert!(xml.descendants().any(|n| n.tag_name().name() == name));
    }
}

#[test]
fn size_ascent_and_depth_scale_together() {
    for tex in [r"x_i^2", r"\sum_{n=1}^\infty\frac{1}{n^2}", r"\begin{prooftree}\AXC{P}\AXC{Q}\BIC{R}\end{prooftree}"] {
        let small = render(tex);
        let large = render_svg(tex, &options(), &SvgRenderOptions { font_size: 32.0, ..Default::default() }).unwrap();
        near(large.width, 2.0 * small.width);
        near(large.height, 2.0 * small.height);
        near(large.ascent, 2.0 * small.ascent);
        near(large.height - large.ascent, 2.0 * (small.height - small.ascent));
        assert!(small.ascent >= 0.0 && small.ascent <= small.height);
    }
}

#[test]
fn viewbox_and_metrics_include_overhanging_ink() {
    for tex in [
        r"\mathbf{f}",
        r"\cancel{\rho}",
        r"\reflectbox{\mathbf{f}}",
        r"\raisebox{-2em}{x}",
        r"\begin{prooftree}\AXC{P}\LL{\text{long left label}}\RL{\alpha}\rootAtTop\UIC{Q}\end{prooftree}",
    ] {
        let (b, _) = mathra::typeset(tex, &options()).unwrap();
        let font = MathFont::default().get();
        let (x0, y0, x1, y1) = b.ink(font).unwrap();
        let image = render(tex);
        let xml = roxmltree::Document::parse(&image.svg).unwrap();
        let bounds: Vec<f32> = xml.root_element().attribute("viewBox").unwrap().split_whitespace().map(|n| n.parse().unwrap()).collect();
        assert!(bounds[0] <= x0 + 0.001 && bounds[0] + bounds[2] >= x1 - 0.001);
        assert!(bounds[1] <= -y1 + 0.001 && bounds[1] + bounds[3] >= -y0 - 0.001);
        let scale = 16.0 / font.units_per_em();
        near(image.width, bounds[2] * scale);
        near(image.height, bounds[3] * scale);
        near(image.ascent, -bounds[1] * scale);
    }
}

#[test]
fn theme_ink_changes_without_changing_layout_and_tex_colors_still_win() {
    let light = render_svg(r"x+\color{red}{y}", &options(), &SvgRenderOptions { color: 0x112233, ..Default::default() }).unwrap();
    let dark = render_svg(r"x+\color{red}{y}", &options(), &SvgRenderOptions { color: 0xddeeff, ..Default::default() }).unwrap();
    near(light.width, dark.width);
    near(light.height, dark.height);
    near(light.ascent, dark.ascent);
    assert!(light.svg.contains("color=\"#112233\""));
    assert!(dark.svg.contains("color=\"#ddeeff\""));
    let xml = roxmltree::Document::parse(&dark.svg).unwrap();
    assert!(xml.descendants().any(|n| n.attribute("fill").is_some_and(|f| f != "currentColor" && f != "none")));
    assert!(!dark.svg.contains("svg:root"));
}

#[test]
fn invalid_sizes_and_zero_area_outputs_are_rejected_before_rasterization() {
    for size in [0.0, -1.0, f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
        assert!(matches!(render_svg("x", &options(), &SvgRenderOptions { font_size: size, ..Default::default() }), Err(RenderError::InvalidFontSize)));
    }
    for tex in ["", " ", r"\hspace{1em}"] {
        assert!(matches!(render_svg(tex, &options(), &Default::default()), Err(RenderError::InvalidDimensions)));
    }
    assert!(matches!(render_svg("x", &options(), &SvgRenderOptions { font_size: f32::MIN_POSITIVE, ..Default::default() }), Err(RenderError::InvalidDimensions)));
    assert!(matches!(render_svg(r"\rule{100em}{100em}", &options(), &SvgRenderOptions { font_size: f32::MAX, ..Default::default() }), Err(RenderError::InvalidDimensions)));
}

#[test]
fn strict_errors_and_tolerant_warnings_are_preserved() {
    for tex in [r"\unknowncommand{x}", r"\frac{1}{", r"\def\loop{\loop}\loop"] {
        assert!(matches!(render_svg(tex, &options(), &Default::default()), Err(RenderError::Formula(Error::Syntax { .. }))));
    }
    assert!(matches!(render_svg(r"\text{中文}", &options(), &Default::default()), Err(RenderError::Formula(Error::MissingGlyph { .. }))));
    let image = render_svg(r"\unknowncommand{x}", &Options::default(), &Default::default()).unwrap();
    assert!(!image.warnings.is_empty());
    assert!(image.svg.contains("mathra:warning"));
}

#[test]
fn web_svg_contract_is_unchanged_and_native_geometry_matches_it() {
    let source = r"e^{i\pi}+1=0";
    let web = mathra::convert(source, &options()).unwrap();
    assert!(web.svg.contains("<text") && web.svg.contains("svg:root{color:#111}"));
    let image = render(source);
    let web_xml = roxmltree::Document::parse(&web.svg).unwrap();
    let native_xml = roxmltree::Document::parse(&image.svg).unwrap();
    assert_eq!(web_xml.root_element().attribute("viewBox"), native_xml.root_element().attribute("viewBox"));
    let paths = |xml: &roxmltree::Document<'_>| xml.descendants().filter(|n| n.has_tag_name("path")).map(|n| n.attribute("d").unwrap().to_string()).collect::<Vec<_>>();
    assert_eq!(paths(&web_xml), paths(&native_xml));
    assert_eq!(image.svg, render(source).svg);
}

#[test]
fn real_genius_corpus_renders_in_both_styles_and_fonts() {
    // Frozen from Genius docs/math.md, docs/chemistry.md and scientific-math.md.
    // The unknown command is intentionally invalid; source paths are provenance only.
    let corpus: serde_json::Value = serde_json::from_str(include_str!("fixtures/genius-math.json")).unwrap();
    #[cfg(not(feature = "latin-modern"))]
    let fonts = [MathFont::default()];
    #[cfg(feature = "latin-modern")]
    let fonts = [MathFont::default(), MathFont::LatinModern];
    for sample in corpus.as_array().unwrap() {
        let tex = sample["latex"].as_str().unwrap();
        for display in [true, false] {
            for font in fonts {
                let result = render_svg(tex, &Options { display, ..options() }, &SvgRenderOptions { font, ..Default::default() });
                if tex == r"\unknowncommand{x}" {
                    assert!(result.is_err());
                    continue;
                }
                let image = result.unwrap_or_else(|e| panic!("{}: {tex}, {font:?}, display={display}: {e}", sample["source"]));
                assert!(image.warnings.is_empty());
                assert!(image.width > 0.0 && image.height > 0.0);
                assert!(image.ascent >= 0.0 && image.ascent <= image.height);
                let xml = roxmltree::Document::parse(&image.svg).unwrap();
                assert!(!xml.descendants().any(|n| n.has_tag_name("text")));
                assert!(xml.descendants().any(|n| n.has_tag_name("path")));
            }
        }
    }
}
