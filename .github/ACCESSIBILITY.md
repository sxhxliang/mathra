# Accessibility

mathra exists so that an equation on a page can be read by everyone, not only seen. An accessibility barrier in what it produces is treated as a bug, with the same weight as a wrong drawing.

## What mathra promises

Every SVG follows the contract in [`spec/svg.md`](../spec/svg.md), and each item has a test:

- **Speech.** The SVG is `role="img"`, labelled by a `<title>` that holds the equation as a screen reader should say it, in the language of the `lang` attribute. The speech is built from the tree of meaning, not from the LaTeX, so `\frac{3}{4}` is "3 over 4" (or "three quarters" where the language says it that way), never "backslash frac".
- **16 languages.** The locale decides how the equation is read, written and spoken ([`spec/locales.md`](../spec/locales.md)).
- **Braille.** Every equation comes out in braille, in the CMU for Portuguese and Spanish and in Nemeth for the other languages ([`spec/braille.md`](../spec/braille.md)), returned by the API and stored in the SVG's `<metadata>`.
- **MathML.** Every conversion also gives presentation MathML, with an `intent` where the tree knows what the drawing does not say ([`spec/mathml.md`](../spec/mathml.md)), for tools that read MathML directly.
- **Text.** A transparent text layer, hidden from assistive technology, lets the equation be selected and copied; color is inherited from the page, so it follows high-contrast and dark themes.
- **Same input, same output.** The four packages (Rust, CLI, npm, PyPI) run the same core, so the speech and the braille do not depend on where the equation was converted.

## Where it has been tested

<!-- TODO(maintainer): fill in what was actually tested. Example rows below; delete the ones not tried. -->

| Screen reader | Browser / system | Result |
|---|---|---|
| NVDA | Firefox / Windows | _not yet tested_ |
| JAWS | Chrome / Windows | _not yet tested_ |
| VoiceOver | Safari / macOS | _not yet tested_ |
| VoiceOver | Safari / iOS | _not yet tested_ |
| TalkBack | Chrome / Android | _not yet tested_ |

If you use one of these, or another, a report of what you heard is welcome (see below), whether it worked or not.

## Known limitations

- **Speech outside English and pt-BR** has not been reviewed by native speakers. It follows the rules in `spec/locales.md`, but phrasing may sound unnatural.
- **Braille** follows the official documents (BANA 2022 for Nemeth, MEC 2006 for the CMU) and is checked against their own examples, and it was compared with MathCAT row by row ([`docs/braille-review.md`](../docs/braille-review.md)). It has not yet been reviewed by a braille transcriber, so it should not reach students without that review. The open points are listed at the end of `spec/braille.md`.
- **MathML cannot draw everything** (chemfig structures, commutative diagrams, `\cancel`, `\boxed`): those come out as `<semantics>` with the source as an annotation, and tools that read only the MathML lose the drawing. The SVG's speech still describes them.
- **Long equations** are spoken as one `<title>`; there is no navigation inside the equation by sub-expression yet.
<!-- TODO(maintainer): add anything else you know of. -->

## The site

The [playground](https://matheusmota-dev-br.github.io/mathra/) and the [reference page](https://matheusmota-dev-br.github.io/mathra/reference.html) are meant to be usable by keyboard and screen reader: labelled controls, `aria-pressed` toggles, live regions for the preview, and a dark theme. Problems with the site are accessibility bugs too.

## Reporting a barrier

Open an issue with the **Accessibility barrier** template. It asks for:

- the input and the options (`--locale`, `--braille-code`, …), and the version;
- the assistive technology, its version, and the browser or system;
- what was said, shown or brailled, and what you expected.

`mathra --explain` prints the speech, the text and the braille side by side; paste its output when you can. Issues about accessibility get the `accessibility` label, and their fixes are listed under **Accessibility** in the release notes.

## Helping

The most useful contributions are reviews that need a person:

- **Speech in your language:** read the speech of the corpus in your locale and point out what a native speaker would say differently. How a language is defined is in `spec/locales.md`.
- **Braille:** if you are a braille transcriber or reader of CMU or Nemeth, a review of `spec/braille.md` and the Braille tab of the [reference page](https://matheusmota-dev-br.github.io/mathra/reference.html#braille) would let the braille reach students.
- **Screen reader testing:** filling in the table above.

How to change behavior is in [CONTRIBUTING.md](CONTRIBUTING.md).
