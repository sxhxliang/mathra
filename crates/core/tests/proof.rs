//! The RaTeX bussproofs subset: syntax, inference attachment geometry, and accessible output.
use mathra::font::MathFont;
use mathra::input::latex::NESTING_LIMIT;
use mathra::layout::{Item, MathBox};
use mathra::output::braille::BrailleCode;
use mathra::tree::{ProofBranch, ProofLine};
use mathra::{Locale, Node, Options};

fn options() -> Options {
    Options { strict: true, ..Options::default() }
}

fn wrap(body: &str) -> String {
    format!(r"\begin{{prooftree}}{body}\end{{prooftree}}")
}

fn parse(body: &str) -> Box<ProofBranch> {
    let output = mathra::convert(&wrap(body), &options()).unwrap();
    assert!(output.warnings.is_empty());
    match output.tree.single() {
        Node::ProofTree { tree } => tree.clone(),
        other => panic!("expected proof, got {other:?}"),
    }
}

fn typeset(body: &str) -> MathBox {
    mathra::typeset(&wrap(body), &options()).unwrap().0
}

fn rules(b: &MathBox) -> Vec<(f32, f32, f32)> {
    b.items
        .iter()
        .filter_map(|i| match i {
            Item::Rule { x, y, width, .. } => Some((*x, *y, *width)),
            _ => None,
        })
        .collect()
}

fn glyph(b: &MathBox, c: char) -> (f32, f32, f32) {
    let font = MathFont::default().get();
    let id = font.glyph(c).unwrap();
    b.items
        .iter()
        .find_map(|i| match i {
            Item::Glyph { id: g, x, y, scale, .. } if *g == id => Some((*x, *y, font.advance(id) * scale)),
            _ => None,
        })
        .unwrap_or_else(|| panic!("missing {c}"))
}

#[test]
fn all_arities_and_aliases_preserve_premise_order() {
    for axiom in ["AxiomC", "Axiom", "AXC"] {
        assert!(parse(&format!(r"\{axiom}{{P}}")).premises.is_empty());
    }
    for (arity, commands) in [
        (1, vec!["UnaryInfC", "UnaryInf", "UIC"]),
        (2, vec!["BinaryInfC", "BinaryInf", "BIC"]),
        (3, vec!["TrinaryInfC", "TrinaryInf", "TIC"]),
        (4, vec!["QuaternaryInfC", "QuaternaryInf"]),
        (5, vec!["QuinaryInfC", "QuinaryInf"]),
    ] {
        let premises = (0..arity).map(|i| format!(r"\AXC{{{i}}}")).collect::<String>();
        for command in commands {
            let tree = parse(&format!(r"{premises}\{command}{{R}}"));
            assert_eq!(tree.premises.len(), arity);
            for (i, premise) in tree.premises.iter().enumerate() {
                assert_eq!(mathra::output::text::linear(&premise.conclusion, Locale::En), i.to_string());
            }
        }
    }
}

#[test]
fn labels_and_once_only_settings_apply_to_the_next_inference() {
    let tree = parse(r"\LL{left}\RL{right}\dashedLine\rootAtTop\AXC{P}\UIC{Q}\UIC{R}");
    assert_eq!(tree.line, ProofLine::Solid);
    assert!(!tree.root_at_top);
    assert!(tree.left_label.is_none() && tree.right_label.is_none());
    let child = &tree.premises[0];
    assert_eq!(child.line, ProofLine::Dashed);
    assert!(child.root_at_top);
    assert!(child.left_label.is_some() && child.right_label.is_some());
    let full = parse(r"\AXC{P}\LeftLabel{L}\RightLabel{R}\UIC{Q}");
    assert!(full.left_label.is_some() && full.right_label.is_some());
}

#[test]
fn persistent_line_and_direction_settings_can_be_overridden_once() {
    for (setting, expected) in
        [("alwaysSingleLine", ProofLine::Solid), ("alwaysSolidLine", ProofLine::Solid), ("alwaysDashedLine", ProofLine::Dashed), ("alwaysNoLine", ProofLine::None)]
    {
        let tree = parse(&format!(r"\{setting}\alwaysRootAtTop\AXC{{P}}\noLine\rootAtBottom\UIC{{Q}}\UIC{{R}}"));
        assert_eq!(tree.line, expected);
        assert!(tree.root_at_top);
        assert_eq!(tree.premises[0].line, ProofLine::None);
        assert!(!tree.premises[0].root_at_top);
    }
    let tree = parse(r"\alwaysRootAtTop\alwaysRootAtBottom\AXC{P}\UIC{Q}\UIC{R}");
    assert!(!tree.root_at_top && !tree.premises[0].root_at_top);
    for command in ["solidLine", "singleLine"] {
        assert_eq!(parse(&format!(r"\alwaysNoLine\AXC{{P}}\{command}\UIC{{Q}}")).line, ProofLine::Solid);
    }
}

