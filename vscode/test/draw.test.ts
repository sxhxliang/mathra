import { strict as assert } from "node:assert";
import { test } from "node:test";
import { asImage, dataUri, draw, escapeHtml, explain, hoverDetails, hoverEquation, resolveLocale, toHtml } from "../src/draw.ts";

test("the locale: the setting's, or the closest to the editor's language", () => {
  assert.equal(resolveLocale("auto", "pt-br"), "pt-BR");
  assert.equal(resolveLocale("auto", "pt"), "pt-BR");
  assert.equal(resolveLocale("auto", "zh-cn"), "zh");
  assert.equal(resolveLocale("auto", "fr"), "fr");
  assert.equal(resolveLocale("auto", "sv"), "en");
  assert.equal(resolveLocale("de", "pt-br"), "de");
});

test("draw: every output, or the reason", () => {
  const r = draw("\\frac{a}{b}", false, "en");
  assert.ok(!(r instanceof Error));
  assert.equal(r.speech, "a over b");
  const e = draw("\\frac{a}{b", false, "en");
  assert.ok(!(e instanceof Error), "tolerant: an unclosed brace is worked around");
  assert.ok(e.warnings.length > 0);
  assert.ok(draw("<math><mi>", true, "en") instanceof Error);
});

test("HTML: the SVG in a span, display as a block; what cannot be read stays as written", () => {
  assert.match(toHtml("x", false, "en"), /^<span class="mathra mathra-inline"><svg /);
  assert.match(toHtml("x", true, "en"), /^<span class="mathra mathra-display" style="display:block;[^"]*"><svg /);
  assert.equal(toHtml("<math><mi>", true, "en").startsWith('<code class="mathra-error" title="mathra: '), true);
  assert.match(toHtml("<math><mi>", true, "en"), />&lt;math&gt;&lt;mi&gt;<\/code>$/);
  assert.equal(escapeHtml(`a<b>&"c"`), "a&lt;b&gt;&amp;&quot;c&quot;");
});

test("an SVG as an image takes the color and size it is given", () => {
  assert.equal(asImage('<svg a="1" style="vertical-align: 0"><g/></svg>', "#fff", 20), '<svg a="1" style="color:#fff;font-size:20px;vertical-align: 0"><g/></svg>');
  assert.equal(asImage('<svg a="1"><g style="x"/></svg>', "#fff", 20), '<svg style="color:#fff;font-size:20px" a="1"><g style="x"/></svg>');
  assert.equal(dataUri("<svg/>"), `data:image/svg+xml;base64,${btoa("<svg/>")}`);
});

test("the hover's equation: the drawing over its LaTeX, the only text of the part", () => {
  const md = hoverEquation(" x_1 ", false, "en", "#111111");
  assert.match(md, /^!\[x sub 1\]\(data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+\)\n\n```latex\nx_1\n```$/);
  const svg = atob(/base64,([^)]+)/.exec(md)![1]);
  assert.match(svg, /^<svg [^>]*style="color:#111111;font-size:20px;/);
  // a fence longer than the backticks inside; an error over the LaTeX it is about
  assert.match(hoverEquation("\\text{````}", false, "en", "#111"), /\n\n`````latex\n\\text\{````\}\n`````$/);
  assert.match(hoverEquation("<math><mi>", true, "en", "#111111"), /^\*\*mathra:\*\* .*\n\n```latex\n<math><mi>\n```$/);
});

test("the hover's details: the speech, the warnings, the links; none when mathra cannot read it", () => {
  assert.equal(hoverDetails("x_1", false, "en", "LINKS"), "$(unmute) *x sub 1*\n\nLINKS");
  assert.match(hoverDetails("\\frac{a}{b", true, "en", "LINKS")!, /\n\n\$\(warning\) `E-REC-4` column 9: '\\\{' without a matching '\\\}'.*\n\nLINKS$/);
  assert.equal(hoverDetails("<math><mi>", true, "en", "LINKS"), undefined);
});

test("explain, as `mathra --explain` writes it", () => {
  const r = draw("x", true, "en") as Exclude<ReturnType<typeof draw>, Error>;
  assert.equal(
    explain("x", "en", r),
    `input    x\nlocale   en\ntext     x\nspeech   x\nbraille  ${r.braille} (nemeth)\ntree     ${JSON.stringify(r.tree)}\nrules    no rule changed the result\n`,
  );
  const w = draw("\\frac{a}{b", true, "en") as Exclude<ReturnType<typeof draw>, Error>;
  assert.match(explain("\\frac{a}{b", "en", w), /\nwarnings\n  E-REC-4   column 9: /);
});
