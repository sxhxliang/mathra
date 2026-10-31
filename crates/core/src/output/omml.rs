//! Native, editable Office Math fragments (S-OMML-1); no document or rendering dependency.
use crate::tree::{Cancel, FractionStyle, Frame, Node, ProofBranch, ProofLine, TableKind, TextPart, Variant};
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

/// Reference size for em-based dimensions. Match this to the destination math font size.
#[derive(Debug, Clone, Copy)]
pub struct OmmlOptions {
    pub font_size: f32,
}
impl Default for OmmlOptions {
    fn default() -> Self {
        Self { font_size: 12.0 }
    }
}

/// Serialize an existing tree as a self-contained `<m:oMath>` XML fragment.
pub fn generate(tree: &Node) -> Result<String, OmmlError> {
    generate_with(tree, &OmmlOptions::default())
}

/// Like [`generate`], with the destination font size in points for explicit TeX dimensions.
pub fn generate_with(tree: &Node, options: &OmmlOptions) -> Result<String, OmmlError> {
    if !options.font_size.is_finite() || !(1.0..=1638.0).contains(&options.font_size) {
        return Err(OmmlError::Unsupported("font size must be finite and in 1–1638 pt".into()));
    }
    let body = Writer { font_size: options.font_size, level: 0 }.write(tree, true)?;
    let word_ns = if body.contains("<w:") { format!(" xmlns:w=\"{WORD_NAMESPACE}\"") } else { String::new() };
    Ok(merge_runs(&format!("<m:oMath xmlns:m=\"{NAMESPACE}\"{word_ns}>{body}</m:oMath>")))
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
struct Writer {
    font_size: f32,
    level: u8,
}

impl Writer {
    fn run(&self, s: &str, variant: Variant) -> String {
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
    fn argument_writer(&self, tag: &str, display: bool) -> Self {
        let level = match tag {
            "sub" | "sup" | "lim" => (self.level.max(1) + 1).min(3),
            "deg" => 3,
            "num" | "den" => {
                if display {
                    1
                } else {
                    (self.level.max(1) + 1).min(3)
                }
            }
            _ => {
                if display {
                    self.level
                } else {
                    self.level.max(1)
                }
            }
        };
        Self { level, ..*self }
    }
    fn arg(&self, tag: &str, node: &Node, display: bool) -> Result<String, OmmlError> {
        let writer = self.argument_writer(tag, display);
        Ok(format!("<m:{tag}>{}</m:{tag}>", writer.write(node, display && writer.level == 0)?))
    }
    fn optional(&self, tag: &str, node: Option<&Node>) -> Result<String, OmmlError> {
        match node {
            Some(n) => self.arg(tag, n, false),
            None => Ok(format!("<m:{tag}/>")),
        }
    }
    fn limits(&self, base: String, above: Option<&Node>, below: Option<&Node>) -> Result<String, OmmlError> {
        let mut result = base;
        if let Some(n) = below {
            result = format!("<m:limLow><m:e>{result}</m:e>{}</m:limLow>", self.arg("lim", n, false)?);
        }
        if let Some(n) = above {
            result = format!("<m:limUpp><m:e>{result}</m:e>{}</m:limUpp>", self.arg("lim", n, false)?);
        }
        Ok(result)
    }
    fn delimiter(&self, open: Option<char>, close: Option<char>, body: String) -> String {
        format!(
            "<m:d><m:dPr><m:begChr m:val=\"{}\"/><m:endChr m:val=\"{}\"/></m:dPr><m:e>{body}</m:e></m:d>",
            xml(&open.map(|c| c.to_string()).unwrap_or_default()),
            xml(&close.map(|c| c.to_string()).unwrap_or_default())
        )
    }
    fn write(&self, node: &Node, display: bool) -> Result<String, OmmlError> {
        use Node::*;
        Ok(match node {
            Number { value, thousands, .. } => self.run(&super::written_number(value, *thousands, crate::Locale::En), Variant::Upright),
            Identifier { name, variant } => self.run(name, *variant),
            Function { name, .. } => self.run(name, Variant::Upright),
            Operator { symbol, .. } => self.run(&symbol.to_string(), Variant::Upright),
            FixedDelimiter { symbol, size, .. } => {
                word_property(&self.run(&symbol.to_string(), Variant::Upright), "sz", &half_points(self.font_size * (1.0 + f32::from(*size) * 0.4)).to_string(), false)
            }
            LargeOperator { .. } => self.nary(node, None, None, display, "")?,
            Row { children } => {
                let mut result = String::new();
                let mut iter = children.iter().peekable();
                while let Some(child) = iter.next() {
                    if let Scripts { base, sup, sub } = child.single() {
                        if is_empty(base)
                            && iter
                                .peek()
                                .is_some_and(|n| !matches!(n.single(), Operator { class: crate::Class::Rel | crate::Class::Bin | crate::Class::Punct, .. } | Space { .. }))
                        {
                            let next = iter.next().expect("peeked prescript base");
                            result.push_str(&format!(
                                "<m:sPre>{}{}{}</m:sPre>",
                                self.optional("sub", sub.as_deref())?,
                                self.optional("sup", sup.as_deref())?,
                                self.arg("e", next, display)?
                            ));
                            continue;
                        }
                    }
                    let function = matches!(child.single(), Function { .. }) || matches!(child.single(), Scripts { base, .. } if matches!(base.single(), Function { .. }));
                    if function
                        && iter.peek().is_some_and(|n| !matches!(n.single(), Operator { class: crate::Class::Rel | crate::Class::Bin | crate::Class::Punct, .. } | Space { .. }))
                    {
                        let next = iter.next().expect("peeked function argument");
                        result.push_str(&format!("<m:func><m:fName>{}</m:fName>{}</m:func>", self.write(child, display)?, self.arg("e", next, display)?));
                        continue;
                    }
                    let large = matches!(child.single(), LargeOperator { .. }) || matches!(child.single(), Scripts { base, .. } if matches!(base.single(), LargeOperator { .. }));
                    let mut operand = String::new();
                    // The semantic tree stores the operator and its operand as neighbors.
                    // Put the next atom inside nary's e so Word has no empty placeholder.
                    if large {
                        while iter.peek().is_some_and(|n| matches!(n.single(), Space { .. })) {
                            operand.push_str(&self.write(iter.next().expect("peeked space"), display)?);
                        }
                        if let Some(next) = iter.peek() {
                            if !matches!(next.single(), Operator { class: crate::Class::Rel | crate::Class::Bin | crate::Class::Punct, .. }) {
                                operand.push_str(&self.write(iter.next().expect("peeked operand"), display)?);
                            }
                        }
                    }
                    let part = match child.single() {
                        LargeOperator { .. } => self.nary(child.single(), None, None, display, &operand)?,
                        Scripts { base, sup, sub } if large => self.nary(base.single(), sup.as_deref(), sub.as_deref(), display, &operand)?,
                        _ => self.write(child, display)?,
                    };
                    result.push_str(&part);
                }
                result
            }
            Fraction { num, den, rule, style, thickness } => {
                let (level, fraction_display) = match style {
                    FractionStyle::Display => (0, true),
                    FractionStyle::Row => (1, false),
                    FractionStyle::Auto => (self.level, display),
                };
                let writer = Self { level, ..*self };
                let fraction = format!(
                    "<m:f><m:fPr><m:type m:val=\"{}\"/></m:fPr>{}{}</m:f>",
                    if *rule && *thickness != Some(0.0) { "bar" } else { "noBar" },
                    writer.arg("num", num, fraction_display)?,
                    writer.arg("den", den, fraction_display)?
                );
                match style {
                    FractionStyle::Auto => fraction,
                    FractionStyle::Display => sized_box(fraction, i32::from(self.level.max(1)) - 1),
                    FractionStyle::Row => sized_box(fraction, i32::from(self.level.max(1)) - 2),
                }
            }
            Root { radicand, index } => format!(
                "<m:rad><m:radPr><m:degHide m:val=\"{}\"/></m:radPr>{}{}</m:rad>",
                if index.is_none() { "1" } else { "0" },
                self.optional("deg", index.as_deref())?,
                self.arg("e", radicand, display)?
            ),
            Scripts { base, sup, sub } => match base.single() {
                LargeOperator { .. } => self.nary(base.single(), sup.as_deref(), sub.as_deref(), display, "")?,
                Function { limits: true, .. } if display => self.limits(self.write(base, display)?, sup.as_deref(), sub.as_deref())?,
                _ => {
                    let tag = match (sub.is_some(), sup.is_some()) {
                        (true, true) => "sSubSup",
                        (true, false) => "sSub",
                        (false, true) => "sSup",
                        _ => return self.write(base, display),
                    };
                    let mut s = format!("<m:{tag}>{}", self.arg("e", base, display)?);
                    if let Some(n) = sub {
                        s.push_str(&self.arg("sub", n, false)?);
                    }
                    if let Some(n) = sup {
                        s.push_str(&self.arg("sup", n, false)?);
                    }
                    format!("{s}</m:{tag}>")
                }
            },
            Delimited { open, close, parts, middles } => {
                if !middles.is_empty() && middles.iter().all(|c| *c == middles[0]) {
                    let mut body = format!(
                        "<m:d><m:dPr><m:begChr m:val=\"{}\"/><m:sepChr m:val=\"{}\"/><m:endChr m:val=\"{}\"/></m:dPr>",
                        xml(&open.map(|c| c.to_string()).unwrap_or_default()),
                        xml(&middles[0].to_string()),
                        xml(&close.map(|c| c.to_string()).unwrap_or_default())
                    );
                    for part in parts {
                        body.push_str(&self.arg("e", part, display)?);
                    }
                    body.push_str("</m:d>");
                    return Ok(body);
                }
                let mut body = String::new();
                for (i, part) in parts.iter().enumerate() {
                    if i > 0 {
                        if let Some(c) = middles.get(i - 1) {
                            body.push_str(&self.run(&c.to_string(), Variant::Upright));
                        }
                    }
                    body.push_str(&self.write(part, display)?);
                }
                self.delimiter(*open, *close, body)
            }
            Table { shape, rows, columns, verticals, dashed, horizontals, between, intertexts, stretch } => {
                if !verticals.is_empty() || !dashed.is_empty() || !horizontals.is_empty() {
                    return Err(OmmlError::Unsupported("matrix grid rules (not available in OMML)".into()));
                }
                self.table(*shape, rows, columns, between, intertexts, *stretch, display)?
            }
            Text { parts } => parts
                .iter()
                .map(|p| match p {
                    TextPart::Text(s) => Ok(self.run(s, Variant::Upright)),
                    TextPart::Math(n) => Self { level: self.level.max(1), ..*self }.write(n, false),
                })
                .collect::<Result<String, _>>()?,
            // Zero spaces are parser boundaries, not visible math atoms. A
            // zero-width glyph run can acquire Word's inter-atom spacing.
            Space { em } if *em == 0.0 => String::new(),
            // mhchem coefficients use 1/9 em: use an actual hair space rather
            // than a separately formatted zero-width atom with character spacing.
            Space { em } if *em > 0.0 && *em <= 0.125 => self.run("\u{200a}", Variant::Upright),
            // Quantity value/unit separation and \, are 1/6 em. Native thin
            // spaces keep them in the same upright run, without a phantom atom.
            Space { em } if *em > 0.0 && *em <= 0.2 => self.run("\u{2009}", Variant::Upright),
            Space { em } => {
                word_property(&self.run("\u{200b}", Variant::Upright), "spacing", &((*em * self.font_size * 20.0).round().clamp(-31680.0, 31680.0) as i32).to_string(), false)
            }
            Bar { base, above } => format!("<m:bar><m:barPr><m:pos m:val=\"{}\"/></m:barPr>{}</m:bar>", if *above { "top" } else { "bot" }, self.arg("e", base, display)?),
            Accent { base, accent, below: false, .. } => {
                format!("<m:acc><m:accPr><m:chr m:val=\"{}\"/></m:accPr>{}</m:acc>", xml(&accent.to_string()), self.arg("e", base, display)?)
            }
            Accent { base, accent, below: true, .. } => format!(
                "<m:groupChr><m:groupChrPr><m:chr m:val=\"{}\"/><m:pos m:val=\"bot\"/><m:vertJc m:val=\"top\"/></m:groupChrPr>{}</m:groupChr>",
                xml(&accent.to_string()),
                self.arg("e", base, display)?
            ),
            Colored { color, base } => colorize(&self.write(base, display)?, &office_color(color)?),
            Stacked { base, above, below } => self.limits(self.write(base, display)?, above.as_deref(), below.as_deref())?,
            Arrow { symbol, above, below } => {
                let (label, position, justification) = if let Some(label) = above { (Some(label), "bot", "top") } else { (below.as_ref(), "top", "bot") };
                if let Some(label) = label {
                    let arrow = format!("<m:groupChr><m:groupChrPr><m:chr m:val=\"{}\"/><m:pos m:val=\"{position}\"/><m:vertJc m:val=\"{justification}\"/></m:groupChrPr><m:e>{}</m:e></m:groupChr>", xml(&symbol.to_string()), sized_box(self.write(label, false)?, -1));
                    self.limits(arrow, None, if above.is_some() { below.as_deref() } else { None })?
                } else {
                    self.run(&symbol.to_string(), Variant::Upright)
                }
            }
            Canceled { base, shape } => {
                let strikes = match shape {
                    Cancel::Bar | Cancel::Slash => "<m:strikeBLTR m:val=\"1\"/>",
                    Cancel::Backslash => "<m:strikeTLBR m:val=\"1\"/>",
                    Cancel::X => "<m:strikeBLTR m:val=\"1\"/><m:strikeTLBR m:val=\"1\"/>",
                };
                format!("<m:borderBox><m:borderBoxPr><m:hideTop m:val=\"1\"/><m:hideBot m:val=\"1\"/><m:hideLeft m:val=\"1\"/><m:hideRight m:val=\"1\"/>{strikes}</m:borderBoxPr>{}</m:borderBox>", self.arg("e", base, display)?)
            }
            Framed { base, shape, background, border } => {
                let hidden = match shape {
                    Frame::Rectangle => "",
                    Frame::Phase => "<m:hideTop m:val=\"1\"/><m:hideRight m:val=\"1\"/>",
                    Frame::ActuarialAngle => "<m:hideBot m:val=\"1\"/><m:hideLeft m:val=\"1\"/>",
                    Frame::Fill | Frame::Background => "<m:hideTop m:val=\"1\"/><m:hideBot m:val=\"1\"/><m:hideLeft m:val=\"1\"/><m:hideRight m:val=\"1\"/>",
                    Frame::Circle => return Err(OmmlError::Unsupported("circular enclosure (OMML has no circular border)".into())),
                };
                let mut body = self.write(base, display)?;
                if let Some(color) = background {
                    body = word_property(&body, "shd", &office_color(color)?, false);
                }
                let control = border
                    .as_ref()
                    .map(|color| office_color(color).map(|c| format!("<m:ctrlPr><w:rPr><w:color w:val=\"{c}\"/></w:rPr></m:ctrlPr>")))
                    .transpose()?
                    .unwrap_or_default();
                format!("<m:borderBox><m:borderBoxPr>{hidden}{control}</m:borderBoxPr><m:e>{body}</m:e></m:borderBox>")
            }
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
                    self.arg("e", base, display)?
                );
                self.limits(group, if *above { label.as_deref() } else { None }, if *above { None } else { label.as_deref() })?
            }
            Phantom { base, width, height } => format!(
                "<m:phant><m:phantPr><m:show m:val=\"0\"/><m:zeroWid m:val=\"{}\"/><m:zeroAsc m:val=\"{}\"/><m:zeroDesc m:val=\"{}\"/></m:phantPr>{}</m:phant>",
                u8::from(!width),
                u8::from(!height),
                u8::from(!height),
                self.arg("e", base, display)?
            ),
            ForcedClass { base, .. } => self.write(base, display)?,
            Style { level, base } => {
                let writer = Self { level: *level, ..*self };
                sized_box(writer.write(base, *level == 0)?, (i32::from(self.level.max(1)) - i32::from((*level).max(1))).clamp(-2, 2))
            }
            // Quantity.unit already contains the value and thin space; value is speech metadata.
            Quantity { unit, .. } | Unit { base: unit, .. } => self.write(unit, display)?,
            Raised { em, base, .. } => word_property(&self.write(base, display)?, "position", &((*em * self.font_size * 2.0).round().clamp(-3168.0, 3168.0) as i32).to_string(), true),
            Scaled { factor, vertical, base } => {
                if vertical.is_some() {
                    return Err(OmmlError::Unsupported("anisotropic scale".into()));
                }
                let size = self.font_size * factor;
                if !size.is_finite() || size <= 0.0 {
                    return Err(OmmlError::Unsupported("nonpositive scale".into()));
                }
                let body = Self { font_size: size, ..*self }.write(base, display)?;
                word_property(&body, "sz", &half_points(size).to_string(), false)
            }
            Smashed { base, height, depth } => format!(
                "<m:phant><m:phantPr><m:show m:val=\"1\"/><m:zeroAsc m:val=\"{}\"/><m:zeroDesc m:val=\"{}\"/></m:phantPr>{}</m:phant>",
                u8::from(*height),
                u8::from(*depth),
                self.arg("e", base, display)?
            ),
            Overlapped { base, side } => {
                if *side != 'r' {
                    return Err(OmmlError::Unsupported("left/center overlap: OMML phantom has no overlap anchor".into()));
                }
                format!("<m:phant><m:phantPr><m:show m:val=\"1\"/><m:zeroWid m:val=\"1\"/></m:phantPr>{}</m:phant>", self.arg("e", base, display)?)
            }
            VCenter { base } => format!("<m:m><m:mPr><m:baseJc m:val=\"center\"/></m:mPr><m:mr>{}</m:mr></m:m>", self.arg("e", base, display)?),
            ProofTree { tree } => self.proof(tree, display)?,
            Choice { branches } => branches.get(if display { 0 } else { self.level.clamp(1, 3) as usize }).map(|n| self.write(n, display)).transpose()?.unwrap_or_default(),
            Rule { .. } => return Err(OmmlError::Unsupported("arbitrary filled rule rectangle".into())),
            Reflected { .. } => return Err(OmmlError::Unsupported("reflected geometry".into())),
            Resized { .. } => return Err(OmmlError::Unsupported("resized geometry".into())),
            Rotated { .. } => return Err(OmmlError::Unsupported("rotated geometry".into())),
            Multicolumn { .. } => return Err(OmmlError::Unsupported("matrix column spanning".into())),
            VerticalArrow { .. } | ArrowDiagram { .. } => return Err(OmmlError::Unsupported("diagram geometry".into())),
            ColumnArithmetic { operation, terms } => self.column_arithmetic(*operation, terms)?,
            LongDivision { dividend, divisor } => self.long_division(dividend, divisor)?,
            #[cfg(feature = "chem")]
            Chemistry { .. } => return Err(OmmlError::Unsupported("structural chemistry drawing".into())),
        })
    }
    fn nary(&self, base: &Node, sup: Option<&Node>, sub: Option<&Node>, display: bool, operand: &str) -> Result<String, OmmlError> {
        let Node::LargeOperator { symbol, limits } = base else { unreachable!() };
        let under = limits.unwrap_or(display && !crate::layout::is_integral(*symbol));
        Ok(format!(
            "<m:nary><m:naryPr><m:chr m:val=\"{}\"/><m:limLoc m:val=\"{}\"/><m:subHide m:val=\"{}\"/><m:supHide m:val=\"{}\"/></m:naryPr>{}{}<m:e>{operand}</m:e></m:nary>",
            xml(&symbol.to_string()),
            if under { "undOvr" } else { "subSup" },
            if sub.is_none() { "1" } else { "0" },
            if sup.is_none() { "1" } else { "0" },
            self.optional("sub", sub)?,
            self.optional("sup", sup)?
        ))
    }

    #[allow(clippy::too_many_arguments)]
    fn table(
        &self,
        shape: TableKind,
        rows: &[Vec<Node>],
        columns: &[char],
        between: &[(usize, Node)],
        intertexts: &[usize],
        stretch: f32,
        display: bool,
    ) -> Result<String, OmmlError> {
        if matches!(shape, TableKind::Diagram | TableKind::BorderMatrix) {
            return Err(OmmlError::Unsupported("diagram/border matrix geometry".into()));
        }
        let row_spacing = format!("<m:rSpRule m:val=\"4\"/><m:rSp m:val=\"{}\"/>", (stretch * 2.0).round().clamp(0.0, 65535.0) as u32);
        if matches!(shape, TableKind::Centered) || !intertexts.is_empty() {
            let mut body = format!("<m:eqArr><m:eqArrPr><m:baseJc m:val=\"center\"/>{row_spacing}</m:eqArrPr>");
            for (i, row) in rows.iter().enumerate() {
                body.push_str("<m:e>");
                for (j, cell) in row.iter().enumerate() {
                    for (_, insertion) in between.iter().filter(|(boundary, _)| *boundary == j) {
                        body.push_str(&self.write(insertion, display)?);
                    }
                    let cell = self.write(cell, display)?;
                    let align = !intertexts.contains(&i) && ((shape == TableKind::Aligned && j > 0) || (shape == TableKind::Substack && j == 0 && columns.first() == Some(&'l')));
                    if align {
                        body.push_str(&format!("<m:box><m:boxPr><m:aln/></m:boxPr><m:e>{cell}</m:e></m:box>"));
                    } else {
                        body.push_str(&cell);
                    }
                }
                for (_, insertion) in between.iter().filter(|(boundary, _)| *boundary == row.len()) {
                    body.push_str(&self.write(insertion, display)?);
                }
                body.push_str("</m:e>");
            }
            body.push_str("</m:eqArr>");
            return Ok(body);
        }
        // Explicit right/left column pairs make aligned's alignment geometric,
        // without depending on a renderer interpreting empty alignment runs.
        let mut aligned_between = between.to_vec();
        if shape == TableKind::Aligned {
            let count = rows.iter().map(Vec::len).max().unwrap_or(0);
            for boundary in (2..count).step_by(2) {
                aligned_between.push((boundary, Node::Space { em: 1.0 }));
            }
        }
        let between = aligned_between.as_slice();
        let count = rows.iter().map(Vec::len).max().unwrap_or(0).max(columns.len()).max(1);
        let mut alignment = Vec::new();
        for j in 0..count {
            alignment.extend(between.iter().filter(|(boundary, _)| *boundary == j).map(|_| 'c'));
            alignment.push(if shape == TableKind::Aligned {
                if j % 2 == 0 {
                    'r'
                } else {
                    'l'
                }
            } else if matches!(shape, TableKind::Cases | TableKind::RCases) {
                'l'
            } else {
                columns.get(j).copied().unwrap_or('c')
            });
        }
        alignment.extend(between.iter().filter(|(boundary, _)| *boundary == count).map(|_| 'c'));
        let cols: String = alignment
            .into_iter()
            .map(|a| {
                format!(
                    "<m:mc><m:mcPr><m:count m:val=\"1\"/><m:mcJc m:val=\"{}\"/></m:mcPr></m:mc>",
                    match a {
                        'l' => "left",
                        'r' => "right",
                        _ => "center",
                    }
                )
            })
            .collect();
        let spacing = if shape == TableKind::Aligned {
            let row_spacing = row_spacing.replacen("<m:rSp ", "<m:cGpRule m:val=\"3\"/><m:rSp ", 1);
            format!("{row_spacing}<m:cGp m:val=\"0\"/>")
        } else {
            row_spacing
        };
        let mut body = format!("<m:m><m:mPr><m:plcHide m:val=\"1\"/>{spacing}<m:mcs>{cols}</m:mcs></m:mPr>");
        for row in rows {
            body.push_str("<m:mr>");
            for j in 0..count {
                for (_, insertion) in between.iter().filter(|(boundary, _)| *boundary == j) {
                    body.push_str(&self.arg("e", insertion, display)?);
                }
                body.push_str(&match row.get(j) {
                    Some(cell) => self.arg("e", cell, shape == TableKind::Aligned && display)?,
                    None => "<m:e/>".into(),
                });
            }
            for (_, insertion) in between.iter().filter(|(boundary, _)| *boundary == count) {
                body.push_str(&self.arg("e", insertion, display)?);
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
            _ => None,
        };
        if let Some((o, c)) = pair {
            body = self.delimiter(o, c, body);
        }
        Ok(if shape == TableKind::SmallMatrix { sized_box(body, -1) } else { body })
    }
    fn digit_row(&self, text: &str, end: usize, width: usize) -> String {
        self.digit_row_with_style(text, end, width, false)
    }
    fn digit_row_with_style(&self, text: &str, end: usize, width: usize, small: bool) -> String {
        let digits: Vec<_> = text.chars().collect();
        let mut body = format!("<m:m><m:mPr><m:cGpRule m:val=\"3\"/><m:cGp m:val=\"0\"/><m:mcs><m:mc><m:mcPr><m:count m:val=\"{width}\"/><m:mcJc m:val=\"center\"/></m:mcPr></m:mc></m:mcs></m:mPr><m:mr>");
        for col in 0..width {
            let blank = || {
                let height = if small { "<m:zeroAsc m:val=\"1\"/><m:zeroDesc m:val=\"1\"/>" } else { "" };
                format!("<m:phant><m:phantPr><m:show m:val=\"0\"/>{height}</m:phantPr><m:e>{}</m:e></m:phant>", self.run("0", Variant::Monospace))
            };
            let digit = if col >= end.saturating_sub(digits.len()) && col < end { Some(digits[col - (end - digits.len())]) } else { None };
            let content = match digit.filter(|c| !c.is_whitespace()) {
                Some(c) if small => {
                    // A small visible carry takes no width; a normal-size phantom
                    // digit reserves exactly the same column width as the addends.
                    let carry = sized_box(self.run(&c.to_string(), Variant::Monospace), -1);
                    format!("<m:phant><m:phantPr><m:show m:val=\"1\"/><m:zeroWid m:val=\"1\"/></m:phantPr><m:e>{carry}</m:e></m:phant>{}", blank())
                }
                Some(c) => self.run(&c.to_string(), Variant::Monospace),
                None => blank(),
            };
            body.push_str(&format!("<m:e>{content}</m:e>"));
        }
        body.push_str("</m:mr></m:m>");
        body
    }
    fn stack(&self, rows: &[String]) -> String {
        let mut body = String::from("<m:m><m:mPr><m:baseJc m:val=\"top\"/><m:plcHide m:val=\"1\"/></m:mPr>");
        for row in rows {
            body.push_str(&format!("<m:mr><m:e>{row}</m:e></m:mr>"));
        }
        body.push_str("</m:m>");
        body
    }
    fn column_arithmetic(&self, operation: char, terms: &[String]) -> Result<String, OmmlError> {
        let error = || OmmlError::Parse(crate::Error::Syntax { column: 1, message: "invalid or overflowing column arithmetic".into() });
        let [ta, tb] = terms else {
            return Err(error());
        };
        if ta.is_empty() || tb.is_empty() || !ta.bytes().all(|c| c.is_ascii_digit()) || !tb.bytes().all(|c| c.is_ascii_digit()) {
            return Err(error());
        }
        let a: u128 = ta.parse().map_err(|_| error())?;
        let b: u128 = tb.parse().map_err(|_| error())?;
        let answer = match operation {
            '+' => a.checked_add(b).ok_or_else(error)?.to_string(),
            '−' | '-' => {
                if a >= b {
                    (a - b).to_string()
                } else {
                    format!("−{}", b - a)
                }
            }
            '×' | '*' => a.checked_mul(b).ok_or_else(error)?.to_string(),
            _ => return Err(error()),
        };
        let width = ta.len().max(tb.len() + 1).max(answer.chars().count()) + 1;
        let mut rows = Vec::new();
        if operation == '+' {
            let da: Vec<_> = ta.bytes().rev().map(|c| u32::from(c - b'0')).collect();
            let db: Vec<_> = tb.bytes().rev().map(|c| u32::from(c - b'0')).collect();
            let mut carries = vec![' '; width];
            let mut carry = 0;
            for i in 0..da.len().max(db.len()) {
                carry = (da.get(i).copied().unwrap_or(0) + db.get(i).copied().unwrap_or(0) + carry) / 10;
                if carry > 0 && i + 1 < da.len().max(db.len()) {
                    carries[width - i - 2] = '1';
                }
            }
            if carries.contains(&'1') {
                // Keep the carry row's digit columns identical to the main rows.
                rows.push(self.digit_row_with_style(&carries.iter().collect::<String>(), width, width, true));
            }
        }
        rows.push(self.digit_row(ta, width, width));
        rows.push(self.digit_row(&format!("{operation}{tb}"), width, width));
        if matches!(operation, '×' | '*') && tb.len() > 1 {
            for (i, digit) in tb.bytes().rev().enumerate() {
                let product = a.checked_mul(u128::from(digit - b'0')).ok_or_else(error)?.to_string();
                let row = self.digit_row(&product, width - i, width);
                rows.push(if i == 0 { top_bar(row) } else { row });
            }
        }
        rows.push(top_bar(self.digit_row(&answer, width, width)));
        Ok(self.stack(&rows))
    }
    fn long_division(&self, dividend: &str, divisor: &str) -> Result<String, OmmlError> {
        let error = || OmmlError::Parse(crate::Error::Syntax { column: 1, message: "invalid or overflowing long division".into() });
        if dividend.is_empty() || divisor.is_empty() || !dividend.bytes().all(|c| c.is_ascii_digit()) || !divisor.bytes().all(|c| c.is_ascii_digit()) {
            return Err(error());
        }
        let a: u128 = dividend.parse().map_err(|_| error())?;
        let b: u128 = divisor.parse().map_err(|_| error())?;
        if b == 0 {
            return Err(error());
        }
        let width = dividend.len() + 1;
        let mut rows = vec![self.digit_row(dividend, width, width)];
        let mut current = 0u128;
        let mut started = false;
        for (i, digit) in dividend.bytes().enumerate() {
            current = current.checked_mul(10).and_then(|v| v.checked_add(u128::from(digit - b'0'))).ok_or_else(error)?;
            if !started && current < b && i + 1 < dividend.len() {
                continue;
            }
            started = true;
            let product = (current / b) * b;
            rows.push(self.digit_row(&format!("−{product}"), i + 2, width));
            current -= product;
            // The next subtraction acts on the remainder with the next digit
            // brought down, not the remainder alone (24−20 → 47, then −45).
            let (remainder, end) = if let Some(next) = dividend.as_bytes().get(i + 1) {
                let brought_down = current.checked_mul(10).and_then(|v| v.checked_add(u128::from(*next - b'0'))).ok_or_else(error)?;
                (brought_down.to_string(), i + 3)
            } else {
                (current.to_string(), i + 2)
            };
            rows.push(top_bar(self.digit_row(&remainder, end, width)));
        }
        let left = self.stack(&rows);
        let divisor = format!(
            "<m:borderBox><m:borderBoxPr><m:hideTop m:val=\"1\"/><m:hideRight m:val=\"1\"/></m:borderBoxPr><m:e>{}</m:e></m:borderBox>",
            self.run(divisor, Variant::Monospace)
        );
        let right = self.stack(&[divisor, self.run(&(a / b).to_string(), Variant::Monospace)]);
        Ok(format!("<m:m><m:mPr><m:baseJc m:val=\"top\"/></m:mPr><m:mr><m:e>{left}</m:e><m:e>{right}</m:e></m:mr></m:m>"))
    }
    fn proof(&self, branch: &ProofBranch, display: bool) -> Result<String, OmmlError> {
        if branch.line == ProofLine::Dashed {
            return Err(OmmlError::Unsupported("dashed proof rule".into()));
        }
        let conclusion = self.write(&branch.conclusion, display)?;
        let mut result = if branch.premises.is_empty() {
            conclusion
        } else {
            let premises = branch.premises.iter().map(|p| self.proof(p, display)).collect::<Result<Vec<_>, _>>()?.join(&self.run("\u{2003}", Variant::Upright));
            let (num, den) = if branch.root_at_top { (conclusion, premises) } else { (premises, conclusion) };
            format!("<m:f><m:fPr><m:type m:val=\"{}\"/></m:fPr><m:num>{num}</m:num><m:den>{den}</m:den></m:f>", if branch.line == ProofLine::None { "noBar" } else { "bar" })
        };
        if let Some(label) = &branch.left_label {
            result = format!("{}{}", sized_box(self.write(label, false)?, -1), result);
        }
        if let Some(label) = &branch.right_label {
            result.push_str(&sized_box(self.write(label, false)?, -1));
        }
        Ok(result)
    }
}

const WORD_NAMESPACE: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Only merge sibling runs with exactly identical properties, and a single text
// child. Work with escaped source slices so entities are never double escaped.
fn merge_runs(source: &str) -> String {
    let doc = roxmltree::Document::parse(source).expect("writer generates valid XML");
    let mut edits = Vec::new();
    for parent in doc.descendants().filter(|n| n.is_element()) {
        let children: Vec<_> = parent.children().collect();
        let mut i = 0;
        while i < children.len() {
            let Some((properties, text)) = run_parts(children[i], source) else {
                i += 1;
                continue;
            };
            let mut end = i + 1;
            let mut combined = text.to_string();
            while end < children.len() {
                let Some((other, text)) = run_parts(children[end], source) else { break };
                if properties != other {
                    break;
                }
                combined.push_str(text);
                end += 1;
            }
            if end > i + 1 {
                edits.push((children[i].range().start..children[end - 1].range().end, format!("<m:r>{properties}<m:t xml:space=\"preserve\">{combined}</m:t></m:r>")));
            }
            i = end;
        }
    }
    apply_edits(source, edits)
}
fn run_parts<'a>(node: roxmltree::Node<'_, '_>, source: &'a str) -> Option<(&'a str, &'a str)> {
    if !node.has_tag_name((NAMESPACE, "r")) {
        return None;
    }
    let last = node.last_child()?;
    if !last.has_tag_name((NAMESPACE, "t")) {
        return None;
    }
    let range = last.range();
    let raw = &source[range.clone()];
    let text_start = raw.find('>')? + 1;
    let text_end = raw.rfind("</m:t>")?;
    let properties = &source[node.range().start + "<m:r>".len()..range.start];
    Some((properties, &raw[text_start..text_end]))
}
fn apply_edits(source: &str, mut edits: Vec<(std::ops::Range<usize>, String)>) -> String {
    edits.sort_by_key(|(r, _)| r.start);
    let mut result = String::with_capacity(source.len());
    let mut cursor = 0;
    for (range, replacement) in edits {
        result.push_str(&source[cursor..range.start]);
        result.push_str(&replacement);
        cursor = range.end;
    }
    result.push_str(&source[cursor..]);
    result
}

