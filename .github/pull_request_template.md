<!--
Title: Conventional Commits, it sets the labels: `fix(latex): …`, `feat(chem): …`, `a11y: …`, `docs: …`.
One change per pull request. See CONTRIBUTING.md.
-->

## What changes

<!-- What this does for users, and why. -->

Closes #

## Rules

<!-- The ids in spec/ written or changed (for example L-NUM-1), or "none" for a change with no behavior. -->

## Accessibility

<!-- Does the speech, the braille, the MathML or the SVG markup change? In which locales? Paste before/after from `mathra --explain` if so. Write "no change" otherwise. -->

## Checklist

- [ ] The rule is in `spec/` before the code, the code cites its id, and a test carries the same id.
- [ ] `scripts/check.sh` passes, with every line and function of the workspace run (100% coverage).
- [ ] What changed for users is under `## Unreleased` in `CHANGELOG.md`.
- [ ] Versions are untouched.
- [ ] New test inputs are written by hand, not copied from books or exams.
- [ ] If the banner changed: regenerated with `cargo run -p mathra --example banner`.
