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