fn office_color(color: &str) -> Result<String, OmmlError> {
    let lower = color.trim().to_ascii_lowercase();
    if lower == "currentcolor" {
        return Ok("auto".into());
    }
    if let Ok(i) = super::omml_colors::NAMED.binary_search_by_key(&lower.as_str(), |(name, _)| *name) {
        return Ok(super::omml_colors::NAMED[i].1.into());
    }
    if let Some(hex) = lower.strip_prefix('#').filter(|s| matches!(s.len(), 3 | 6) && s.bytes().all(|b| b.is_ascii_hexdigit())) {
        return Ok(if hex.len() == 3 { hex.chars().flat_map(|c| [c, c]).collect::<String>() } else { hex.into() }.to_ascii_uppercase());
    }
    if let Some(rgb) = lower.strip_prefix("rgb(").and_then(|s| s.strip_suffix(')')) {
        let channels: Vec<_> = rgb.split(',').map(|s| s.trim().parse::<f64>()).collect();
        if channels.len() == 3 && channels.iter().all(|c| c.as_ref().is_ok_and(|v| v.is_finite() && (0.0..=1.0).contains(v))) {
            return Ok(channels.into_iter().map(|c| format!("{:02X}", (c.unwrap() * 255.0).round() as u8)).collect());
        }
    }
    Err(OmmlError::Unsupported(format!("color {color}")))
}

