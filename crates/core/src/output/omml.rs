//! Native, editable Office Math fragments (S-OMML-1); no document or rendering dependency.
use crate::tree::{Node, TableKind, TextPart, Variant};
use std::fmt;

pub const NAMESPACE: &str = "http://schemas.openxmlformats.org/officeDocument/2006/math";

#[derive(Debug, Clone, PartialEq)]
pub enum OmmlError {
    Parse(crate::Error),
    /// A construction whose appearance cannot be preserved by this writer.
    Unsupported(String),
}
impl fmt::Display for OmmlError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Parse(e) => e.fmt(f),
            Self::Unsupported(kind) => write!(f, "unsupported OMML construction: {kind}"),
        }
    }
}
impl std::error::Error for OmmlError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Parse(e) => Some(e),
            _ => None,
        }
    }
}
impl From<crate::Error> for OmmlError {
    fn from(e: crate::Error) -> Self {
        Self::Parse(e)
    }
}

/// Serialize an existing tree as a self-contained `<m:oMath>` XML fragment.
/// Unsupported presentation constructs return an error instead of losing content.
pub fn generate(tree: &Node) -> Result<String, OmmlError> {
    Ok(format!("<m:oMath xmlns:m=\"{NAMESPACE}\">{}</m:oMath>", write(tree, true)?))
}

