//! The bussproofs subset supported by RaTeX: a stack of premises assembled into inferences.
use super::*;

impl Reader<'_> {
    fn proof_argument(&mut self) -> R<Node> {
        self.skip_spaces();
        if self.current() != Some('{') {
            return self.error(self.column(), "proof commands require a braced argument");
        }
        let raw = self.raw_text()?;
        self.nested(|this| this.sub_reader(&raw, Variant::Upright))
    }

    pub(super) fn proof_tree(&mut self, col: usize) -> R<Node> {
        let mut stack: Vec<(ProofBranch, usize)> = Vec::new();
        let (mut left, mut right) = (None, None);
        let (mut default_line, mut next_line) = (ProofLine::Solid, ProofLine::Solid);
        let (mut default_top, mut next_top) = (false, false);
        loop {
            self.skip_spaces();
            let start = self.pos;
            if self.current() != Some('\\') {
                return self.error(self.column(), "expected a proof command or \\end{prooftree}");
            }
            self.pos += 1;
            let name = self.read_command_name();
            if let Some(m) = self.macros.commands.get(&name).cloned() {
                self.expand(start, &m, col)?;
                continue;
            }
            match name.as_str() {
                "end" => {
                    let end = self.raw_text()?;
                    if end.trim() != "prooftree" {
                        return self.error(self.column(), format!("expected \\end{{prooftree}}, found \\end{{{end}}}"));
                    }
                    break;
                }
                "LeftLabel" | "LL" => left = Some(Box::new(self.proof_argument()?)),
                "RightLabel" | "RL" => right = Some(Box::new(self.proof_argument()?)),
                "singleLine" | "solidLine" => next_line = ProofLine::Solid,
                "dashedLine" => next_line = ProofLine::Dashed,
                "noLine" => next_line = ProofLine::None,
                "alwaysSingleLine" | "alwaysSolidLine" => {
                    default_line = ProofLine::Solid;
                    next_line = default_line;
                }
                "alwaysDashedLine" => {
                    default_line = ProofLine::Dashed;
                    next_line = default_line;
                }
                "alwaysNoLine" => {
                    default_line = ProofLine::None;
                    next_line = default_line;
                }
                "rootAtTop" => next_top = true,
                "rootAtBottom" => next_top = false,
                "alwaysRootAtTop" => {
                    default_top = true;
                    next_top = true;
                }
                "alwaysRootAtBottom" => {
                    default_top = false;
                    next_top = false;
                }
                command => {
                    let arity = match command {
                        "AxiomC" | "Axiom" | "AXC" => 0,
                        "UnaryInfC" | "UnaryInf" | "UIC" => 1,
                        "BinaryInfC" | "BinaryInf" | "BIC" => 2,
                        "TrinaryInfC" | "TrinaryInf" | "TIC" => 3,
                        "QuaternaryInfC" | "QuaternaryInf" => 4,
                        "QuinaryInfC" | "QuinaryInf" => 5,
                        _ => return self.error(self.column(), format!("unsupported proof command: \\{command}")),
                    };
                    if stack.len() < arity {
                        return self.error(self.column(), format!("\\{command} needs {arity} premises, only {} available", stack.len()));
                    }
                    let conclusion = Box::new(self.proof_argument()?);
                    let entries = stack.split_off(stack.len() - arity);
                    let payload_depth = node_depth(&conclusion).max(left.as_deref().map(node_depth).unwrap_or(0)).max(right.as_deref().map(node_depth).unwrap_or(0));
                    let depth = 1 + entries.iter().map(|(_, d)| *d).max().unwrap_or(0).max(payload_depth);
                    // An iterative parser can still build a recursively laid-out tree.
                    if depth + self.macros.depth > NESTING_LIMIT {
                        return self.error(col, format!("proof nesting deeper than {NESTING_LIMIT} levels"));
                    }
                    let branch = ProofBranch {
                        conclusion,
                        premises: entries.into_iter().map(|(b, _)| b).collect(),
                        left_label: if arity == 0 { None } else { left.take() },
                        right_label: if arity == 0 { None } else { right.take() },
                        line: if arity == 0 { ProofLine::None } else { next_line },
                        root_at_top: arity != 0 && next_top,
                    };
                    stack.push((branch, depth));
                    if arity != 0 {
                        next_line = default_line;
                        next_top = default_top;
                    }
                }
            }
        }
        if stack.len() != 1 {
            return self.error(col, format!("prooftree ended with {} branches, expected one", stack.len()));
        }
        if left.is_some() || right.is_some() {
            return self.error(col, "proof label without a following inference");
        }
        Ok(Node::ProofTree { tree: Box::new(stack.pop().unwrap().0) })
    }
}