fn colorize(body: &str, color: &str) -> String {
    word_property(body, "color", color, false)
}

fn half_points(size: f32) -> u32 {
    (size * 2.0).round().clamp(2.0, 3276.0) as u32
}
fn sized_box(body: String, level: i32) -> String {
    format!("<m:box><m:e><m:argPr><m:argSz m:val=\"{level}\"/></m:argPr>{body}</m:e></m:box>")
}

// Apply one Word run property independently of other properties, to both text
// and structural controls. Inner scopes override outer scopes; positions add.
fn word_property(body: &str, name: &str, value: &str, additive: bool) -> String {
    let source = format!("<m:oMath xmlns:m=\"{NAMESPACE}\" xmlns:w=\"{WORD_NAMESPACE}\">{body}</m:oMath>");
    let doc = roxmltree::Document::parse(&source).expect("writer XML");
    let element = |v: &str| if name == "shd" { format!("<w:shd w:val=\"clear\" w:fill=\"{v}\"/>") } else { format!("<w:{name} w:val=\"{v}\"/>") };
    let mut edits = Vec::new();
    for node in doc.descendants().filter(|n| n.is_element()) {
        if node.has_tag_name((WORD_NAMESPACE, "rPr")) {
            if let Some(existing) = node.children().find(|n| n.has_tag_name((WORD_NAMESPACE, name))) {
                if additive {
                    let old: i32 = existing.attribute((WORD_NAMESPACE, "val")).unwrap_or("0").parse().unwrap_or(0);
                    let delta: i32 = value.parse().unwrap_or(0);
                    edits.push((existing.range(), element(&(old + delta).clamp(-3168, 3168).to_string())));
                }
            } else {
                // Keep CT_RPr ordering for the properties emitted by this writer.
                let order = |tag: &str| match tag {
                    "color" => 1,
                    "spacing" => 2,
                    "position" => 3,
                    "sz" => 4,
                    "shd" => 5,
                    _ => 0,
                };
                let at =
                    node.children().find(|n| n.is_element() && order(n.tag_name().name()) > order(name)).map(|n| n.range().start).unwrap_or(node.range().end - "</w:rPr>".len());
                edits.push((at..at, element(value)));
            }
        } else if node.has_tag_name((NAMESPACE, "r")) && !node.children().any(|n| n.has_tag_name((WORD_NAMESPACE, "rPr"))) {
            let at = node.children().find(|n| n.has_tag_name((NAMESPACE, "t"))).expect("text").range().start;
            edits.push((at..at, format!("<w:rPr>{}</w:rPr>", element(value))));
        } else if node.tag_name().namespace() == Some(NAMESPACE) && is_object(node.tag_name().name()) {
            let tag = format!("{}Pr", node.tag_name().name());
            if let Some(pr) = node.children().find(|n| n.has_tag_name((NAMESPACE, tag.as_str()))) {
                if !pr.children().any(|n| n.has_tag_name((NAMESPACE, "ctrlPr"))) {
                    let at = pr.range().end - format!("</m:{tag}>").len();
                    edits.push((at..at, format!("<m:ctrlPr><w:rPr>{}</w:rPr></m:ctrlPr>", element(value))));
                }
            } else {
                let at = node.range().start + node.tag_name().name().len() + 4;
                edits.push((at..at, format!("<m:{tag}><m:ctrlPr><w:rPr>{}</w:rPr></m:ctrlPr></m:{tag}>", element(value))));
            }
        }
    }
    let result = apply_edits(&source, edits);
    result[result.find('>').unwrap() + 1..result.len() - "</m:oMath>".len()].into()
}
fn is_object(tag: &str) -> bool {
    matches!(
        tag,
        "f" | "rad"
            | "sSub"
            | "sSup"
            | "sSubSup"
            | "sPre"
            | "limLow"
            | "limUpp"
            | "d"
            | "m"
            | "eqArr"
            | "acc"
            | "bar"
            | "nary"
            | "groupChr"
            | "borderBox"
            | "phant"
            | "box"
            | "func"
    )
}

fn is_empty(node: &Node) -> bool {
    matches!(node, Node::Row { children } if children.iter().all(is_empty))
}

fn top_bar(body: String) -> String {
    format!("<m:bar><m:barPr><m:pos m:val=\"top\"/></m:barPr><m:e>{body}</m:e></m:bar>")
}
