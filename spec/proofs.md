# Proof trees

`\begin{prooftree}…\end{prooftree}` implements the bussproofs subset supported by RaTeX 0.1.15. No package import or `chem` feature is needed.

```latex
\begin{prooftree}
\AxiomC{A \fCenter B}
\AxiomC{B \fCenter C}
\LeftLabel{cut}
\RightLabel{\alpha}
\BinaryInfC{A \fCenter C}
\end{prooftree}
```

## Commands

| Operation | Commands |
| --- | --- |
| Axiom | `\AxiomC`, `\Axiom`, `\AXC` |
| One premise | `\UnaryInfC`, `\UnaryInf`, `\UIC` |
| Two premises | `\BinaryInfC`, `\BinaryInf`, `\BIC` |
| Three premises | `\TrinaryInfC`, `\TrinaryInf`, `\TIC` |
| Four premises | `\QuaternaryInfC`, `\QuaternaryInf` |
| Five premises | `\QuinaryInfC`, `\QuinaryInf` |
| Labels | `\LeftLabel`, `\LL`, `\RightLabel`, `\RL` |
| Next inference's line | `\singleLine`, `\solidLine`, `\dashedLine`, `\noLine` |
| Default line | `\alwaysSingleLine`, `\alwaysSolidLine`, `\alwaysDashedLine`, `\alwaysNoLine` |
| Next inference's root | `\rootAtTop`, `\rootAtBottom` |
| Default root | `\alwaysRootAtTop`, `\alwaysRootAtBottom` |

Axioms, inferences and labels take braced arguments. Arguments use the ordinary math reader with upright letters by default, matching RaTeX's proof cells; explicit alphabets still work. `\fCenter` draws the relation `⇒`; a user macro can redefine it. Macros expanding to proof commands are accepted. Use `\text{…}` for running text and spaces in labels.

An axiom pushes a branch. Each inference pops the required number of branches in source order and pushes the derived branch. Labels and one-shot settings wait for the next inference, even across axioms. Each inference consumes its labels and restores the default line and direction. Defaults start with a solid line and the conclusion at the bottom, and are local to each proof environment.

## Layout and outputs

**L-PRF-1:** Each branch keeps its conclusion's baseline and horizontal attachment span. Premise conclusion baselines align, with the rule centered on their attachment span and the conclusion centered on that rule. Wider subtrees and labels enlarge the bounding box without moving the attachment. Root-at-top puts premises below the conclusion without mirroring their glyphs or their own inference direction. Proof arguments stay at the surrounding formula's style instead of shrinking at each inference as fractions do. Inference lines are .08 em thick regardless of the font's fraction-rule weight; dashed lines use equal dash/gap lengths of three line weights, matching RaTeX's pattern (very wide rules cap the number of dashes at 4096).

`Node::ProofTree` stores a `ProofBranch` with conclusion, premises, labels, line style and direction. SVG metadata serializes that structure. Speech announces axioms, premises, conclusions, labels and inference boundaries in all 16 locales. Selection text and braille linearize the structure as `(premises) ⇒ conclusion [left label] [right label]`, recursively grouped; this preserves content, not a standardized spatial proof-tree braille notation. Line style and visual orientation remain in the metadata, rather than the linear text.

## Errors and boundaries

Insufficient premises, leftover branches, orphan labels, missing/mismatched ends, unbraced arguments and unknown proof commands are errors in both strict and tolerant modes. Tolerance inside valid formula arguments follows the existing reader options. Recursively constructed branch depth and argument payload depth share the reader's nesting budget (64); an iterative chain cannot bypass it.

Like the current RaTeX subset, this does not implement `\InsertBetweenHyps`, `\ScoreTree`, `\Cell`, `\noCell` or double inference lines. It is not a full bussproofs implementation or a promise of pixel-identical TeX/RaTeX spacing.

Tests: `crates/core/tests/proof.rs`.