#[test]
fn invalid_structures_are_errors_in_both_modes() {
    for tex in [
        wrap(""),
        wrap(r"\AXC{P}\AXC{Q}"),
        wrap(r"\AXC{P}\BIC{Q}"),
        wrap(r"\AXC{P}\LL{L}"),
        wrap(r"\AXC{P}\RL{R}"),
        wrap(r"\AXC{P}\InsertBetweenHyps{x}\UIC{Q}"),
        wrap(r"\AXC{P}\doubleLine\UIC{Q}"),
        wrap(r"\AXC{P}\Cell{Q}"),
        wrap(r"\AXC P"),
        wrap(r"P"),
        r"\begin{prooftree}\AXC{P}".into(),
        r"\begin{prooftree}\AXC{P}\end{matrix}".into(),
    ] {
        for strict in [true, false] {
            assert!(mathra::convert(&tex, &Options { strict, ..options() }).is_err(), "accepted {tex}, strict={strict}");
        }
    }
}

#[test]
fn iterative_and_nested_proofs_share_the_depth_budget() {
    let valid = wrap(&(r"\AXC{P}".to_string() + &r"\UIC{Q}".repeat(10)));
    assert!(mathra::convert(&valid, &options()).is_ok());
    let deep = wrap(&(r"\AXC{P}".to_string() + &r"\UIC{Q}".repeat(NESTING_LIMIT)));
    // Repeated wrappers must not bypass the limit through an argument's sub-reader.
    let mut nested = r"\frac{P}{Q}".to_string();
    for _ in 0..8 {
        nested = wrap(&format!(r"\AXC{{{nested}}}{}", r"\UIC{R}".repeat(10)));
    }
    for tex in [deep, nested] {
        for strict in [true, false] {
            assert!(mathra::convert(&tex, &Options { strict, ..options() }).is_err());
        }
    }
}

#[test]
fn macros_fcenter_and_formula_payloads_use_the_normal_reader() {
    let tex = r"\newcommand{\prem}[1]{\AXC{#1}}\begin{prooftree}\prem{A \fCenter B}\prem{\frac{P}{Q}}\BIC{\mathbf{R}}\end{prooftree}";
    let output = mathra::convert(tex, &options()).unwrap();
    assert!(output.warnings.is_empty());
    assert!(output.text.contains("A ⇒ B"));
    assert!(output.svg.contains("<path"));
    assert!(mathra::convert(&wrap(r"\AXC{\unknowncommand{P}}"), &options()).is_err());
    assert!(!mathra::convert(&wrap(r"\AXC{\unknowncommand{P}}"), &Options::default()).unwrap().warnings.is_empty());
    let looped = r"\def\loop{\loop}\begin{prooftree}\loop\end{prooftree}";
    assert!(mathra::convert(looped, &options()).is_err());
}

#[test]
fn inference_rules_and_conclusion_baselines_follow_orientation() {
    for (command, up) in [("rootAtBottom", true), ("rootAtTop", false)] {
        let b = typeset(&format!(r"\AXC{{P}}\AXC{{Q}}\{command}\BIC{{R}}"));
        let p = glyph(&b, 'P');
        let q = glyph(&b, 'Q');
        let r = glyph(&b, 'R');
        assert!((p.1 - q.1).abs() < 0.001);
        assert_eq!(r.1, 0.0);
        assert_eq!(p.1 > r.1, up);
        let rule = rules(&b)[0];
        assert!((rule.0 + rule.2 / 2.0 - (r.0 + r.2 / 2.0)).abs() < 0.001);
        assert!((rule.1 > r.1) == up);
        assert!(b.width > 0.0 && b.height >= 0.0 && b.depth >= 0.0);
    }
}

#[test]
fn labels_do_not_shift_the_attachment_of_nested_conclusions() {
    // The inner proof has a wide left label; its bounding-box center is not Q's center.
    let b = typeset(r"\AXC{P}\LL{\text{a very long rule label}}\UIC{Q}\UIC{R}");
    let q = glyph(&b, 'Q');
    let r = glyph(&b, 'R');
    assert!((q.0 + q.2 / 2.0 - r.0 - r.2 / 2.0).abs() < 0.001);
    assert!(r.0 > b.width / 2.0);
    for (x, _, w) in rules(&b) {
        assert!(x >= 0.0 && x + w <= b.width + 0.001);
    }
}

