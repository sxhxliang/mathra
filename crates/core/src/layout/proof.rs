//! Derivations keep their conclusion baseline and horizontal attachment span at every level.
//! Labels and wide ancestors enlarge the box without moving that attachment span.
use super::*;

struct BranchBox {
    math_box: MathBox,
    root_center: f32,
    root_width: f32,
}

pub(super) fn compose(tree: &ProofBranch, e: Style, ctx: &mut Context) -> R<MathBox> {
    ctx.registry.note(rules::L_PRF_1, "proof premises attach at their conclusions");
    branch(tree, e, ctx).map(|b| b.math_box)
}

fn branch(tree: &ProofBranch, e: Style, ctx: &mut Context) -> R<BranchBox> {
    let mut conclusion = super::compose(&tree.conclusion, e, ctx)?;
    conclusion.depth = conclusion.depth.max(em(e, 0.2));
    if tree.premises.is_empty() {
        return Ok(BranchBox { root_center: conclusion.width / 2.0, root_width: conclusion.width, math_box: conclusion });
    }
    let premises = tree.premises.iter().map(|p| branch(p, e, ctx)).collect::<R<Vec<_>>>()?;
    let gap = em(e, 0.32);
    // Bussproofs inference lines have their own weight; a math font's fraction
    // rule would make STIX proofs substantially heavier than RaTeX/Latin Modern.
    let thickness = em(e, 0.08);
    let mut cursor = 0.0;
    let (mut root_left, mut root_right) = (f32::INFINITY, f32::NEG_INFINITY);
    for p in &premises {
        root_left = root_left.min(cursor + p.root_center - p.root_width / 2.0);
        root_right = root_right.max(cursor + p.root_center + p.root_width / 2.0);
        cursor += p.math_box.width + em(e, 2.0);
    }
    let center = (root_left + root_right) / 2.0;
    let padding = if premises.len() > 1 { em(e, 0.65) } else { 0.0 };
    let width = (root_right - root_left + padding).max(conclusion.width).max(em(e, 1.12));
    let rule_x = center - width / 2.0;
    let conclusion_x = center - conclusion.width / 2.0;
    let (rule_y, premise_y) = if tree.root_at_top {
        let rule_y = -conclusion.depth - gap - thickness;
        let height = premises.iter().map(|p| p.math_box.height).fold(0.0, f32::max);
        (rule_y, rule_y - gap - height)
    } else {
        let rule_y = conclusion.height + gap;
        let depth = premises.iter().map(|p| p.math_box.depth).fold(0.0, f32::max);
        (rule_y, rule_y + thickness + gap + depth)
    };
    let mut result = MathBox::empty();
    result.place(&conclusion, conclusion_x, 0.0);
    let mut min_x = rule_x.min(conclusion_x).min(0.0);
    let mut max_x = (rule_x + width).max(conclusion_x + conclusion.width);
    cursor = 0.0;
    for p in &premises {
        result.place(&p.math_box, cursor, premise_y);
        max_x = max_x.max(cursor + p.math_box.width);
        cursor += p.math_box.width + em(e, 2.0);
    }
    match tree.line {
        ProofLine::Solid => result.place(&MathBox::bar(width, thickness, 0.0), rule_x, rule_y),
        ProofLine::Dashed => {
            // Bound work for unusually wide user-defined boxes as well as ordinary formulas.
            // Match RaTeX's equal dash/gap lengths, each three times the line weight.
            let dash = (thickness * 3.0).max(width / 8192.0);
            let pitch = dash * 2.0;
            let count = (width / pitch).ceil().clamp(1.0, 4096.0) as usize;
            for i in 0..count {
                let x = i as f32 * pitch;
                result.place(&MathBox::bar(dash.min(width - x), thickness, 0.0), rule_x + x, rule_y);
            }
        }
        ProofLine::None => {}
    }
    for (node, left) in [(&tree.left_label, true), (&tree.right_label, false)] {
        if let Some(node) = node {
            let label = super::compose(node, e.not_display(), ctx)?;
            let x = if left { rule_x - em(e, 0.08) - label.width } else { rule_x + width + em(e, 0.08) };
            let y = rule_y + thickness / 2.0 + (label.depth - label.height) / 2.0;
            result.place(&label, x, y);
            min_x = min_x.min(x);
            max_x = max_x.max(x + label.width);
        }
    }
    let mut normalized = MathBox::space(max_x - min_x);
    normalized.place(&result, -min_x, 0.0);
    Ok(BranchBox { math_box: normalized, root_center: center - min_x, root_width: conclusion.width })
}
