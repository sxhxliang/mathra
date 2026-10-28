//! Presentation commands supported by RaTeX 0.1.15, with semantic and geometric checks.
use mathra::font::MathFont;
use mathra::layout::{Item, MathBox};
use mathra::tree::{Cancel, Frame, Variant};
use mathra::{Node, Options};

fn options() -> Options {
    Options { strict: true, ..Default::default() }
}
fn output(tex: &str) -> mathra::Output {
    let r = mathra::convert(tex, &options()).unwrap_or_else(|e| panic!("{tex}: {e}"));
    assert!(r.warnings.is_empty(), "{tex}: {:?}", r.warnings);
    r
}
fn box_of(tex: &str) -> MathBox {
    mathra::typeset(tex, &options()).unwrap().0
}
fn near(a: f32, b: f32) {
    assert!((a - b).abs() < 0.01, "{a} differs from {b}");
}

#[test]
fn new_commands_render_in_both_styles_and_available_fonts() {
    #[cfg(not(feature = "latin-modern"))]
    let fonts = [MathFont::default()];
    #[cfg(feature = "latin-modern")]
    let fonts = [MathFont::default(), MathFont::LatinModern];
    for font in fonts {
        for c in "Abx".chars() {
            let mapped = mathra::layout::alphabet::character(c, Variant::SansSerifItalic);
            assert!(font.get().glyph(mapped).is_some(), "{font:?} lacks sans-serif italic {c}");
        }
    }
    for tex in [
        r"\slashed{D}",
        r"\slashed{A}",
        r"\slashed{k}",
        r"\slashed{f}",
        r"\slashed{\partial}",
        r"\slashed{pq}",
        r"\mathbf{\slashed{D}}",
        r"\ctg x+\arcctg x",
        r"\frak{ABCxyz}",
        r"\mathsfit{Abx12}",
        r"\sixptsize abc",
        r"\Overrightarrow{ABC}",
        r"\overgroup{ABC}",
        r"\undergroup{ABC}",
        r"\overlinesegment{ABC}",
        r"\underlinesegment{ABC}",
        r"\r{a}",
        r"\xrightleftarrows[below]{a label wider than the arrow}",
        r"\htmlStyle{color:red;background-color:yellow;font-size:150%;font-weight:bold;font-style:italic;text-decoration:underline}{x+y}",
    ] {
        for font in fonts {
            for display in [false, true] {
                let options = Options { display, ..options() };
                let r = mathra::convert_in_font(tex, &options, font).unwrap_or_else(|e| panic!("{tex}, {font:?}: {e}"));
                assert!(r.warnings.is_empty(), "{tex}: {:?}", r.warnings);
                let image = mathra::render_svg(tex, &options, &mathra::SvgRenderOptions { font, ..Default::default() }).unwrap();
                assert!(image.width > 0.0 && image.height > 0.0);
                roxmltree::Document::parse(&image.svg).unwrap();
            }
        }
    }
}

#[test]
fn aliases_keep_their_semantic_nodes() {
    for (alias, canonical) in [(r"\ctg x", r"\cot x"), (r"\arcctg x", r"\arccot x"), (r"\frak{Ab}", r"\mathfrak{Ab}"), (r"\xrightleftarrows[a]{b}", r"\xtofrom[a]{b}")] {
        assert_eq!(output(alias).tree, output(canonical).tree);
    }
    assert!(matches!(output(r"\mathsfit{x}").tree.single(), Node::Identifier { variant: Variant::SansSerifItalic, .. }));
    assert_eq!(mathra::layout::alphabet::character('A', Variant::SansSerifItalic), '𝘈');
    assert_eq!(mathra::layout::alphabet::character('x', Variant::SansSerifItalic), '𝘹');
    assert!(matches!(output(r"\slashed{D}").tree.single(), Node::Canceled { shape: Cancel::Slash, .. }));
}

#[test]
fn slash_uses_an_overlay_glyph_instead_of_a_box_diagonal() {
    let b = box_of(r"\slashed{D}");
    assert_eq!(b.items.iter().filter(|i| matches!(i, Item::Glyph { .. })).count(), 2);
    assert!(!b.items.iter().any(|i| matches!(i, Item::Line { .. })));
    let plain = box_of("D");
    let slash = box_of("/");
    near(b.width, plain.width.max(slash.width));
    let ys: Vec<_> = b.items.iter().filter_map(|i| if let Item::Glyph { y, .. } = i { Some(*y) } else { None }).collect();
    near(ys[0], 0.0);
    near(ys[1], (plain.height - plain.depth - slash.height + slash.depth) / 2.0);
    let out = output(r"\slashed{D}");
    assert!(out.speech.contains("slashed D") && !out.speech.contains("canceled"));
    assert_eq!(out.text, "slashed(D)");
    // Neither supported braille code supplies a Feynman-slash sign; report it rather than cancellation.
    for code in mathra::BrailleCode::ALL {
        assert_eq!(mathra::output::braille::transcribe(&out.tree, code).missing, vec!['╱']);
    }
}