#[test]
fn line_styles_change_ink_without_changing_layout() {
    let solid = typeset(r"\AXC{P}\UIC{Q}");
    let dashed = typeset(r"\AXC{P}\dashedLine\UIC{Q}");
    let none = typeset(r"\AXC{P}\noLine\UIC{Q}");
    assert_eq!(rules(&solid).len(), 1);
    assert!(rules(&dashed).len() > 1);
    assert!(rules(&none).is_empty());
    for b in [&dashed, &none] {
        assert_eq!(b.width, solid.width);
        assert_eq!(glyph(b, 'P'), glyph(&solid, 'P'));
        assert_eq!(glyph(b, 'Q'), glyph(&solid, 'Q'));
    }
}

#[test]
fn empty_axioms_and_mixed_direction_subtrees_have_finite_metrics() {
    for body in [r"\AXC{}\UIC{P}", r"\AXC{P}\rootAtTop\UIC{Q}\AXC{R}\BIC{S}", r"\AXC{P}\UIC{Q}\AXC{R}\rootAtTop\BIC{S}"] {
        let b = typeset(body);
        assert!(b.width.is_finite() && b.height.is_finite() && b.depth.is_finite());
        assert!(b.height >= 0.0 && b.depth >= 0.0);
    }
}

#[test]
fn source_tree_speech_text_and_braille_keep_premises_conclusions_and_labels() {
    let tex = wrap(r"\AXC{P}\AXC{Q}\LL{cut}\RL{r}\BIC{R}");
    for locale in Locale::ALL {
        let output = mathra::convert(&tex, &Options { locale, ..options() }).unwrap();
        assert!(!output.speech.contains('{'));
        for letter in ['P', 'Q', 'R'] {
            assert!(output.text.contains(letter));
        }
        assert!(output.text.contains("cut") && output.text.contains("[r]"));
        assert!(output.svg.contains("proof-tree"));
        assert!(output.svg.contains("mathra:source"));
    }
    let output = mathra::convert(&tex, &options()).unwrap();
    assert!(output.speech.contains("premises axiom P; axiom Q; therefore R"), "{}", output.speech);
    assert!(output.speech.contains("rule label") && output.speech.contains("end inference"));
    for code in BrailleCode::ALL {
        let tree = parse(r"\AXC{P}\AXC{Q}\BIC{R}");
        let proof = Node::ProofTree { tree };
        let braille = mathra::output::braille::transcribe(&proof, code);
        assert!(!braille.text.is_empty());
        assert!(braille.missing.is_empty(), "{code}: {:?}", braille.missing);
    }
}

#[test]
fn genius_regressions_render_in_both_styles_and_fonts() {
    #[cfg(not(feature = "latin-modern"))]
    let fonts = [MathFont::default()];
    #[cfg(feature = "latin-modern")]
    let fonts = [MathFont::default(), MathFont::LatinModern];
    for tex in [wrap(r"\AxiomC{A \fCenter B}\LeftLabel{cut}\RightLabel{\alpha}\UnaryInfC{C \fCenter D}"), wrap(r"\AXC{P}\AXC{Q}\dashedLine\BIC{R}")] {
        for display in [true, false] {
            for font in &fonts {
                let o = Options { display, ..options() };
                let output = mathra::convert_in_font(&tex, &o, *font).unwrap();
                let (b, warnings) = mathra::typeset_in_font(&tex, &o, *font).unwrap();
                assert!(warnings.is_empty());
                assert!(b.width > 0.0 && b.height + b.depth > 0.0);
                assert!(output.svg.contains("<path"));
                assert!(!output.svg.contains("NaN"));
                assert!(output.svg.contains("<use"));
            }
        }
    }
}

#[test]
fn inference_weight_and_dash_pattern_are_independent_of_fraction_font_metrics() {
    #[cfg(not(feature = "latin-modern"))]
    let fonts = [MathFont::default()];
    #[cfg(feature = "latin-modern")]
    let fonts = [MathFont::default(), MathFont::LatinModern];
    for font in fonts {
        let expected = font.get().units_per_em() * 0.08;
        for dashed in [false, true] {
            let style = if dashed { r"\dashedLine" } else { r"\solidLine" };
            let tex = wrap(&format!(r"\AXC{{P}}\AXC{{Q}}{style}\BIC{{R}}"));
            let b = mathra::typeset_in_font(&tex, &options(), font).unwrap().0;
            let rules: Vec<_> = b
                .items
                .iter()
                .filter_map(|i| match i {
                    Item::Rule { x, width, height, .. } => Some((*x, *width, *height)),
                    _ => None,
                })
                .collect();
            assert!(rules.iter().all(|(_, _, h)| (*h - expected).abs() < 0.001));
            if dashed {
                assert!((rules[0].1 - expected * 3.0).abs() < 0.001);
                for pair in rules.windows(2) {
                    assert!((pair[1].0 - pair[0].0 - expected * 6.0).abs() < 0.001);
                }
            }
        }
    }
}
