use mathra::{tex_to_omml, OmmlError};
use roxmltree::Document;

const NS: &str = mathra::output::omml::NAMESPACE;

#[test]
fn s_omml_1_fragment_is_namespaced_and_contains_native_structures() {
    let xml = tex_to_omml(r"\frac{1}{\sqrt[3]{x_i^2}}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    assert!(doc.root_element().has_tag_name((NS, "oMath")));
    for name in ["f", "num", "den", "rad", "deg", "sSubSup", "sub", "sup"] {
        assert!(doc.descendants().any(|n| n.has_tag_name((NS, name))), "{name}: {xml}");
    }
    assert!(!xml.contains("w:document"));
    assert!(!xml.contains("svg"));
}

#[test]
fn s_omml_1_common_constructs_produce_valid_xml() {
    for source in [
        r"\binom{n}{k}",
        r"\sqrt{x}",
        r"x_i+y^2",
        r"\left. x \right|_0^1",
        r"\left(a\middle|b\right)",
        r"\hat{x}+\overline{y}+\underline{z}",
        r"\overset{a}{x}+\underset{b}{y}",
        r"\xrightarrow[b]{a}",
        r"\begin{cases} x & x>0 \\ -x & x<0 \end{cases}",
        r"\begin{pmatrix}a&b\\c&d\end{pmatrix}",
        r"\mathbb{R}+\mathbf{x}+\mathcal{F}+\mathfrak{g}",
        r"\text{if $x>0$}",
        r"\boxed{x}",
        r"\overbrace{a+b}^{n}",
        r"\phantom{x}",
    ] {
        let xml = tex_to_omml(source).unwrap_or_else(|e| panic!("{source}: {e}"));
        Document::parse(&xml).unwrap();
    }
}

#[test]
fn s_omml_1_nary_limits_and_operand() {
    for (source, location) in [(r"\sum_{i=1}^n x_i", "undOvr"), (r"\int_0^1 x", "subSup"), (r"\int\limits_0^1 x", "undOvr")] {
        let xml = tex_to_omml(source).unwrap();
        let doc = Document::parse(&xml).unwrap();
        let nary = doc.descendants().find(|n| n.has_tag_name((NS, "nary"))).unwrap();
        assert!(nary.descendants().any(|n| n.has_tag_name((NS, "limLoc")) && n.attribute((NS, "val")) == Some(location)));
        let operand = nary.children().find(|n| n.has_tag_name((NS, "e"))).unwrap();
        assert!(operand.descendants().any(|n| n.text() == Some("x")));
    }
}

#[test]
fn s_omml_1_text_is_escaped_without_injecting_xml() {
    let source = r#"\text{a < b & c > d "quotes"}"#;
    let xml = tex_to_omml(source).unwrap();
    let doc = Document::parse(&xml).unwrap();
    assert!(xml.contains("&lt;"));
    assert!(xml.contains("&amp;"));
    assert!(doc.descendants().filter(|n| n.is_element()).all(|n| n.tag_name().namespace() == Some(NS)));
}

#[test]
fn s_omml_1_errors_are_explicit() {
    assert!(matches!(tex_to_omml(r"\frac{1}"), Err(OmmlError::Parse(_))));
    assert!(matches!(tex_to_omml(r"\unknowncommand{x}"), Err(OmmlError::Parse(_))));
    assert!(matches!(tex_to_omml(r"\reflectbox{x}"), Err(OmmlError::Unsupported(_))));
    assert!(matches!(tex_to_omml(r"\begin{array}{c|c}a&b\end{array}"), Err(OmmlError::Unsupported(_))));
}

#[test]
fn s_omml_2_lower_accents_preserve_character_position_and_base() {
    for (source, chr) in [(r"\underrightarrow{ab}", "→"), (r"\underleftarrow{x}", "←"), (r"\underleftrightarrow{x}", "↔"), (r"\utilde{x}", "\u{0303}")] {
        let xml = tex_to_omml(source).unwrap();
        let doc = Document::parse(&xml).unwrap();
        let group = doc.descendants().find(|n| n.has_tag_name((NS, "groupChr"))).unwrap();
        for (tag, value) in [("chr", chr), ("pos", "bot"), ("vertJc", "top")] {
            assert!(group.descendants().any(|n| n.has_tag_name((NS, tag)) && n.attribute((NS, "val")) == Some(value)), "{xml}");
        }
        assert!(group.children().any(|n| n.has_tag_name((NS, "e"))));
    }
}

#[test]
fn s_omml_3_merge_only_adjacent_runs_with_identical_properties() {
    let xml = tex_to_omml(r"abc+12+\mathbf{de}+\frac{fg}{hi}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let texts: Vec<_> = doc.descendants().filter(|n| n.has_tag_name((NS, "t"))).map(|n| n.text().unwrap_or("")).collect();
    assert_eq!(texts, ["abc", "+12+", "de", "+", "fg", "hi"]);
    let xml = tex_to_omml(r"\text{a & b}\text{ < c}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let texts: Vec<_> = doc.descendants().filter(|n| n.has_tag_name((NS, "t"))).collect();
    assert_eq!(texts.len(), 1);
    assert_eq!(texts[0].text(), Some("a & b < c"));
    // A long identifier run exercises compaction without a corpus-specific claim.
    let xml = tex_to_omml("abcdefghijklmnop").unwrap();
    assert_eq!(Document::parse(&xml).unwrap().descendants().filter(|n| n.has_tag_name((NS, "r"))).count(), 1);
}

#[test]
fn s_omml_4_native_colors_preserve_nested_scopes_and_control_characters() {
    const W: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let xml = tex_to_omml(r"\textcolor{red}{a+\textcolor{blue}{\frac{b}{c}}+d}+e").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let runs: Vec<_> = doc
        .descendants()
        .filter(|n| n.has_tag_name((NS, "r")))
        .map(|run| {
            let text = run.children().find(|n| n.has_tag_name((NS, "t"))).unwrap().text().unwrap();
            let color = run.descendants().find(|n| n.has_tag_name((W, "color"))).and_then(|n| n.attribute((W, "val")));
            (text, color)
        })
        .collect();
    assert_eq!(
        runs,
        [("a", Some("FF0000")), ("+", Some("FF0000")), ("b", Some("0000FF")), ("c", Some("0000FF")), ("+", Some("FF0000")), ("d", Some("FF0000")), ("+", None), ("e", None)]
    );
    let frac = doc.descendants().find(|n| n.has_tag_name((NS, "fPr"))).unwrap();
    assert_eq!(frac.descendants().find(|n| n.has_tag_name((W, "color"))).unwrap().attribute((W, "val")), Some("0000FF"));
    for (source, expected) in [(r"\textcolor[HTML]{12abEF}{x}", "12ABEF"), (r"\textcolor{#abc}{x}", "AABBCC"), (r"\textcolor[rgb]{1,0.5,0}{x}", "FF8000")] {
        let xml = tex_to_omml(source).unwrap();
        assert!(xml.contains(&format!("w:val=\"{expected}\"")), "{xml}");
    }
    assert!(matches!(tex_to_omml(r"\textcolor{unrecognized}{x}"), Err(OmmlError::Unsupported(_))));
    assert!(matches!(tex_to_omml(r"\textcolor[rgb]{2,0,0}{x}"), Err(OmmlError::Unsupported(_))));
}

#[test]
fn s_omml_4_color_applies_to_objects_without_existing_properties() {
    let xml = tex_to_omml(r"\textcolor{red}{x_i+\boxed{y}+\begin{matrix}a&b\\c&d\end{matrix}}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    for tag in ["sSubPr", "borderBoxPr", "mPr"] {
        let pr = doc.descendants().find(|n| n.has_tag_name((NS, tag))).unwrap();
        assert!(pr.children().any(|n| n.has_tag_name((NS, "ctrlPr"))));
    }
}

#[test]
fn s_omml_5_native_constructions_cover_parser_packages() {
    for source in [
        r"\cancel{x}+\bcancel{y}+\xcancel{z}+\slashed{p}",
        r"\phase{z}+\angl{n}+\colorbox{yellow}{x}+\fcolorbox{red}{yellow}{y}",
        r"\SI{9.8}{\meter\per\second\squared}+\si{\kilo\gram}",
        r"a\!b\hspace{-0.5em}c\quad d",
        r"\smash[t]{x}+\smash[b]{y}+\mathrlap{z}",
        r"\raisebox{0.5em}{x}+\scalebox{1.5}{y}+\vcenter{z}",
        r"\dfrac{1}{2}+\tfrac{3}{4}+{\scriptstyle x}+{\scriptscriptstyle y}",
        r"\prescript{14}{6}{C}+\sin^2 x+\lim_{x\to 0} f(x)",
        r"\begin{array}{lcr}a&b&c\\d&e&f\end{array}",
        r"\begin{array}{r@{=}l}a&b\\c&d\end{array}",
        r"\begin{aligned}a&=b\\c&=d\end{aligned}",
        r"\begin{align}a&=b\intertext{therefore}c&=d\end{align}",
        r"\begin{prooftree}\AxiomC{A}\AxiomC{B}\BinaryInfC{C}\end{prooftree}",
    ] {
        let xml = tex_to_omml(source).unwrap_or_else(|e| panic!("{source}: {e}"));
        let doc = Document::parse(&xml).unwrap_or_else(|e| panic!("{source}: {e}: {xml}"));
        let schema = serde_json::from_str(include_str!("fixtures/omml-sequences.json")).unwrap();
        check_sequence_order(&doc, &schema, source);
    }
}

#[test]
fn s_omml_5_units_do_not_duplicate_metadata_value() {
    let xml = tex_to_omml(r"\SI{9.8}{\meter\per\second\squared}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let text: String = doc.descendants().filter(|n| n.has_tag_name((NS, "t"))).filter_map(|n| n.text()).collect();
    assert_eq!(text.matches("9.8").count(), 1, "{xml}");
    assert!(text.contains('m') && text.contains('s'));
}

#[test]
fn s_omml_5_prescripts_alignment_and_native_separators() {
    for (source, tag) in [(r"\prescript{14}{6}{C}", "sPre"), (r"\sin x", "func"), (r"\left(a\middle|b\right)", "sepChr")] {
        let xml = tex_to_omml(source).unwrap();
        assert!(Document::parse(&xml).unwrap().descendants().any(|n| n.has_tag_name((NS, tag))), "{source}: {xml}");
    }
    let xml = tex_to_omml(r"\begin{array}{lcr}a&b&c\end{array}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let alignments: Vec<_> = doc.descendants().filter(|n| n.has_tag_name((NS, "mcJc"))).filter_map(|n| n.attribute((NS, "val"))).collect();
    assert_eq!(alignments, ["left", "center", "right"]);
}

#[test]
fn s_omml_5_reference_size_and_composed_properties() {
    let xml = mathra::tex_to_omml_with(r"\textcolor{red}{\scalebox{2}{x}}+\raisebox{1em}{y}", &mathra::OmmlOptions { font_size: 10.0 }).unwrap();
    assert!(xml.contains("<w:sz w:val=\"40\"/>"), "{xml}");
    assert!(xml.contains("<w:position w:val=\"20\"/>"), "{xml}");
    assert!(xml.contains("<w:color w:val=\"FF0000\"/>"), "{xml}");
    for size in [f32::NAN, f32::INFINITY, 0.0, -1.0] {
        assert!(mathra::tex_to_omml_with("x", &mathra::OmmlOptions { font_size: size }).is_err());
    }
    let xml = tex_to_omml(r"x^{\mathchoice{D}{T}{S}{Q}}").unwrap();
    assert!(xml.contains(">S</m:t>"), "{xml}");
}

#[test]
fn s_omml_6_corpus_has_only_documented_format_limitations() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../corpus");
    let mut sources = Vec::new();
    for name in ["constructions.json", "packages.json"] {
        let entries: Vec<(String, String)> = serde_json::from_str(&std::fs::read_to_string(root.join(name)).unwrap()).unwrap();
        sources.extend(entries);
    }
    let reference: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(root.join("reference.json")).unwrap()).unwrap();
    for group in ["latex", "science", "asciimath", "mathml"] {
        for section in reference[group].as_array().unwrap() {
            for row in section["rows"].as_array().unwrap() {
                sources.push((section["id"].as_str().unwrap().into(), row["tex"].as_str().unwrap().into()));
            }
        }
    }
    let mut converted = 0;
    let mut unsupported = 0;
    let schema: serde_json::Value = serde_json::from_str(include_str!("fixtures/omml-sequences.json")).unwrap();
    for (name, source) in sources {
        match tex_to_omml(&source) {
            Ok(xml) => {
                let doc = Document::parse(&xml).unwrap();
                check_sequence_order(&doc, &schema, &source);
                converted += 1;
            }
            Err(OmmlError::Parse(_)) => {
                // Verify this is the parser's existing boundary, not an exporter regression.
                let mut registry = mathra::rules::Registry::default();
                assert!(mathra::input::latex::read_with(&source, mathra::Locale::En, &mut registry, true).is_err());
            }
            Err(OmmlError::Unsupported(reason)) => {
                eprintln!("OMML boundary: {name}: {reason}: {source}");
                assert!(
                    [
                        "circular enclosure (OMML has no circular border)",
                        "matrix grid rules (not available in OMML)",
                        "matrix column spanning",
                        "diagram geometry",
                        "diagram/border matrix geometry",
                        "reflected geometry",
                        "arbitrary filled rule rectangle",
                        "structural chemistry drawing",
                        "left/center overlap: OMML phantom has no overlap anchor",
                        "dashed proof rule",
                    ]
                    .contains(&reason.as_str()),
                    "undocumented boundary: {name}: {reason}"
                );
                unsupported += 1;
            }
        }
    }
    eprintln!("OMML corpus: {converted} converted; {unsupported} documented format limitations");
    assert!(converted > 400, "{converted}");
}

#[test]
fn s_omml_5_computation_and_error_boundaries() {
    for (source, answer) in [(r"\contaarmada{+}{347}{285}", "632"), (r"\contaarmada{-}{10}{15}", "−5"), (r"\contaarmada{\times}{23}{14}", "322"), (r"\divchave{247}{5}", "49")] {
        let xml = tex_to_omml(source).unwrap();
        let doc = Document::parse(&xml).unwrap();
        let text: String = doc.descendants().filter(|n| n.has_tag_name((NS, "t"))).filter_map(|n| n.text()).collect();
        assert!(text.contains(answer), "{source}: {text}");
    }
    assert!(matches!(tex_to_omml(r"\contaarmada{+}{340282366920938463463374607431768211455}{1}"), Err(OmmlError::Parse(_))));
    for source in [r"\mathllap{x}", r"\mathclap{x}", r"\textcircled{x}", r"\begin{matrix}\multicolumn{2}{c}{x}\end{matrix}", r"\rule{1em}{1em}"] {
        assert!(matches!(tex_to_omml(source), Err(OmmlError::Unsupported(_))), "{source}");
    }
}

#[test]
fn s_omml_5_cancel_phantom_and_style_properties() {
    for (source, tag, value) in [
        (r"\cancel{x}", "strikeBLTR", "1"),
        (r"\bcancel{x}", "strikeTLBR", "1"),
        (r"\smash[t]{x}", "zeroAsc", "1"),
        (r"\smash[b]{x}", "zeroDesc", "1"),
        (r"\mathrlap{x}", "zeroWid", "1"),
    ] {
        let xml = tex_to_omml(source).unwrap();
        let doc = Document::parse(&xml).unwrap();
        assert!(doc.descendants().any(|n| n.has_tag_name((NS, tag)) && n.attribute((NS, "val")) == Some(value)), "{source}: {xml}");
    }
    let xml = tex_to_omml(r"\int_0^1\,x").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let nary = doc.descendants().find(|n| n.has_tag_name((NS, "nary"))).unwrap();
    assert!(nary.children().find(|n| n.has_tag_name((NS, "e"))).unwrap().descendants().any(|n| n.text() == Some("x")));
    let xml = tex_to_omml(r"{\scriptscriptstyle \mathchoice{D}{T}{S}{Q}}").unwrap();
    assert!(xml.contains(">Q</m:t>"));
}

#[test]
fn s_omml_5_color_size_shift_and_shading_compose() {
    const W: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let xml = tex_to_omml(r"\textcolor{darkblue}{\scalebox{2}{$\raisebox{1em}{x}$}}+\colorbox{yellow}{y}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let run = doc.descendants().find(|n| n.has_tag_name((NS, "r"))).unwrap();
    for (tag, value) in [("color", "00008B"), ("sz", "48"), ("position", "48")] {
        assert!(run.descendants().any(|n| n.has_tag_name((W, tag)) && n.attribute((W, "val")) == Some(value)), "{tag}: {xml}");
    }
    assert!(doc.descendants().any(|n| n.has_tag_name((W, "shd")) && n.attribute((W, "fill")) == Some("FFFF00")));
}

fn check_sequence_order(doc: &Document<'_>, schema: &serde_json::Value, source: &str) {
    for parent in doc.descendants().filter(|n| n.is_element() && n.tag_name().namespace() == Some(NS)) {
        let name = format!("m:{}", parent.tag_name().name());
        let Some(sequence) = schema["sequences"][&name].as_array() else { continue };
        let mut previous = 0;
        for child in parent.children().filter(|n| n.is_element()) {
            let prefix = if child.tag_name().namespace() == Some(NS) { "m" } else { "w" };
            let name = format!("{prefix}:{}", child.tag_name().name());
            let position = sequence.iter().position(|s| s.as_str() == Some(&name)).unwrap_or_else(|| panic!("unexpected {name} in {}: {source}", parent.tag_name().name()));
            assert!(position >= previous, "wrong schema order for {name} in {}: {source}", parent.tag_name().name());
            previous = position;
        }
    }
}

#[test]
fn s_omml_5_explicit_fraction_and_text_styles_select_correct_choice() {
    for (source, branch) in [(r"x^{\dfrac{\mathchoice{D}{T}{S}{Q}}{2}}", "T"), (r"\text{if $\mathchoice{D}{T}{S}{Q}$}", "T"), (r"\tfrac{\mathchoice{D}{T}{S}{Q}}{2}", "S")] {
        let xml = tex_to_omml(source).unwrap();
        assert!(xml.contains(&format!(">{branch}</m:t>")), "{source}: {xml}");
    }
}

#[test]
fn s_omml_7_aligned_uses_right_left_column_pairs_without_visible_markers() {
    for (source, expected, alignment) in [
        (r"\begin{aligned}a&=b+c\\d+e&=f\end{aligned}", vec!["a=b+c", "d+e=f"], vec!["right", "left"]),
        (r"\begin{aligned}a&=b&c&=d\\e+f&=g&h&=i\end{aligned}", vec!["a=bc=d", "e+f=gh=i"], vec!["right", "left", "center", "right", "left"]),
    ] {
        let xml = tex_to_omml(source).unwrap();
        let doc = Document::parse(&xml).unwrap();
        let matrix = doc.root_element().first_element_child().unwrap();
        assert!(matrix.has_tag_name((NS, "m")));
        let rows: Vec<String> = matrix.children().filter(|n| n.has_tag_name((NS, "mr"))).map(visible_math_text).map(|s| s.replace('\u{200b}', "")).collect();
        assert_eq!(rows, expected);
        let jc: Vec<_> = matrix.descendants().filter(|n| n.has_tag_name((NS, "mcJc"))).filter_map(|n| n.attribute((NS, "val"))).collect();
        assert_eq!(jc, alignment);
        assert!(matrix.descendants().any(|n| n.has_tag_name((NS, "cGp")) && n.attribute((NS, "val")) == Some("0")));
        assert!(!xml.contains("&amp;"));
    }
    let xml = tex_to_omml(r"\begin{align}a&=b\intertext{therefore}c&=d\end{align}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let array = doc.descendants().find(|n| n.has_tag_name((NS, "eqArr"))).unwrap();
    let rows: Vec<String> = array.children().filter(|n| n.has_tag_name((NS, "e"))).map(visible_math_text).collect();
    assert_eq!(rows, ["a=b", "therefore", "c=d"]);
    let boxes: Vec<_> = array.descendants().filter(|n| n.has_tag_name((NS, "box"))).collect();
    assert_eq!(boxes.len(), 2);
    assert!(boxes.iter().all(|b| b.descendants().any(|n| n.has_tag_name((NS, "aln"))) && !visible_math_text(*b).is_empty()));
}

fn visible_math_text(node: roxmltree::Node<'_, '_>) -> String {
    node.descendants()
        .filter(|n| n.has_tag_name((NS, "t")))
        .filter(|n| {
            !n.ancestors().any(|a| {
                a.has_tag_name((NS, "phant"))
                    && a.children()
                        .filter(|p| p.has_tag_name((NS, "phantPr")))
                        .flat_map(|p| p.children())
                        .any(|p| p.has_tag_name((NS, "show")) && p.attribute((NS, "val")) == Some("0"))
            })
        })
        .filter_map(|n| n.text())
        .collect()
}

#[test]
fn s_omml_7_addition_carries_are_small_and_keep_the_digit_grid() {
    let xml = tex_to_omml(r"\contaarmada{+}{347}{285}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let stack = doc.root_element().first_element_child().unwrap();
    let rows: Vec<_> = stack.children().filter(|n| n.has_tag_name((NS, "mr"))).collect();
    assert_eq!(rows.iter().map(|n| visible_math_text(*n)).collect::<Vec<_>>(), ["11", "347", "+285", "632"]);
    let grid = rows[0].descendants().skip(1).find(|n| n.has_tag_name((NS, "mr"))).unwrap();
    let cells: Vec<_> = grid.children().filter(|n| n.has_tag_name((NS, "e"))).collect();
    assert_eq!(cells.iter().map(|n| visible_math_text(*n)).collect::<Vec<_>>(), ["", "", "1", "1", ""]);
    for (i, cell) in cells.iter().enumerate() {
        assert!(cell.descendants().any(|n| n.has_tag_name((NS, "show")) && n.attribute((NS, "val")) == Some("0")), "reserve normal digit width in every column");
        let small = cell.descendants().any(|n| n.has_tag_name((NS, "argSz")) && n.attribute((NS, "val")) == Some("-1"));
        assert_eq!(small, matches!(i, 2 | 3));
    }
    let xml = tex_to_omml(r"\contaarmada{+}{12}{23}").unwrap();
    let doc = Document::parse(&xml).unwrap();
    let stack = doc.root_element().first_element_child().unwrap();
    assert_eq!(stack.children().filter(|n| n.has_tag_name((NS, "mr"))).count(), 3, "no unnecessary carry row");
}

#[test]
fn s_omml_7_long_division_shows_brought_down_digits_in_the_next_column() {
    for (source, expected) in [
        (r"\divchave{247}{5}", vec!["247", "−20", "47", "−45", "2"]),
        (r"\divchave{1005}{5}", vec!["1005", "−10", "0", "−0", "5", "−5", "0"]),
        (r"\divchave{3}{5}", vec!["3", "−0", "3"]),
        (r"\divchave{250}{5}", vec!["250", "−25", "0", "−0", "0"]),
    ] {
        let xml = tex_to_omml(source).unwrap();
        let doc = Document::parse(&xml).unwrap();
        let outer = doc.root_element().first_element_child().unwrap();
        let left = outer.children().find(|n| n.has_tag_name((NS, "mr"))).unwrap().first_element_child().unwrap().first_element_child().unwrap();
        let rows: Vec<_> = left.children().filter(|n| n.has_tag_name((NS, "mr"))).collect();
        assert_eq!(rows.iter().map(|n| visible_math_text(*n)).collect::<Vec<_>>(), expected, "{source}");
        if source.contains("247") {
            let grid = rows[2].descendants().skip(1).find(|n| n.has_tag_name((NS, "mr"))).unwrap();
            assert_eq!(grid.children().filter(|n| n.has_tag_name((NS, "e"))).map(visible_math_text).collect::<Vec<_>>(), ["", "", "4", "7"]);
        }
    }
}