// Count payloads too: an argument can itself contain a proof, a fraction, or a table.
// This prevents iterative inference chains from wrapping already deep parsed arguments.
fn node_depth(node: &Node) -> usize {
    let max = |nodes: &[Node]| nodes.iter().map(node_depth).max().unwrap_or(0);
    let opt = |n: &Option<Box<Node>>| n.as_deref().map(node_depth).unwrap_or(0);
    1 + match node {
        Node::ProofTree { tree } => branch_depth(tree),
        Node::Row { children } => max(children),
        Node::Choice { branches } => max(branches),
        Node::Fraction { num, den, .. } => node_depth(num).max(node_depth(den)),
        Node::Root { radicand, index } => node_depth(radicand).max(opt(index)),
        Node::Scripts { base, sup, sub } => node_depth(base).max(opt(sup)).max(opt(sub)),
        Node::Delimited { parts, .. } => max(parts),
        Node::Table { rows, between, .. } => rows.iter().map(|r| max(r)).chain(between.iter().map(|(_, n)| node_depth(n))).max().unwrap_or(0),
        Node::Text { parts } => parts.iter().filter_map(|p| if let TextPart::Math(n) = p { Some(node_depth(n)) } else { None }).max().unwrap_or(0),
        Node::Brace { base, label, .. } => node_depth(base).max(opt(label)),
        Node::Arrow { above, below, .. } => opt(above).max(opt(below)),
        Node::VerticalArrow { left, right, .. } => opt(left).max(opt(right)),
        Node::Stacked { base, above, below } => node_depth(base).max(opt(above)).max(opt(below)),
        Node::Quantity { unit, .. } => node_depth(unit),
        Node::ArrowDiagram { cells, arrows } => cells.iter().map(|r| max(r)).chain(arrows.iter().flat_map(|a| a.labels.iter().map(|l| node_depth(&l.node)))).max().unwrap_or(0),
        Node::Accent { base, .. }
        | Node::Bar { base, .. }
        | Node::Canceled { base, .. }
        | Node::Framed { base, .. }
        | Node::Phantom { base, .. }
        | Node::ForcedClass { base, .. }
        | Node::Style { base, .. }
        | Node::Colored { base, .. }
        | Node::Unit { base, .. }
        | Node::Multicolumn { base, .. }
        | Node::Raised { base, .. }
        | Node::Scaled { base, .. }
        | Node::Resized { base, .. }
        | Node::Rotated { base, .. }
        | Node::VCenter { base }
        | Node::Reflected { base }
        | Node::Smashed { base, .. }
        | Node::Overlapped { base, .. } => node_depth(base),
        Node::Number { .. }
        | Node::Identifier { .. }
        | Node::Function { .. }
        | Node::Operator { .. }
        | Node::FixedDelimiter { .. }
        | Node::LargeOperator { .. }
        | Node::Space { .. }
        | Node::Rule { .. }
        | Node::LongDivision { .. }
        | Node::ColumnArithmetic { .. } => 0,
        #[cfg(feature = "chem")]
        Node::Chemistry { .. } => 0,
    }
}

fn branch_depth(tree: &ProofBranch) -> usize {
    1 + tree
        .premises
        .iter()
        .map(branch_depth)
        .chain(std::iter::once(node_depth(&tree.conclusion)))
        .chain([&tree.left_label, &tree.right_label].into_iter().flatten().map(|n| node_depth(n)))
        .max()
        .unwrap_or(0)
}
