import { strict as assert } from "node:assert";
import { test } from "node:test";
import MarkdownIt from "markdown-it";
import { mathPlugin } from "../src/markdown.ts";

// equations drawn as a tag that shows what the plugin passed
let enabled = true;
const md = new MarkdownIt().use(mathPlugin, {
  enabled: () => enabled,
  html: (tex: string, display: boolean) => `<m${display ? " d" : ""}>${tex}</m>`,
});
const html = (src: string) => md.render(src);

test("inline math in a paragraph", () => {
  assert.equal(html("a $x^2$ b \\(y\\) c"), "<p>a <m>x^2</m> b <m>y</m> c</p>\n");
  assert.equal(html("in a line $$x$$ and \\[y\\]"), "<p>in a line <m d>x</m> and <m d>y</m></p>\n");
  // the escapes and dollars Markdown keeps as text
  assert.equal(html("\\$5 and $6, \\*"), "<p>$5 and $6, *</p>\n");
  // math comes before emphasis and links
  assert.equal(html("*a $b* c$"), "<p>*a <m>b* c</m></p>\n");
  assert.equal(html("[a $b](u) c$"), "<p>[a <m>b](u) c</m></p>\n");
  assert.equal(html("[a $b$](u)"), '<p><a href="u">a <m>b</m></a></p>\n');
});

test("$$ blocks, over lines and on one", () => {
  assert.equal(html("$$\na\n\nb\n$$"), '<div class="mathra-block">' + "<m d>\na\n\nb\n</m></div>\n");
  assert.equal(html("$$x$$"), '<div class="mathra-block"><m d>x</m></div>\n');
  assert.equal(html("$$ a\nb $$"), '<div class="mathra-block"><m d> a\nb </m></div>\n');
  assert.equal(html("text\n$$\nx\n$$"), '<p>text</p>\n<div class="mathra-block"><m d>\nx\n</m></div>\n');
});

test("what is not a $$ block", () => {
  // never closed, empty, two equations on the line, indented as code, $$$$
  assert.equal(html("$$\nx"), "<p>$$\nx</p>\n");
  assert.equal(html("$$\n\n$$"), "<p>$$</p>\n<p>$$</p>\n");
  assert.equal(html("$$a$$ and $$b$$"), "<p><m d>a</m> and <m d>b</m></p>\n");
  assert.equal(html("$$a$$ b"), "<p><m d>a</m> b</p>\n");
  assert.equal(html("    $$x$$"), "<pre><code>$$x$$\n</code></pre>\n");
  assert.equal(html("$$$$"), "<p>$$$$</p>\n");
});

test("```math blocks; other fences as they were", () => {
  assert.equal(html("```math\na^2\n```"), '<div class="mathra-block"><m d>a^2\n</m></div>\n');
  assert.equal(html("```js\n$x$\n```"), '<pre><code class="language-js">$x$\n</code></pre>\n');
});

test("turned off, the math is left to the preview's own rules", () => {
  enabled = false;
  try {
    assert.equal(html("$x$ \\(y\\)"), "<p>$x$ (y)</p>\n");
    assert.equal(html("$$\nx\n$$"), "<p>$$\nx\n$$</p>\n");
    assert.equal(html("```math\nx\n```"), '<pre><code class="language-math">x\n</code></pre>\n');
  } finally {
    enabled = true;
  }
});

test("the block's attributes, for the preview's scroll sync", () => {
  const tokens = md.parse("$$\nx\n$$\n\n```math\ny\n```", {});
  for (const t of tokens) t.attrSet("data-line", String(t.map![0]));
  assert.equal(md.renderer.render(tokens, md.options, {}), '<div class="mathra-block" data-line="0"><m d>\nx\n</m></div>\n<div class="mathra-block" data-line="4"><m d>y\n</m></div>\n');
});