fn xml(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '&' => "&amp;".into(),
            '<' => "&lt;".into(),
            '>' => "&gt;".into(),
            '"' => "&quot;".into(),
            '\'' => "&apos;".into(),
            '\t' | '\n' | '\r' => c.to_string(),
            c if c < ' ' || c == '\u{fffe}' || c == '\u{ffff}' => "�".into(),
            c => c.to_string(),
        })
        .collect()
}
fn run(s: &str, variant: Variant) -> String {
    let (script, style) = match variant {
        Variant::Italic => ("roman", "i"),
        Variant::Upright => ("roman", "p"),
        Variant::Bold => ("roman", "b"),
        Variant::BoldItalic => ("roman", "bi"),
        Variant::DoubleStruck => ("double-struck", "p"),
        Variant::Calligraphic => ("script", "p"),
        Variant::Fraktur => ("fraktur", "p"),
        Variant::SansSerif => ("sans-serif", "p"),
        Variant::SansSerifItalic => ("sans-serif", "i"),
        Variant::Monospace => ("monospace", "p"),
    };
    format!("<m:r><m:rPr><m:scr m:val=\"{script}\"/><m:sty m:val=\"{style}\"/></m:rPr><m:t xml:space=\"preserve\">{}</m:t></m:r>", xml(s))
}
fn arg(tag: &str, node: &Node, display: bool) -> Result<String, OmmlError> {
    Ok(format!("<m:{tag}>{}</m:{tag}>", write(node, display)?))
}
fn optional(tag: &str, node: Option<&Node>) -> Result<String, OmmlError> {
    Ok(format!("<m:{tag}>{}</m:{tag}>", node.map(|n| write(n, false)).transpose()?.unwrap_or_default()))
}
fn limits(base: String, above: Option<&Node>, below: Option<&Node>) -> Result<String, OmmlError> {
    let mut result = base;
    if let Some(n) = below {
        result = format!("<m:limLow><m:e>{result}</m:e>{}</m:limLow>", arg("lim", n, false)?);
    }
    if let Some(n) = above {
        result = format!("<m:limUpp><m:e>{result}</m:e>{}</m:limUpp>", arg("lim", n, false)?);
    }
    Ok(result)
}
fn delimiter(open: Option<char>, close: Option<char>, body: String) -> String {
    format!(
        "<m:d><m:dPr><m:begChr m:val=\"{}\"/><m:endChr m:val=\"{}\"/></m:dPr><m:e>{body}</m:e></m:d>",
        xml(&open.map(|c| c.to_string()).unwrap_or_default()),
        xml(&close.map(|c| c.to_string()).unwrap_or_default())
    )
}
fn write(node: &Node, display: bool) -> Result<String, OmmlError> {
    use Node::*;
    Ok(match node {
        Number { value, thousands, .. } => run(&super::written_number(value, *thousands, crate::Locale::En), Variant::Upright),
        Identifier { name, variant } => run(name, *variant),
        Function { name, .. } => run(name, Variant::Upright),
        Operator { symbol, .. } | FixedDelimiter { symbol, .. } => run(&symbol.to_string(), Variant::Upright),
        LargeOperator { .. } => nary(node, None, None, display, "")?,
        Row { children } => {
            let mut result = String::new();
            let mut iter = children.iter().peekable();
            while let Some(child) = iter.next() {
                let large = matches!(child.single(), LargeOperator { .. }) || matches!(child.single(), Scripts { base, .. } if matches!(base.single(), LargeOperator { .. }));
                let mut operand = String::new();
                // The semantic tree stores the operator and its operand as neighbors.
                // Put the next atom inside nary's e so Word has no empty placeholder.
                if large {
                    if let Some(next) = iter.peek() {
                        if !matches!(next.single(), Operator { class: crate::Class::Rel | crate::Class::Bin | crate::Class::Punct, .. }) {
                            operand = write(iter.next().expect("peeked operand"), display)?;
                        }
                    }
                }
                let part = match child.single() {
                    LargeOperator { .. } => nary(child.single(), None, None, display, &operand)?,
                    Scripts { base, sup, sub } if large => nary(base.single(), sup.as_deref(), sub.as_deref(), display, &operand)?,
                    _ => write(child, display)?,
                };
                result.push_str(&part);
            }
            result
        }
        Fraction { num, den, rule, .. } => {
            format!("<m:f><m:fPr><m:type m:val=\"{}\"/></m:fPr>{}{}</m:f>", if *rule { "bar" } else { "noBar" }, arg("num", num, false)?, arg("den", den, false)?)
        }
        Root { radicand, index } => format!(
            "<m:rad><m:radPr><m:degHide m:val=\"{}\"/></m:radPr>{}{}</m:rad>",
            if index.is_none() { "1" } else { "0" },
            optional("deg", index.as_deref())?,
            arg("e", radicand, display)?
        ),
        Scripts { base, sup, sub } => match base.single() {
            LargeOperator { .. } => nary(base.single(), sup.as_deref(), sub.as_deref(), display, "")?,
            Function { limits: true, .. } if display => limits(write(base, display)?, sup.as_deref(), sub.as_deref())?,
            _ => {
                let tag = match (sub.is_some(), sup.is_some()) {
                    (true, true) => "sSubSup",
                    (true, false) => "sSub",
                    (false, true) => "sSup",
                    _ => return write(base, display),
                };
                let mut s = format!("<m:{tag}>{}", arg("e", base, display)?);
                if let Some(n) = sub {
                    s.push_str(&arg("sub", n, false)?);
                }
                if let Some(n) = sup {
                    s.push_str(&arg("sup", n, false)?);
                }
                format!("{s}</m:{tag}>")
            }
        },
        Delimited { open, close, parts, middles } => {
            let mut body = String::new();
            for (i, part) in parts.iter().enumerate() {
                if i > 0 {
                    if let Some(c) = middles.get(i - 1) {
                        body.push_str(&run(&c.to_string(), Variant::Upright));
                    }
                }
                body.push_str(&write(part, display)?);
            }
            delimiter(*open, *close, body)
        }
        Table { shape, rows, verticals, dashed, horizontals, between, intertexts, .. } => {
            if !verticals.is_empty() || !dashed.is_empty() || !horizontals.is_empty() || !between.is_empty() || !intertexts.is_empty() {
                return Err(OmmlError::Unsupported("table rules, insertions or intertext".into()));
            }
            let count = rows.iter().map(Vec::len).max().unwrap_or(0);
            let mut body = String::from("<m:m>");
            for row in rows {
                body.push_str("<m:mr>");
                for col in 0..count {
                    body.push_str(&optional("e", row.get(col))?);
                }
                body.push_str("</m:mr>");
            }
            body.push_str("</m:m>");
            let pair = match shape {
                TableKind::PMatrix => Some((Some('('), Some(')'))),
                TableKind::BMatrix => Some((Some('['), Some(']'))),
                TableKind::BraceMatrix => Some((Some('{'), Some('}'))),
                TableKind::VMatrix => Some((Some('|'), Some('|'))),
                TableKind::VVMatrix => Some((Some('‖'), Some('‖'))),
                TableKind::Cases => Some((Some('{'), None)),
                TableKind::RCases => Some((None, Some('}'))),
                TableKind::Diagram | TableKind::BorderMatrix => return Err(OmmlError::Unsupported("diagram or border matrix".into())),
                _ => None,
            };
            pair.map(|(o, c)| delimiter(o, c, body.clone())).unwrap_or(body)
        }
        Text { parts } => parts
            .iter()
            .map(|p| match p {
                TextPart::Text(s) => Ok(run(s, Variant::Upright)),
                TextPart::Math(n) => write(n, display),
            })
            .collect::<Result<String, _>>()?,
        Space { em } if *em >= 0.0 => run(&"\u{2005}".repeat((em * 4.0).round().clamp(0.0, 4096.0) as usize), Variant::Upright),
        Bar { base, above } => format!("<m:bar><m:barPr><m:pos m:val=\"{}\"/></m:barPr>{}</m:bar>", if *above { "top" } else { "bot" }, arg("e", base, display)?),
        Accent { base, accent, below: false, .. } => format!("<m:acc><m:accPr><m:chr m:val=\"{}\"/></m:accPr>{}</m:acc>", xml(&accent.to_string()), arg("e", base, display)?),
        Stacked { base, above, below } => limits(write(base, display)?, above.as_deref(), below.as_deref())?,
        Arrow { symbol, above, below } => limits(run(&symbol.to_string(), Variant::Upright), above.as_deref(), below.as_deref())?,
        Framed { base, shape: crate::tree::Frame::Rectangle, background: None, border: None } => format!("<m:borderBox>{}</m:borderBox>", arg("e", base, display)?),
        Brace { base, above, label, bracket } => {
            let chr = match (*above, *bracket) {
                (true, false) => '⏞',
                (false, false) => '⏟',
                (true, true) => '⎴',
                (false, true) => '⎵',
            };
            let group = format!(
                "<m:groupChr><m:groupChrPr><m:chr m:val=\"{chr}\"/><m:pos m:val=\"{}\"/><m:vertJc m:val=\"{}\"/></m:groupChrPr>{}</m:groupChr>",
                if *above { "top" } else { "bot" },
                if *above { "bot" } else { "top" },
                arg("e", base, display)?
            );
            limits(group, if *above { label.as_deref() } else { None }, if *above { None } else { label.as_deref() })?
        }
        Phantom { base, width, height } => format!(
            "<m:phant><m:phantPr><m:show m:val=\"0\"/><m:zeroWid m:val=\"{}\"/><m:zeroAsc m:val=\"{}\"/><m:zeroDesc m:val=\"{}\"/></m:phantPr>{}</m:phant>",
            u8::from(!width),
            u8::from(!height),
            u8::from(!height),
            arg("e", base, display)?
        ),
        ForcedClass { base, .. } => write(base, display)?,
        Style { level, base } => write(base, *level == 0)?,
        Choice { branches } => branches.get(if display { 0 } else { 1 }).map(|n| write(n, display)).transpose()?.unwrap_or_default(),
        _ => {
            let kind = node.to_json();
            let kind: serde_json::Value = serde_json::from_str(&kind).expect("serialized node");
            return Err(OmmlError::Unsupported(kind["type"].as_str().unwrap_or("unknown").into()));
        }
    })
}
fn nary(base: &Node, sup: Option<&Node>, sub: Option<&Node>, display: bool, operand: &str) -> Result<String, OmmlError> {
    let Node::LargeOperator { symbol, limits } = base else { unreachable!() };
    let under = limits.unwrap_or(display && !matches!(*symbol, '∫' | '∬' | '∭' | '∮' | '∯' | '∰'));
    Ok(format!(
        "<m:nary><m:naryPr><m:chr m:val=\"{}\"/><m:limLoc m:val=\"{}\"/><m:subHide m:val=\"{}\"/><m:supHide m:val=\"{}\"/></m:naryPr>{}{}<m:e>{operand}</m:e></m:nary>",
        xml(&symbol.to_string()),
        if under { "undOvr" } else { "subSup" },
        if sub.is_none() { "1" } else { "0" },
        if sup.is_none() { "1" } else { "0" },
        optional("sub", sub)?,
        optional("sup", sup)?
    ))
}
