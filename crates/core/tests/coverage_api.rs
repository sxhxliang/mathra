//! Corners of the public API: the composite symbols' table, and the PNG's errors and the SVGs it
//! is given.

use mathra::composite;

#[test]
fn only_the_doubled_ceilings_and_floors_are_doubled() {
    assert_eq!(composite::doubled(composite::LLCEIL), Some('⌈'));
    assert_eq!(composite::doubled(composite::RRFLOOR), Some('⌋'));
    assert_eq!(composite::doubled(composite::VAROCIRCLE), None);
    assert_eq!(composite::doubled('⌈'), None);
}

#[cfg(feature = "png")]
mod png {
    use mathra::output::png::from_svg;
    use mathra::{convert, Options, PngError, PngOptions};

    #[test]
    fn every_error_says_what_is_wrong() {
        assert_eq!(PngError::Color("teal-ish".into()).to_string(), "not a color: teal-ish");
        assert_eq!(PngError::Dpi(-1.0).to_string(), "the dpi must be a positive number, not -1");
        assert_eq!(PngError::Size { width: 40000, height: 2 }.to_string(), "the image would be too large: 40000×2 pixels");
        assert_eq!(PngError::Svg("no <svg> element".into()).to_string(), "cannot read the SVG: no <svg> element");
        // and the checks give them
        assert_eq!(PngOptions { color: "teal-ish".into(), ..Default::default() }.check(), Err(PngError::Color("teal-ish".into())));
        assert_eq!(PngOptions { dpi: 0.0, ..Default::default() }.check(), Err(PngError::Dpi(0.0)));
    }

    #[test]
    fn a_style_left_open_is_dropped_to_the_end() {
        let svg = convert("x", &Options::default()).unwrap().svg;
        let options = PngOptions::default();
        // a <style> with no end after the drawing: what follows it is not drawn, the rest is
        let open = format!("{svg}<style>svg{{color:red}}");
        assert_eq!(from_svg(&open, &options).unwrap(), from_svg(&svg, &options).unwrap());
    }

    #[test]
    fn an_svg_that_does_not_parse_is_refused() {
        let broken = r#"<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"><g></svg>"#;
        assert!(matches!(from_svg(broken, &PngOptions::default()), Err(PngError::Svg(_))));
        // without a size in em, before anything is parsed
        let e = from_svg(r#"<svg width="10px" height="1em"></svg>"#, &PngOptions::default()).unwrap_err();
        assert_eq!(e, PngError::Svg(r#"width="10px" is not in em"#.into()));
        let e = from_svg(r#"<svg width="1em"></svg>"#, &PngOptions::default()).unwrap_err();
        assert_eq!(e, PngError::Svg("no height on <svg>".into()));
    }
}
