//! RaTeX-compatible presentation commands, lowered to the existing semantic nodes.
use super::*;

impl Reader<'_> {
    pub(super) fn compat_command(&mut self, name: &str, col: usize, start: usize, star: bool, items: &mut Vec<Node>) -> R<Option<Option<Stop>>> {
        let _ = (col, start, star);
        let size = match name {
            "tiny" => Some(0.5),
            "sixptsize" => Some(0.6),
            "scriptsize" => Some(0.7),
            "footnotesize" => Some(0.8),
            "small" => Some(0.9),
            "normalsize" => Some(1.0),
            "large" => Some(1.2),
            "Large" => Some(1.44),
            "LARGE" => Some(1.728),
            "huge" => Some(2.074),
            "Huge" => Some(2.488),
            _ => None,
        };
        if let Some(size) = size {
            self.registry.note(rules::L_SIZ_1, format!("\\{name}: absolute size multiplier {size}"));
            // Size declarations replace the previous declaration rather than multiply it.
            // Read through the same group terminator as any other scoped declaration.
            let saved = self.explicit_size;
            self.explicit_size = size;
            let parsed = self.list();
            self.explicit_size = saved;
            let (body, stop) = parsed?;
            items.push(Node::Scaled { factor: size / saved, vertical: None, base: Box::new(Node::Style { level: 1, base: Box::new(Node::row(body)) }) });
            return Ok(Some(Some(stop)));
        }
        let node = match name {
            "slashed" => Node::Canceled { base: Box::new(self.argument()?), shape: Cancel::Slash },
            "htmlStyle" => self.html_style()?,
            _ => return Ok(None),
        };
        items.push(node);
        Ok(Some(None))
    }

    fn html_style(&mut self) -> R<Node> {
        let style = self.raw_text()?;
        let raw = self.raw_text()?;
        let (mut color, mut background, mut scale) = (None, None, None);
        let (mut bold, mut italic, mut underline) = (false, false, false);
        for declaration in style.split(';') {
            let Some((property, value)) = declaration.split_once(':') else { continue };
            let value = value.trim();
            match property.trim().to_ascii_lowercase().as_str() {
                "color" => color = css_color(value),
                "background" | "background-color" => background = css_color(value),
                "font-size" => scale = css_font_size(value),
                "font-weight" => bold = value.eq_ignore_ascii_case("bold") || value.eq_ignore_ascii_case("bolder") || value.parse::<u16>().is_ok_and(|n| n >= 600),
                "font-style" => italic = value.eq_ignore_ascii_case("italic") || value.eq_ignore_ascii_case("oblique"),
                "text-decoration" | "text-decoration-line" => underline = value.split_whitespace().any(|p| p.eq_ignore_ascii_case("underline")),
                // These are drawing options, not CSS sent to a browser. As in RaTeX, unknown properties do nothing.
                _ => {}
            }
        }
        let variant = match (bold, italic) {
            (true, true) => Variant::BoldItalic,
            (true, false) => Variant::Bold,
            (false, true) => Variant::Italic,
            _ => self.variant,
        };
        let mut base = self.nested(|this| this.sub_reader(&raw, variant))?;
        if let Some(color) = color {
            base = Node::Colored { color, base: Box::new(base) };
        }
        if let Some(factor) = scale {
            base = Node::Scaled { factor, vertical: None, base: Box::new(base) };
        }
        if let Some(background) = background {
            base = Node::Framed { base: Box::new(base), shape: Frame::Background, background: Some(background), border: None };
        }
        if underline {
            base = Node::Bar { base: Box::new(base), above: false };
        }
        Ok(base)
    }
}

fn css_font_size(value: &str) -> Option<f32> {
    let value = value.to_ascii_lowercase().replace(' ', "");
    let (number, factor) = if let Some(n) = value.strip_suffix("px") {
        (n, 1.0 / 16.0)
    } else if let Some(n) = value.strip_suffix("rem").or_else(|| value.strip_suffix("em")) {
        (n, 1.0)
    } else {
        (value.strip_suffix('%')?, 0.01)
    };
    number.parse::<f32>().ok().map(|n| n * factor).filter(|n| n.is_finite() && *n > 0.0)
}

fn css_color(value: &str) -> Option<String> {
    // Same color spelling accepted by the existing reader, never copied into CSS/HTML.
    let valid = !value.is_empty() && value.len() < 40 && value.chars().all(|c| c.is_ascii_alphanumeric() || "#(),. ".contains(c));
    valid.then(|| value.to_string())
}