#[test]
fn group_marks_and_line_segments_draw_on_the_correct_side() {
    for (tex, above) in [(r"\overgroup{abc}", true), (r"\undergroup{abc}", false), (r"\overlinesegment{abc}", true), (r"\underlinesegment{abc}", false)] {
        let base = box_of("abc");
        let b = box_of(tex);
        if above {
            assert!(b.height > base.height);
        } else {
            assert!(b.depth > base.depth);
        }
        assert!(b.items.iter().any(|i| matches!(i, Item::Line { .. } | Item::Rule { .. })));
        let (_, y0, _, y1) = b.ink(MathFont::default().get()).unwrap();
        assert!(y0 >= -b.depth - 0.01 && y1 <= b.height + 0.01);
    }
}

#[test]
fn all_size_declarations_apply_the_ratex_multipliers() {
    let base = box_of("x");
    for (name, factor) in [
        ("tiny", 0.5),
        ("sixptsize", 0.6),
        ("scriptsize", 0.7),
        ("footnotesize", 0.8),
        ("small", 0.9),
        ("normalsize", 1.0),
        ("large", 1.2),
        ("Large", 1.44),
        ("LARGE", 1.728),
        ("huge", 2.074),
        ("Huge", 2.488),
    ] {
        let b = box_of(&format!(r"\{name} x"));
        near(b.width, base.width * factor);
        near(b.height, base.height * factor);
        near(b.depth, base.depth * factor);
        assert_eq!(output(&format!(r"\{name} x")).text, "x");
    }
}

#[test]
fn nested_sizes_replace_the_previous_size_and_stop_at_the_group_boundary() {
    for tex in [r"\Huge{\normalsize x}", r"\tiny{\normalsize x}", r"\Large{\small{\normalsize x}}"] {
        let b = box_of(tex);
        let base = box_of("x");
        near(b.width, base.width);
        near(b.height, base.height);
    }
    let scoped = box_of(r"{\Huge x}x");
    let huge = box_of(r"\Huge x");
    let base = box_of("x");
    near(scoped.width, huge.width + base.width);
    let end = box_of(r"\begin{matrix}\Huge x & x \\ x & x\end{matrix}");
    assert!(end.width.is_finite());
    // Explicit size inside a script resets to text style instead of taking a second script scale.
    let script = box_of(r"a^{\normalsize x}");
    let id = MathFont::default().get().glyph('𝑥').unwrap();
    assert!(script.items.iter().any(|i| matches!(i,Item::Glyph{id:g,scale,..} if *g==id && (*scale-1.0).abs()<0.001)));
}

#[test]
fn html_style_sets_color_font_scale_background_and_underline() {
    let plain = box_of("x");
    for size in ["2em", "2rem", "200%", "32px"] {
        let b = box_of(&format!(r"\htmlStyle{{font-size:{size}}}{{x}}"));
        near(b.width, plain.width * 2.0);
        near(b.height, plain.height * 2.0);
    }
    let b = box_of(r"\htmlStyle{background:yellow}{x}");
    near(b.width, plain.width);
    near(b.height, plain.height);
    near(b.depth, plain.depth);
    assert!(matches!(output(r"\htmlStyle{background:yellow}{x}").tree.single(), Node::Framed { shape: Frame::Background, .. }));
    assert!(matches!(b.items.first(),Some(Item::Rule{color:Some(c),..}) if c=="yellow"));
    let styled = output(r"\htmlStyle{color:red;font-weight:700;font-style:oblique;text-decoration-line:underline}{x}");
    assert!(styled.svg.contains("red"));
    assert!(format!("{:?}", styled.tree).contains("BoldItalic"));
    assert!(matches!(styled.tree.single(), Node::Bar { above: false, .. }));
}

#[test]
fn html_style_ignores_unknown_css_and_honors_later_declarations() {
    let plain = box_of("x");
    for css in ["font-size:NaN", "font-size:-1em", "font-size:infem", "font-size:0%", "position:fixed;left:100px", "background:url(https://example.invalid/x)"] {
        let out = output(&format!(r"\htmlStyle{{{css}}}{{x}}"));
        let b = box_of(&format!(r"\htmlStyle{{{css}}}{{x}}"));
        near(b.width, plain.width);
        near(b.height, plain.height);
        assert!(!out.svg.contains("<image"));
        assert!(!format!("{:?}", out.tree).contains("url("));
    }
    let b = box_of(r"\htmlStyle{font-size:200%;font-size:100%;font-weight:bold;font-weight:normal}{x}");
    near(b.width, plain.width);
    near(b.height, plain.height);
    assert!(!format!("{:?}", output(r"\htmlStyle{color:blue;color:red}{x}").tree).contains("blue"));
}

#[test]
fn new_commands_preserve_strict_errors_and_nesting_limits() {
    for tex in [r"\slashed", r"\htmlStyle{color:red}", r"\Overrightarrow", r"\mathsfit{\unknowncommand{x}}"] {
        assert!(mathra::convert(tex, &options()).is_err(), "accepted {tex}");
    }
    let deep = r"\Huge ".repeat(100) + "x";
    for strict in [false, true] {
        assert!(mathra::convert(&deep, &Options { strict, ..options() }).is_err());
    }
}
