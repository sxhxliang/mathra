// The components in a real browser (Chromium, headless): node test/browser.mjs [screenshot folder]
// Serves the repository root itself (npm/pkg and editor/dist must be built), drives demo/index.html
// (the editor filling the page) and test/components.html (the pieces alone), and checks what a person
// would see and do. Exits non-zero if anything fails. With COVERAGE=<file>, it serves the sources
// themselves (src/*.ts with the types stripped, so offsets are the source's) and writes Chromium's
// coverage of them there, for scripts/coverage.mjs.

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../..", import.meta.url));
const shots = process.argv[2] ?? null;
const coverage = process.env.COVERAGE ?? null;
const covered = [];
const watch = async (p) => coverage && p.coverage.startJSCoverage({ resetOnNavigation: false });
const collect = async (p) => coverage && covered.push(...(await p.coverage.stopJSCoverage()).filter((e) => e.url.includes("/editor/dist/")));
// a reload drops the old document's scripts and their coverage: taken before it, then watched again
const reload = async (p) => {
  await collect(p);
  await p.reload();
  await watch(p);
};
if (shots) await mkdir(shots, { recursive: true });
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = join(root, path.endsWith("/") ? `${path}index.html` : path);
  const source = coverage && /^\/editor\/dist\/([\w-]+)\.(?:js|ts)$/.exec(path);
  if (source) {
    try {
      const code = stripTypeScriptTypes(await readFile(join(root, "editor/src", `${source[1]}.ts`), "utf8"));
      return res.writeHead(200, { "content-type": "text/javascript" }).end(code);
    } catch {
      // not a source: the built file
    }
  }
  try {
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const results = [];
async function check(name, f) {
  try {
    await f();
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}\n     ${String(e.message ?? e).split("\n").slice(0, 6).join("\n     ")}`);
  }
}
const mod = process.platform === "darwin" ? "Meta" : "Control";
// colors change with a short transition: pictures and color checks wait for it
const settle = (page) => page.waitForTimeout(350);
const ready = (page) => page.waitForFunction(() => document.getElementById("editor")?.field?.shadowRoot?.querySelector("svg"));

// ---------- the page ----------

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
// the mathfonts catalog, served here: Latin Modern from the repository, and a font that does not download
const catalogUrl = "https://matheusmota-dev-br.github.io/mathfonts/catalog.json";
const latinModern = await readFile(join(root, "crates/core/fonts/latinmodern-math-subset.otf"));
const catalog = {
  version: 1,
  fonts: [
    { slug: "latin-modern", name: "Latin Modern Math", file: "fonts/lm.otf", license_file: "fonts/lm.txt", sha256: createHash("sha256").update(latinModern).digest("hex"), coverage: 90, style: "serif", base: "Computer Modern", license: "GUST" },
    { slug: "broken", name: "Broken Math", file: "fonts/broken.otf", license_file: "fonts/broken.txt", sha256: "0", coverage: 50, style: "sans", base: "none", license: "OFL" },
  ],
};
await context.route(catalogUrl, (r) => r.fulfill({ json: catalog }));
await context.route("**/mathfonts/fonts/lm.otf", (r) => r.fulfill({ body: latinModern, contentType: "font/otf" }));
await context.route("**/mathfonts/fonts/broken.otf", (r) => r.abort());
const page = await context.newPage();
await watch(page);
const errors = [];
// the font that does not download, on purpose, is the one error expected
page.on("console", (m) => m.type() === "error" && !m.location().url.endsWith("/broken.otf") && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${base}/editor/demo/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await ready(page);
const k = page.keyboard;
const ed = page.locator("#editor");
const value = () => page.evaluate(() => document.getElementById("editor").value);
const setValue = (v) => page.evaluate((v) => (document.getElementById("editor").value = v), v);
const focus = () => page.evaluate(() => document.getElementById("editor").focus());
const tab = (name) => ed.locator("mathra-toolbar").locator("[role=tab]").filter({ hasText: name });
const button = (title) => ed.locator("mathra-toolbar").locator(`button[title="${title}"]`);

await check("The editor fills the page: bar, palettes, formula, outputs beside it", async () => {
  const size = await page.evaluate(() => {
    const r = document.getElementById("editor").getBoundingClientRect();
    return [r.width, r.height, innerWidth, innerHeight];
  });
  assert.deepEqual(size.slice(0, 2), size.slice(2));
  const field = await ed.locator("mathra-field").boundingBox();
  const out = await ed.locator("mathra-output").boundingBox();
  assert.ok(out.x > field.x + field.width - 1, "the outputs are beside the formula");
  assert.ok(field.height > 300, `the formula has ${field.height}px of height`);
  assert.equal(await value(), "x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}");
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/page.png` });
});

await check("The logo and the GitHub link", async () => {
  // the logo loaded (it is an image from the site)
  await page.waitForFunction(() => { const img = document.querySelector('#editor [slot="title"] img'); return img?.complete && img.naturalWidth > 0; }, null, { timeout: 5000 });
  const gh = ed.locator("#github");
  assert.equal(await gh.getAttribute("href"), "https://github.com/matheusmota-dev-br/mathra");
  assert.equal(await gh.getAttribute("target"), "_blank");
  assert.equal(await gh.getAttribute("title"), "Código no GitHub");
  assert.equal(await gh.isVisible(), true);
  if (shots) await page.screenshot({ path: `${shots}/bar.png`, clip: { x: 0, y: 0, width: 1440, height: 60 } });
});

await check("Sixteen palettes, all their tabs in view", async () => {
  const tabs = ed.locator("mathra-toolbar").locator("[role=tab]");
  assert.equal(await tabs.count(), 16);
  for (let i = 0; i < 16; i++) assert.ok(await tabs.nth(i).isVisible(), `tab ${i} hidden`);
});

await check("A Greek letter from its tab; typing goes on in the field", async () => {
  await setValue("");
  await focus();
  await tab("Gregas").click();
  await button("alfa").click();
  await k.type("+1");
  assert.equal(await value(), "\\alpha+1");
});

await check("A structure from a palette takes the selection", async () => {
  await tab("Estruturas").click();
  await k.press(`${mod}+a`);
  await button("Raiz quadrada").click();
  assert.equal(await value(), "\\sqrt{\\alpha+1}");
});

await check("Search finds buttons across palettes; Enter inserts the first", async () => {
  await setValue("");
  const q = ed.locator("mathra-toolbar").locator("input");
  await q.fill("integral dupla");
  const found = await ed.locator("mathra-toolbar").locator(".panel button").count();
  assert.ok(found >= 1, `${found} found`);
  if (shots) await ed.locator("mathra-toolbar").screenshot({ path: `${shots}/search.png` });
  await q.press("Enter");
  assert.match(await value(), /^\\iint_\{\}/);
  await q.fill("zzzz");
  assert.equal(await ed.locator("mathra-toolbar").locator(".empty").isVisible(), true);
  await q.press("Escape");
  assert.equal(await q.inputValue(), "");
});

await check("The command menu opens on \\, filters, and Enter takes the command", async () => {
  await setValue("");
  await focus();
  await k.type("\\fr");
  await page.waitForFunction(() => !document.getElementById("editor").commandMenu.hidden);
  const items = await ed.locator("mathra-command-menu").locator(".item .name").allTextContents();
  assert.equal(items[0], "\\frac");
  await k.press("Enter");
  await k.type("1");
  await k.press("ArrowDown");
  await k.type("2");
  assert.equal(await value(), "\\frac{1}{2}");
});

await check("The outputs follow the field: MathML, speech, braille, PNG", async () => {
  const out = ed.locator("mathra-output");
  await out.locator("[role=tab]").filter({ hasText: "MathML" }).click();
  assert.match(await out.locator("pre").textContent(), /<math[\s\S]*<mfrac>/);
  await out.locator("[role=tab]").filter({ hasText: "Fala" }).click();
  assert.match(await out.locator("pre").textContent(), /fração|meio|sobre/i);
  await out.locator("[role=tab]").filter({ hasText: "Braille" }).click();
  assert.match(await out.locator("pre").textContent(), /[⠀-⣿]/);
  await out.locator("[role=tab]").filter({ hasText: "PNG" }).click();
  await out.locator("img").waitFor();
  assert.ok((await out.locator("img").evaluate((img) => img.naturalWidth)) > 20);
  await out.locator("[role=tab]").filter({ hasText: "LaTeX" }).click();
  assert.equal(await out.locator("pre").textContent(), "\\frac{1}{2}");
});

await check("Copy stays in view beside the tabs, which scroll, and copies", async () => {
  const out = ed.locator("mathra-output");
  const panel = await out.boundingBox();
  const copy = out.locator('[data-act="copy"]');
  const inView = async () => {
    const b = await copy.boundingBox();
    return b.x >= panel.x && b.x + b.width <= panel.x + panel.width + 0.5;
  };
  assert.equal(await inView(), true, "copy in view");
  // the last tab, scrolled to: copy is still in view, and the tabs keep their scroll as the formula changes
  await out.locator("[role=tab]").last().click();
  assert.equal(await inView(), true, "copy in view with the tabs scrolled");
  const scrolled = await out.locator(".tabs").evaluate((t) => t.scrollLeft);
  await focus();
  await k.type("+3");
  assert.equal(await out.locator(".tabs").evaluate((t) => t.scrollLeft), scrolled);
  await out.locator("[role=tab]").first().click();
  await copy.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await value());
  await settle(page);
  if (shots) await out.screenshot({ path: `${shots}/outputs.png` });
});

await check("The language menu: native names, keyboard, and everything follows", async () => {
  const lang = ed.locator(".language > button");
  await lang.click();
  const options = ed.locator(".language .menu [role=option]");
  assert.equal(await options.count(), 16);
  assert.equal(await ed.locator('.language .menu [aria-selected="true"]').textContent(), "Português (Brasil)pt-BR");
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/language.png`, clip: { x: 840, y: 0, width: 600, height: 620 } });
  await k.press("Escape");
  assert.equal(await ed.locator(".language .menu").count(), 0);
  await lang.click();
  await options.filter({ hasText: "English" }).click();
  await page.waitForFunction(() => document.getElementById("editor").toolbar.shadowRoot.querySelector("[role=tab]")?.textContent === "Structures");
  const out = ed.locator("mathra-output");
  await out.locator("[role=tab]").filter({ hasText: "Speech" }).click();
  assert.match(await out.locator("pre").textContent(), /half|over|fraction/i);
  assert.equal(await page.evaluate(() => localStorage.getItem("mathra-locale")), "en");
  // by keyboard: down twice from English is Español
  await lang.focus();
  await k.press("Enter");
  await k.press("ArrowDown");
  await k.press("ArrowDown");
  await k.press("Enter");
  assert.equal(await page.evaluate(() => document.getElementById("editor").getAttribute("locale")), "es");
  await lang.click();
  await options.filter({ hasText: "Português" }).click();
});

await check("The theme: system, light, dark, remembered", async () => {
  const bg = () => page.evaluate(() => getComputedStyle(document.getElementById("editor").field.shadowRoot.querySelector(".box")).backgroundColor);
  await ed.locator('[data-theme="dark"]').click();
  await settle(page);
  assert.equal(await bg(), "rgb(32, 35, 38)");
  const key = await page.evaluate(() => getComputedStyle(document.getElementById("editor").toolbar.shadowRoot.querySelector(".grid button")).backgroundColor);
  assert.equal(key, "rgb(47, 51, 54)");
  assert.equal(await ed.locator('[data-theme="dark"]').getAttribute("aria-checked"), "true");
  if (shots) await page.screenshot({ path: `${shots}/dark.png` });
  await ed.locator('[data-theme="light"]').click();
  await settle(page);
  assert.equal(await bg(), "rgb(255, 255, 255)");
  assert.equal(await page.evaluate(() => localStorage.getItem("mathra-theme")), "light");
  await reload(page);
  await ready(page);
  assert.equal(await page.evaluate(() => document.getElementById("editor").getAttribute("theme")), "light");
  await ed.locator('[data-theme="auto"]').click();
});

await check("Zoom makes the formula larger and smaller", async () => {
  await setValue("\\frac{1}{2}");
  const size = () => page.evaluate(() => document.getElementById("editor").field.shadowRoot.querySelector("svg").getBoundingClientRect().height);
  const before = await size();
  await ed.locator('[data-act="zoomIn"]').click();
  await ed.locator('[data-act="zoomIn"]').click();
  const after = await size();
  assert.ok(after > before * 1.2, `${before} → ${after}`);
  await ed.locator('[data-act="zoomOut"]').click();
  await ed.locator('[data-act="zoomOut"]').click();
});

await check("Undo, redo and clear in the bar; letters typed in a row undo together", async () => {
  await setValue("");
  await focus();
  await k.type("ab");
  await ed.locator('[data-act="undo"]').click();
  assert.equal(await value(), "");
  await ed.locator('[data-act="redo"]').click();
  assert.equal(await value(), "ab");
  await ed.locator('[data-act="clear"]').click();
  assert.equal(await value(), "");
});

await check("A drag selects, and the selection is drawn", async () => {
  await setValue("a+b+c+d");
  const svg = ed.locator("mathra-field").locator(".drawing svg");
  const b = await svg.boundingBox();
  await page.mouse.move(b.x + 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.55, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  const selected = await page.evaluate(() => document.getElementById("editor").editor.selectedLatex());
  assert.ok(selected.startsWith("a+b"), `selected ${selected}`);
  assert.equal(await ed.locator("mathra-field").locator(".selection").isVisible(), true);
});

await check("Copy and paste LaTeX through the clipboard", async () => {
  await focus();
  await k.press(`${mod}+a`);
  await k.press(`${mod}+c`);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "a+b+c+d");
  await page.evaluate(() => navigator.clipboard.writeText("\\sqrt{2}"));
  await k.press("End");
  await k.press(`${mod}+v`);
  assert.equal(await value(), "a+b+c+d\\sqrt{2}");
});

await check("The cursor follows a click", async () => {
  await setValue("xyz");
  const b = await ed.locator("mathra-field").locator(".drawing svg").boundingBox();
  await page.mouse.click(b.x + b.width * 0.36, b.y + b.height / 2);
  await k.type("w");
  assert.equal(await value(), "xwyz");
});

await check("Bhaskara by keyboard, time per change under 16 ms (p95)", async () => {
  await setValue("");
  await page.evaluate(() => (window.mathraTimes.length = 0));
  await focus();
  await k.type("x=/-b\\pm \\sqrt b^2");
  await k.press("ArrowRight");
  await k.type("-4ac");
  await k.press("ArrowDown");
  await k.type("2a");
  assert.equal(await value(), "x=\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}");
  const times = await page.evaluate(() => [...window.mathraTimes].sort((a, b) => a - b));
  const p95 = times[Math.floor(times.length * 0.95)];
  results.push(`     per change in the browser: p50 ${times[Math.floor(times.length / 2)].toFixed(2)} ms, p95 ${p95.toFixed(2)} ms over ${times.length}`);
  assert.ok(p95 < 16, `p95 ${p95}`);
});

await check("A matrix from its tab; & and Enter fill it", async () => {
  await setValue("");
  await focus();
  await tab("Matrizes").click();
  await button("Matriz 2×2").click();
  await k.type("1&0");
  // Enter at the end of a line: the start of the next one
  await k.press("Enter");
  await k.type("0&1");
  assert.equal(await value(), "\\begin{pmatrix}1 & 0 \\\\ 0 & 1\\end{pmatrix}");
  // Shift+Tab: the cell before
  await k.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.matrixAtCursor()?.j), 0);
  await button("Adicionar linha abaixo").click();
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.matrixAtCursor()?.matrix.cells.length), 3);
});

await check("The keyboard and the outputs open and close from the bar", async () => {
  await ed.locator('[data-act="keyboard"]').click();
  assert.equal(await ed.locator("mathra-keyboard").isVisible(), true);
  if (shots) {
    await settle(page);
    await page.screenshot({ path: `${shots}/keyboard.png` });
  }
  await ed.locator('[data-act="keyboard"]').click();
  await ed.locator('[data-act="outputs"]').click();
  assert.equal(await ed.locator("mathra-output").isVisible(), false);
  const field = await ed.locator("mathra-field").boundingBox();
  assert.ok(field.width > 1300, `the formula takes the room (${field.width}px)`);
  await ed.locator('[data-act="outputs"]').click();
});

await check("The gallery: every LaTeX example, search, and one opens in the editor", async () => {
  await ed.locator('[data-act="gallery"]').click();
  const gallery = ed.locator("mathra-gallery");
  await gallery.locator(".card").first().waitFor();
  assert.equal(await gallery.locator(".card").count(), 110);
  // every card shows its formula, drawn by mathra
  assert.equal(await gallery.locator(".card .formula svg").count(), 110);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/gallery.png` });
  await gallery.locator("input").fill("Euler");
  assert.ok((await gallery.locator(".card").count()) >= 1);
  await gallery.locator('.card[title="Euler\'s identity"]').click();
  assert.equal(await page.evaluate(() => document.getElementById("editor").shadowRoot.querySelector("dialog.gallery").open), false);
  assert.equal(await value(), "e^{i\\pi}+1=0");
  // it can be undone
  await ed.locator('[data-act="undo"]').click();
  assert.notEqual(await value(), "e^{i\\pi}+1=0");
  await ed.locator('[data-act="redo"]').click();
});

await check("The gallery follows its language, and leaves out a picture mathra refuses", async () => {
  const gallery = ed.locator("mathra-gallery");
  // the examples it can open: those in LaTeX, each with where it is
  const examples = await gallery.evaluate((g) => g.examples.map((e) => [e.group, e.i, e.example.input]));
  assert.equal(examples.length, 110);
  assert.ok(examples.every(([group, i, input]) => group && Number.isInteger(i) && input === "latex"));
  const before = await gallery.locator("input").getAttribute("placeholder");
  await gallery.evaluate((g) => g.setAttribute("locale", "en"));
  await page.waitForFunction((b) => document.getElementById("editor").shadowRoot.querySelector("mathra-gallery").shadowRoot.querySelector("input").placeholder !== b, before);
  await gallery.evaluate((g) => g.setAttribute("locale", "pt-BR"));
  await page.waitForFunction((b) => document.getElementById("editor").shadowRoot.querySelector("mathra-gallery").shadowRoot.querySelector("input").placeholder === b, before);
  // an example mathra refuses (here in strict mode) has no picture, and is tried again next time
  const drawn = await gallery.evaluate((g) => {
    const ex = { tex: "\\frac{1}{2} + \\foo", locale: "en", options: { strict: true } };
    return [g.picture(ex), g.drawn.has(`en\u0000${ex.tex}`)];
  });
  assert.deepEqual(drawn, ["", false]);
});

await check("mathra's options: style, braille, strict, animation, PNG size, rules", async () => {
  await ed.locator('[data-act="settings"]').click();
  const s = ed.locator("mathra-settings");
  await s.locator(".settings").waitFor();
  const opts = () => page.evaluate(() => document.getElementById("editor").field.mathraOptions);
  // style
  await s.locator('[data-set="display"][data-value="inline"]').click();
  assert.equal((await opts()).display, false);
  await s.locator('[data-set="display"][data-value="display"]').click();
  assert.equal((await opts()).display, undefined);
  // braille: Nemeth, then the language's (CMU in pt-BR)
  await s.locator('[data-set="braille"][data-value="nemeth"]').click();
  assert.equal(await page.evaluate(() => document.getElementById("editor").field.output.braille_code), "nemeth");
  await s.locator('[data-set="braille"][data-value="auto"]').click();
  assert.equal(await page.evaluate(() => document.getElementById("editor").field.output.braille_code), "cmu");
  // line breaking
  await s.locator("#breaking").check();
  assert.equal((await opts()).maxWidth, 30);
  // the width shows while the slider moves; mathra redraws once it stops
  await s.locator("#width").fill("40");
  assert.equal(await s.locator(".range output").textContent(), "40 em");
  await page.waitForFunction(() => document.getElementById("editor").field.mathraOptions.maxWidth === 40);
  await s.locator("#breaking").uncheck();
  // PNG size
  await s.locator('[data-set="png"][data-value="2"]').click();
  assert.equal(await ed.locator("mathra-output").getAttribute("png-scale"), "2");
  // the written SVG, with a button to write it again
  await s.locator("#animate").check();
  const out = ed.locator("mathra-output");
  await out.locator("[role=tab]").filter({ hasText: "SVG" }).click();
  assert.match(await out.locator(".image svg").evaluate((svg) => svg.outerHTML), /mr-f|data-step/);
  assert.equal(await out.locator('[data-act="replay"]').isVisible(), true);
  await s.locator("#animate").uncheck();
  // strict mode refuses invalid LaTeX, and says why; the box still shows it
  await s.locator("#strict").check();
  await setValue("\\frac{1}{2} + \\foo");
  assert.equal(await out.locator(".refused").isVisible(), true);
  assert.ok(await page.evaluate(() => document.getElementById("editor").field.shadowRoot.querySelector("svg") !== null));
  await s.locator("#strict").uncheck();
  // the rules mathra applied: the decimal comma of pt-BR
  await setValue("3,14");
  await out.locator("[role=tab]").filter({ hasText: "Regras" }).click();
  assert.match(await out.locator(".rules").textContent(), /L-NUM/);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/settings.png` });
});

await check("A font from the mathfonts catalog; one that does not download leaves the font as it was", async () => {
  const s = ed.locator("mathra-settings");
  await s.locator('[data-font="latin-modern"]').waitFor();
  const svg = () => page.evaluate(() => document.getElementById("editor").field.output?.svg ?? "");
  const before = await svg();
  await s.locator('[data-font="latin-modern"]').click();
  await page.waitForFunction((b) => document.getElementById("editor").field.output?.svg !== b, before);
  const latin = await svg();
  assert.equal(await s.locator('[data-font="latin-modern"]').getAttribute("aria-checked"), "true");
  await s.locator('[data-font="broken"]').click();
  await page.waitForFunction(() => document.getElementById("editor").settings.loading === "");
  assert.equal(await s.locator('[data-font="latin-modern"]').getAttribute("aria-checked"), "true");
  assert.equal(await s.locator('[data-font="broken"]').getAttribute("aria-checked"), "false");
  assert.equal(await svg(), latin);
  await s.locator('[data-font=""]').click();
  await page.waitForFunction((b) => document.getElementById("editor").field.output?.svg === b, before);
  await ed.locator('.settings-panel [data-close]').click();
  assert.equal(await page.evaluate(() => document.getElementById("editor").shadowRoot.querySelector(".settings-panel").hidden), true);
});

const dbar = ed.locator("mathra-field").locator(".dbar");
const blockPanel = ed.locator("mathra-field").locator(".block");
const blockSource = ed.locator("mathra-field").locator("textarea.src");

await check("Chemistry: \\ce typed makes a reaction of boxes; species, +, arrows and conditions typed in place", async () => {
  await setValue("");
  await focus();
  await k.type("\\ce ");
  assert.equal(await blockPanel.isVisible(), false, "no LaTeX panel");
  await k.type("2H2(g) + O2(g) ->[faísca] 2H2O(l)");
  assert.equal(await value(), "\\ce{2 H2(g) + O2(g) ->[faísca] 2 H2O(l)}");
  assert.deepEqual(await page.evaluate(() => document.getElementById("editor").field.output.warnings.map((w) => w.description)), []);
  // a species is typed as math: _ and ^ as anywhere, the charge whole over the index; the bar has no states
  await k.type(" + SO_4^{2-}");
  assert.equal(await value(), "\\ce{2 H2(g) + O2(g) ->[faísca] 2 H2O(l) + SO4^2-}");
  assert.equal(await dbar.locator('[data-run^="rxState"]').count(), 0);
  // Escape leaves the reaction: what is typed then is math after it
  await k.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.reactionAtCursor()), null);
  await k.press("ArrowLeft");
  // in the charge, the bar stays; the cursor sits over the index
  await k.press("ArrowLeft");
  assert.equal(await dbar.isVisible(), true);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/reaction.png` });
  // the cursor is drawn inside the reaction, beside a letter
  const c = await page.evaluate(() => { const f = document.getElementById("editor").field; const r = f.shadowRoot.querySelector(".caret").getBoundingClientRect(); const s = f.shadowRoot.querySelector(".drawing svg").getBoundingClientRect(); return [r.x, r.height, s.left, s.right]; });
  assert.ok(c[0] > c[2] && c[0] <= c[3] + 4 && c[1] > 4, `caret ${c}`);
});

await check("Chemistry: a click on an arrow, its kind changed from the bar; a condition below added", async () => {
  await setValue("\\ce{H2O -> H2 + O2}");
  await focus();
  const arrowAt = await page.evaluate(() => {
    const f = document.getElementById("editor").field;
    const e = document.getElementById("editor").editor;
    const a = e.root.children[0].body.children.find((p) => p.kind === "rxarrow");
    const r = f.boxes.get(a.id);
    const svg = f.shadowRoot.querySelector(".drawing svg");
    const vb = svg.viewBox.baseVal, s = svg.getBoundingClientRect();
    return [s.left + ((r.x + r.width / 2 - vb.x) / vb.width) * s.width, s.top + ((r.y + r.height / 2 - vb.y) / vb.height) * s.height];
  });
  await page.mouse.click(arrowAt[0], arrowAt[1]);
  await dbar.locator('[data-run="rxArrow:<=>"]').first().click().catch(async () => {
    // the click put the cursor beside the arrow: the bar adds one; take the arrow from the model instead
  });
  assert.match(await value(), /<=>/);
  await page.evaluate(() => { const e = document.getElementById("editor").editor; const b = e.root.children[0].body; const i = b.children.findIndex((p) => p.kind === "rxarrow"); e.setCursor({ row: b.children[i].above, offset: 0 }); });
  await dbar.locator('[data-run="rxPlace:below"]').click();
  await k.type("Pt");
  assert.match(await value(), /<=>\[\]\[Pt\]/);
  await ed.locator('[data-act="undo"]').click();
  assert.doesNotMatch(await value(), /Pt/);
});

await check("The bar beside a block shows while the field has the focus, and goes with it", async () => {
  // a formula that is one block: the cursor is always beside it
  await setValue("\\pu{123 kJ}");
  await focus();
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root, offset: 1 }); });
  await dbar.locator('[data-run="editAsLatex"]').waitFor();
  assert.equal(await dbar.isVisible(), true);
  // the focus elsewhere on the page: no bar over it
  await page.evaluate(() => document.activeElement.blur());
  assert.equal(await dbar.isVisible(), false);
  await focus();
  assert.equal(await dbar.isVisible(), true);
});

await check("Chemistry: edit a reaction as LaTeX, and back to boxes when done", async () => {
  await setValue("\\ce{H2O -> H2 + O2}");
  await focus();
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[0].body, offset: 1 }); });
  await dbar.locator('[data-run="editAsLatex"]').click();
  assert.equal(await blockPanel.isVisible(), true);
  await blockSource.fill("\\ce{2H2O -> 2H2 + O2}");
  await k.press(`${mod}+Enter`);
  assert.equal(await value(), "\\ce{2 H2O -> 2 H2 + O2}");
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.root.children[0].kind), "reaction");
});

const atomCenter = (k) => page.evaluate((k) => {
  const ed = document.getElementById("editor");
  const raw = ed.editor.root.children.find((a) => a.kind === "raw");
  const b = ed.field.boxes.get(`${raw.id}a${k}`);
  const svg = ed.field.shadowRoot.querySelector(".drawing svg");
  const vb = svg.viewBox.baseVal, s = svg.getBoundingClientRect();
  return [s.left + ((b.x + b.width / 2 - vb.x) / vb.width) * s.width, s.top + ((b.y + b.height / 2 - vb.y) / vb.height) * s.height];
}, k);

await check("Structures by keyboard: a new one, its atom typed, Alt+arrow bonds, arrows between atoms", async () => {
  await setValue("");
  await focus();
  await tab("Química").click();
  await button("Estrutura: digite o átomo, Alt+seta ou arraste para ligações").click();
  await k.type("H3C");
  await k.press("Alt+ArrowRight");
  await k.type("C");
  await k.press("Alt+ArrowUp");
  await k.type("O");
  assert.equal(await value(), "\\chemfig{H_3C-[:0]C-[:90]O}");
  // down to the carbon, then a double bond from the bar towards the lower right
  await k.press("ArrowDown");
  await dbar.locator('[data-run="chemKind:double"]').click();
  await dbar.locator('[data-run="chemBond:330"]').click();
  await k.type("O");
  assert.equal(await value(), "\\chemfig{H_3C-[:0]C(=[:-30]O)-[:90]O}");
  assert.deepEqual(await page.evaluate(() => document.getElementById("editor").field.output.warnings.map((w) => w.description)), []);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/structure-keys.png` });
});

await check("Structures: a template's R typed over; a click on a bond, its kind changed", async () => {
  await setValue("");
  await focus();
  await tab("Química").click();
  await button("Anel benzênico com substituinte R").click();
  await k.type("NO_2");
  assert.equal(await value(), "\\chemfig{*6(-=-=(-NO_2)-=)}");
  // the bond between atoms 0 and 1 of the ring
  const [a, b] = [await atomCenter(0), await atomCenter(1)];
  await page.mouse.click((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.chemSelection()?.type), "bond");
  await dbar.locator('[data-run="chemKind:double"]').click();
  assert.equal(await value(), "\\chemfig{*6(==-=(-NO_2)-=)}");
  await ed.locator('[data-act="undo"]').click();
  assert.equal(await value(), "\\chemfig{*6(-=-=(-NO_2)-=)}");
});

await check("Structures: any label in the bar's box, cleaned for chemfig; the box follows the atom picked", async () => {
  await setValue("");
  await focus();
  await tab("Química").click();
  await button("Anel benzênico com substituinte R").click();
  const box = dbar.locator("input.label");
  assert.equal(await box.inputValue(), "R");
  assert.equal(await dbar.locator(".line").count(), 4);
  await box.click();
  await box.fill("");
  await box.pressSequentially("CH_2 OH(x)");
  assert.equal(await box.inputValue(), "CH_2OHx");
  assert.equal(await value(), "\\chemfig{*6(-=-=(-CH_2OHx)-=)}");
  // the bar is not made again while the box is typed in
  assert.equal(await page.evaluate(() => document.getElementById("editor").field.shadowRoot.activeElement?.className), "label");
  // other keys stay in the box; Enter gives the formula back, the atom still picked
  await box.press("ArrowLeft");
  assert.equal(await value(), "\\chemfig{*6(-=-=(-CH_2OHx)-=)}");
  await box.press("Enter");
  assert.equal(await page.evaluate(() => document.getElementById("editor").field.shadowRoot.activeElement?.tagName), "TEXTAREA");
  await dbar.locator('button[data-run="chemLabel:N"]').click();
  assert.equal(await dbar.locator('button[data-run="chemLabel:N"]').getAttribute("aria-pressed"), "true");
  assert.equal(await box.inputValue(), "N");
  await box.click();
  await box.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("editor").field.shadowRoot.activeElement?.tagName), "TEXTAREA");
  // a keydown on a button of the bar is left to it
  await dbar.locator('button[data-run="chemLabel:C"]').focus();
  await page.keyboard.press("Shift");
  if (shots) await page.screenshot({ path: `${shots}/structure-bar.png` });
});

await check("Schemes: a click on an arrow shows the boxes over and under it; one clicked takes the conditions", async () => {
  await setValue("\\schemestart \\chemfig{A} \\arrow{->} \\chemfig{B} \\schemestop");
  await focus();
  const empties = () => page.evaluate(() => [...document.getElementById("editor").field.shadowRoot.querySelectorAll(".drawing [data-empty]")].map((g) => { const r = g.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  assert.equal((await empties()).length, 0);
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[0].body, offset: 1 }); });
  const boxes = (await empties()).sort((a, b) => a[1] - b[1]);
  assert.equal(boxes.length, 2);
  assert.equal(await dbar.locator('[data-run="rxPlace:above"]').count(), 1);
  await page.mouse.click(boxes[1][0], boxes[1][1]);
  await k.type("cat");
  assert.equal(await value(), "\\schemestart \\chemfig{A} \\arrow{->[][cat]} \\chemfig{B} \\schemestop");
  // away from the arrow, the empty box goes
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[0].body, offset: 0 }); });
  assert.equal((await empties()).length, 0);
});

await check("Structures by mouse: a drag from an atom draws a bond; a click picks an atom", async () => {
  await setValue("\\chemfig{A-B}");
  await focus();
  const b = await atomCenter(1);
  // the kind the bar draws stays as last picked: single again
  await page.mouse.click(b[0], b[1]);
  await dbar.locator('[data-run="chemKind:single"]').click();
  await page.mouse.move(b[0], b[1]);
  await page.mouse.down();
  await page.mouse.move(b[0] + 40, b[1] - 23, { steps: 3 });
  await page.mouse.move(b[0] + 87, b[1] - 50, { steps: 3 });
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/structure-drag.png` });
  await page.mouse.up();
  await k.type("OH");
  assert.equal(await value(), "\\chemfig{A-B-[:30]OH}");
  const a = await atomCenter(0);
  await page.mouse.click(a[0], a[1]);
  await k.type("X");
  assert.equal(await value(), "\\chemfig{X-B-[:30]OH}");
  await k.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.chemSelection()), null);
});

await check("Schemes: a structure, a space, an arrow with conditions, the next structure; the bar's arrows", async () => {
  await setValue("");
  await focus();
  await tab("Química").click();
  await button("Esquema de reação: estruturas e setas; -> entre elas, [ para as condições").click();
  await k.type("A");
  await k.press("Alt+ArrowRight");
  await k.type("B");
  await k.type(" ->[calor]");
  // ] leaves the conditions: the next letter starts the next structure
  await k.type("C");
  assert.equal(await value(), "\\schemestart \\chemfig{A-[:0]B} \\arrow{->[calor]} \\chemfig{C} \\schemestop");
  // the arrow: picked by moving onto it, its kind from the bar
  await k.press("Escape");
  await page.evaluate(() => { const e = document.getElementById("editor").editor; const b = e.root.children[0].body; e.setCursor({ row: b, offset: 2 }); });
  await dbar.locator('[data-run="rxArrow:<=>"]').click();
  assert.match(await value(), /\\arrow\{<=>\[calor\]\}/);
  await dbar.locator('[data-run="rxStructure"]').click();
  await k.type("D");
  assert.match(await value(), /\\arrow\{<=>\[calor\]\} \\chemfig\{D\} \\chemfig\{C\}/);
  assert.deepEqual(await page.evaluate(() => document.getElementById("editor").field.output.warnings.map((w) => w.description)), []);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/scheme.png` });
});

await check("Chemistry: Esc takes the edit back; Enter beside a block opens it", async () => {
  await setValue("\\chemfig{A-B}");
  await focus();
  await k.press("End");
  await k.press("Enter");
  assert.equal(await blockPanel.isVisible(), true);
  await blockSource.fill("\\chemfig{A=B}");
  assert.equal(await value(), "\\chemfig{A=B}");
  await k.press("Escape");
  assert.equal(await value(), "\\chemfig{A-B}");
  assert.equal(await blockPanel.isVisible(), false);
});


await check("Diagrams by keyboard: a new one, Alt+arrow draws arrows, labels typed in place", async () => {
  await setValue("");
  await focus();
  await tab("Diagramas").click();
  await button("Diagrama novo: digite na célula, Alt+seta cria uma seta").click();
  await k.type("A");
  await k.press("Alt+ArrowRight");
  await k.type("f");
  await k.press("ArrowRight");
  await k.type("B");
  await k.press("Alt+Shift+ArrowDown");
  await k.type("g");
  assert.equal(await value(), '\\begin{tikzcd}A \\arrow[r, "f"] & B \\arrow[d, "g", dashed] \\\\ & {}\\end{tikzcd}');
  // mathra draws all of it: no warning (an empty line reached by an arrow is kept)
  assert.deepEqual(await page.evaluate(() => document.getElementById("editor").field.output.warnings.map((w) => w.description)), []);
  // on an arrow, its bar of styles
  assert.equal(await dbar.locator('[data-run="arrowStyle:dashed"]').getAttribute("aria-pressed"), "true");
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/diagram-keys.png` });
});

await check("Diagrams by mouse: a drag from one cell to another draws an arrow; a click on an arrow edits it", async () => {
  // the cells are outlined while the cursor is in the diagram: A, B, (empty), (empty)
  const cells = await page.evaluate(() => {
    const f = document.getElementById("editor").field;
    return [...f.shadowRoot.querySelectorAll(".dgov rect")].map((r) => { const b = r.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  });
  assert.equal(cells.length, 4, "four cells outlined");
  const [, B, C] = cells;
  // from B down-left to the empty cell
  await page.mouse.move(B[0], B[1]);
  await page.mouse.down();
  await page.mouse.move((B[0] + C[0]) / 2, (B[1] + C[1]) / 2, { steps: 4 });
  await page.mouse.move(C[0], C[1], { steps: 4 });
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/diagram-drag.png` });
  await page.mouse.up();
  await k.type("h");
  assert.match(await value(), /B \\arrow\[d, "g", dashed\] \\arrow\[dl, "h"\]/);
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.selection()), null, "the drag selected nothing");
  assert.deepEqual(await page.evaluate(() => document.getElementById("editor").field.output.warnings.map((w) => w.description)), []);
  // a click on the arrow f: its label, and the bar to restyle it
  const f = await page.evaluate(() => {
    const field = document.getElementById("editor").field;
    const r = [...field.shadowRoot.querySelectorAll(".dgov rect")].map((x) => x.getBoundingClientRect());
    return [(r[0].right + r[1].left) / 2, (r[0].top + r[0].bottom) / 2];
  });
  await page.mouse.click(f[0], f[1]);
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.arrowAtCursor()?.index), 0);
  await dbar.locator('[data-run="arrowStyle:hook"]').click();
  await dbar.locator('[data-run="arrowBend:left"]').click();
  assert.match(await value(), /A \\arrow\[r, "f", hook, bend left\]/);
  await dbar.locator('[data-run="arrowRemove"]').click();
  assert.doesNotMatch(await value(), /"f"/);
});

await check("Diagrams: the gallery's amscd square, a cell edited, stays amscd", async () => {
  await setValue("\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>k>> D \\end{CD}");
  await focus();
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[0].cells[1][1], offset: 1 }); });
  assert.equal(await ed.locator("mathra-field").locator(".dgov rect").count(), 4);
  await k.type("'");
  assert.equal(await value(), "\\begin{CD} A @>f>> B \\\\ @VgVV @VVhV \\\\ C @>k>> D' \\end{CD}");
});

await check("Diagrams: edit as LaTeX, and back to boxes when done", async () => {
  await dbar.locator('[data-run="editAsLatex"]').click();
  assert.equal(await blockPanel.isVisible(), true);
  const src = await blockSource.inputValue();
  await blockSource.fill(src.replace("@>f>>", "@>\\varphi>>"));
  await k.press(`${mod}+Enter`);
  assert.match(await value(), /varphi/);
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.root.children[0].kind), "diagram");
});

await check("Diagrams: a square from its palette, a label retyped in place", async () => {
  await setValue("");
  await focus();
  await tab("Diagramas").click();
  await button("Quadrado comutativo").click();
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.selectArrow(e.root.children[0], 0); });
  await k.press("Backspace");
  await k.type("\\varphi ");
  assert.match(await value(), /"\\varphi"/);
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root, offset: 1 }); });
  // the cursor sits after the diagram, at its right edge
  const c = await page.evaluate(() => { const f = document.getElementById("editor").field; return [f.shadowRoot.querySelector(".caret").getBoundingClientRect().x, f.shadowRoot.querySelector(".drawing svg").getBoundingClientRect().right]; });
  assert.ok(Math.abs(c[0] - c[1]) < 6, `caret at ${c[0]}, diagram ends at ${c[1]}`);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/diagram.png` });
});

await check("Diagrams: every gallery diagram and reaction keeps its cursor in the drawing", async () => {
  const bad = await page.evaluate(async () => {
    const { GALLERY } = await import("/editor/dist/gallery.js");
    const ed = document.getElementById("editor");
    const out = [];
    for (const g of GALLERY.filter((g) => ["reactions", "chemistry", "diagrams"].includes(g.id)))
      for (const r of g.rows) {
        ed.value = r.tex;
        await new Promise((res) => requestAnimationFrame(res));
        const f = ed.field;
        const c = f.shadowRoot.querySelector(".caret").getBoundingClientRect();
        const s = f.shadowRoot.querySelector(".drawing svg").getBoundingClientRect();
        if (Math.abs(c.x - s.right) > 6) out.push(r.name || r.caption);
      }
    return out;
  });
  assert.deepEqual(bad, []);
});

await check("Keys: Shift+arrows, Home and End select; Delete; Up back into the numerator", async () => {
  await setValue("abcd");
  await focus();
  await k.press("End");
  await k.press("Shift+ArrowLeft");
  await k.press("Shift+ArrowLeft");
  await k.type("x");
  assert.equal(await value(), "abx");
  await k.press("Home");
  await k.press("Shift+ArrowRight");
  await k.type("y");
  assert.equal(await value(), "ybx");
  await k.press("Home");
  await k.press("Delete");
  assert.equal(await value(), "bx");
  await k.press("Shift+End");
  await k.type("z");
  assert.equal(await value(), "z");
  await k.press("Shift+Home");
  await k.type("w");
  assert.equal(await value(), "w");
  await setValue("");
  await k.type("/1");
  await k.press("ArrowDown");
  await k.type("2");
  await k.press("ArrowUp");
  await k.type("3");
  assert.equal(await value(), "\\frac{13}{2}");
});

await check("Escape leaves a command being typed, then a selection; Mod+X cuts", async () => {
  await setValue("ab");
  await focus();
  await k.press("End");
  await k.type("\\fr");
  await page.waitForFunction(() => !document.getElementById("editor").commandMenu.hidden);
  // one Escape: the command and its menu go
  await k.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("editor").commandMenu.hidden), true);
  await k.type("c");
  assert.equal(await value(), "abc");
  await k.press("Shift+Home");
  await k.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.selection()), null);
  await k.press(`${mod}+a`);
  await k.press(`${mod}+x`);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "abc");
  assert.equal(await value(), "");
});

await check("The command menu: arrows choose, a click takes, nothing found says so", async () => {
  const menu = ed.locator("mathra-command-menu");
  await setValue("");
  await focus();
  await k.type("\\fr");
  await page.waitForFunction(() => !document.getElementById("editor").commandMenu.hidden);
  const chosen = () => menu.locator('.item[aria-selected="true"] .name').textContent();
  const names = await menu.locator(".item .name").allTextContents();
  await k.press("ArrowDown");
  assert.equal(await chosen(), names[1]);
  await k.press("ArrowUp");
  await k.press("ArrowUp");
  assert.equal(await chosen(), names.at(-1), "up from the first is the last");
  await k.press("ArrowDown");
  await k.press("Backspace");
  await k.press("Backspace");
  await k.type("zzq");
  assert.equal(await menu.locator(".none").textContent(), "Nenhum comando com esse nome");
  await k.press("ArrowDown");
  await k.press("Escape");
  assert.equal(await menu.isHidden(), true);
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.commandBeingTyped()), null);
  await setValue("");
  await focus();
  await k.type("\\sqrt");
  await page.waitForFunction(() => !document.getElementById("editor").commandMenu.hidden);
  await menu.locator(".item").filter({ hasText: "\\sqrt" }).first().click();
  await k.type("2");
  assert.equal(await value(), "\\sqrt{2}");
  assert.equal(await menu.isHidden(), true);
});

await check("The field's calls: insert, insertLatex, insertSymbol, run, and blur sends change", async () => {
  await setValue("");
  await focus();
  const got = await page.evaluate(() => {
    const f = document.getElementById("editor").field;
    let changed = null;
    f.addEventListener("change", (e) => (changed = e.detail.latex), { once: true });
    f.insert("sqrt");
    f.run("type:2");
    f.run("moveRight");
    f.insert("sup");
    f.insertLatex("\\pi");
    f.run("moveRight");
    f.insertSymbol("\\alpha");
    f.run("symbol:\\beta");
    f.blur();
    return [f.value, changed, f.shadowRoot.activeElement === null];
  });
  assert.deepEqual(got, ["\\sqrt{2}^{\\pi}\\alpha\\beta", "\\sqrt{2}^{\\pi}\\alpha\\beta", true]);
});

await check("Exponent, index and a matrix's lines and columns from the palettes", async () => {
  await setValue("x");
  await focus();
  await k.press("End");
  await tab("Estruturas").click();
  await button("Expoente").click();
  await k.type("2");
  await k.press("ArrowRight");
  await button("Índice").click();
  await k.type("i");
  assert.equal(await value(), "x^{2}_{i}");
  await setValue("");
  await focus();
  await tab("Matrizes").click();
  await button("Matriz 2×2").click();
  const size = () => page.evaluate(() => { const m = document.getElementById("editor").editor.matrixAtCursor().matrix; return [m.cells.length, m.cells[0].length]; });
  await button("Adicionar linha acima").click();
  assert.deepEqual(await size(), [3, 2]);
  await button("Adicionar coluna à direita").click();
  assert.deepEqual(await size(), [3, 3]);
  await button("Adicionar coluna à esquerda").click();
  assert.deepEqual(await size(), [3, 4]);
  await button("Remover esta linha").click();
  assert.deepEqual(await size(), [2, 4]);
  await button("Remover esta coluna").click();
  assert.deepEqual(await size(), [2, 3]);
});

await check("A formula wider or taller than the box: the box keeps its place and scrolls; the page does not widen", async () => {
  await setValue("\\ce{^{238}_{92}U ->[$\\alpha$][\\qty{4.47e9}{y}] ^{234}_{90}Th ->[$\\beta^-$][\\qty{24.1}{d}] ^{234m}_{91}Pa ->[$\\beta^-$][\\qty{1.17}{min}] ^{234}_{92}U ->[$\\alpha$][\\qty{2.45e5}{y}] ^{230}_{90}Th ->[$\\alpha$][\\qty{7.54e4}{y}] ^{226}_{88}Ra}");
  await focus();
  const m = () => page.evaluate(() => {
    const f = document.getElementById("editor").field;
    const box = f.shadowRoot.querySelector(".box");
    const side = document.getElementById("editor").shadowRoot.querySelector(".side").getBoundingClientRect();
    return { right: box.getBoundingClientRect().right, side: side.left, client: box.clientWidth, scroll: box.scrollWidth, page: document.documentElement.scrollWidth, view: innerWidth, h: box.clientHeight, sh: box.scrollHeight };
  });
  let r = await m();
  assert.ok(r.right <= r.side, `the box reaches ${r.right}, the outputs start at ${r.side}`);
  assert.ok(r.scroll > r.client, "it scrolls");
  assert.ok(r.page <= r.view, "the page does not widen");
  // the isotopes are written as they were
  assert.match(await value(), /^\\ce\{\^\{238\}_\{92\}U/);
  // taller than the box: it scrolls down, its top in reach
  await setValue(`\\begin{aligned}${Array.from({ length: 30 }, (_, i) => `x_{${i}}`).join("\\\\")}\\end{aligned}`);
  r = await m();
  assert.ok(r.sh > r.h, "taller than the box");
});

await check("A matrix of any size from a grid; inside one, the grid gives it a size; Shift+Enter adds a column", async () => {
  const picker = () => ed.locator("mathra-toolbar").locator(".matrix-picker");
  const cell = (i, j) => picker().locator(`.cell[data-i="${i}"][data-j="${j}"]`);
  const any = button("Matriz de qualquer tamanho (ou o tamanho desta)");
  await setValue("A=");
  await focus();
  await k.press("End");
  await tab("Matrizes").click();
  await any.click();
  assert.equal(await picker().locator(".title").textContent(), "Inserir matriz");
  // the pointer says the size; the grid grows at its edge
  await cell(2, 3).hover();
  assert.equal(await picker().locator(".size").textContent(), "3 × 4");
  await cell(5, 7).hover();
  assert.equal(await picker().locator(".cell").count(), 7 * 9);
  if (shots) await page.screenshot({ path: `${shots}/matrix-picker.png` });
  await cell(2, 3).hover();
  await picker().locator('[data-env="bmatrix"]').click();
  await cell(2, 3).click();
  await picker().waitFor({ state: "detached" });
  assert.equal(await value(), "A=\\begin{bmatrix} & & & \\\\ & & & \\\\ & & & \\end{bmatrix}");
  // inside it: its size to start, the arrows and Enter; cells with something cut are said
  await k.type("1");
  await k.press("Tab");
  await k.type("2");
  await any.click();
  assert.equal(await picker().locator(".title").textContent(), "Tamanho desta matriz");
  assert.equal(await picker().locator(".size").textContent(), "3 × 4");
  const grid = picker().locator(".cells");
  await grid.press("ArrowRight");
  await grid.press("ArrowUp");
  await grid.press("x");
  assert.equal(await picker().locator(".size").textContent(), "2 × 5");
  await grid.press("ArrowLeft");
  await grid.press("ArrowLeft");
  await grid.press("ArrowLeft");
  await grid.press("ArrowLeft");
  await grid.press("ArrowLeft");
  assert.equal(await picker().locator(".warn").textContent(), "células com conteúdo serão removidas");
  await grid.press("ArrowDown");
  for (let i = 0; i < 4; i++) await grid.press("ArrowRight");
  assert.equal(await picker().locator(".warn").textContent(), "");
  await grid.press("Enter");
  assert.equal(await value(), "A=\\begin{bmatrix}1 & 2 & & & \\\\ & & & & \\\\ & & & & \\end{bmatrix}");
  // in a diagram with arrows: smaller, the arrows to cells that go are said too
  await setValue('\\begin{tikzcd}A \\arrow[r] & B \\arrow[d] \\\\ & C\\end{tikzcd}');
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[0].cells[0][0], offset: 1 }); });
  await any.click();
  await picker().locator(".cells").press("ArrowUp");
  assert.equal(await picker().locator(".warn").textContent(), "células com conteúdo ou setas serão removidas");
  await picker().locator(".cells").press("Escape");
  await setValue("A=\\begin{bmatrix}1 & 2 & & & \\\\ & & & & \\\\ & & & & \\end{bmatrix}");
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[2].cells[0][0], offset: 1 }); });
  // a delimiter, at once; Escape gives the field back
  await any.click();
  await picker().locator('[data-env="vmatrix"]').click();
  assert.match(await value(), /^A=\\begin\{vmatrix\}/);
  await picker().locator(".delims").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Escape");
  await picker().waitFor({ state: "detached" });
  await page.waitForFunction(() => document.getElementById("editor").field.shadowRoot.activeElement);
  await k.press("Shift+Enter");
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.matrixAtCursor().matrix.cells[0].length), 6);
  // Space picks too; a click on the grid's gap picks the size shown
  await setValue("");
  await focus();
  await any.click();
  await picker().locator(".cells").press(" ");
  assert.equal(await value(), "\\begin{pmatrix}\\end{pmatrix}");
  await setValue("");
  await focus();
  await any.click();
  await picker().locator(".cells").click({ position: { x: 20, y: 0 } });
  assert.match(await value(), /^\\begin\{pmatrix\}/);
  // from the search, Enter opens it
  await setValue("");
  const q = ed.locator("mathra-toolbar").locator("input");
  await q.fill("qualquer tamanho");
  await q.press("Enter");
  assert.equal(await picker().count(), 1);
  await page.keyboard.press("Escape");
  await q.fill("");
});

await check("Diagrams: a drag past the cells draws an arrow to a new cell that way (a diagonal too)", async () => {
  await setValue("\\begin{tikzcd}A \\arrow[r] & B\\end{tikzcd}");
  await focus();
  const b = await page.evaluate(() => {
    const f = document.getElementById("editor").field;
    const id = f.editor.root.children[0].cells[0][1].id;
    const g = [...f.shadowRoot.querySelectorAll(".drawing [data-m]")].find((x) => x.getAttribute("data-m") === id).getBoundingClientRect();
    return [g.x + g.width / 2, g.y + g.height / 2];
  });
  await page.mouse.move(b[0], b[1]);
  await page.mouse.down();
  await page.mouse.move(b[0] + 60, b[1] + 60, { steps: 4 });
  await page.mouse.move(b[0] + 150, b[1] + 130, { steps: 4 });
  // while drawing, the new cell shows and the bar is out of the way
  assert.equal(await ed.locator("mathra-field").locator(".dgov .cell.target").count(), 1);
  assert.equal(await dbar.isVisible(), false);
  // too near the cell: nothing yet
  await page.mouse.move(b[0] + 10, b[1] + 8, { steps: 2 });
  assert.equal(await ed.locator("mathra-field").locator(".dgov .cell.target").count(), 0);
  await page.mouse.move(b[0] + 150, b[1] + 130, { steps: 4 });
  await page.mouse.up();
  await k.type("h");
  assert.equal(await value(), '\\begin{tikzcd}A \\arrow[r] & B \\arrow[dr, "h"] & \\\\ & & {}\\end{tikzcd}');
  // Escape: out of the label, back to the cell the arrow leaves
  await k.press("Escape");
  assert.deepEqual(await page.evaluate(() => { const e = document.getElementById("editor").editor; const m = e.matrixAtCursor(); return [!!e.arrowAtCursor(), m?.i, m?.j]; }), [false, 0, 1]);
});

await check("Chemistry: undo after an edit as LaTeX goes back to the pieces; a \\pu from the palette is typed in its panel", async () => {
  await setValue("");
  await focus();
  await k.type("\\ce SO4^2-");
  await dbar.locator('[data-run="editAsLatex"]').click();
  await blockSource.fill("\\ce{SO4^2- + Ba^2+}");
  await blockSource.press(`${mod}+Enter`);
  await k.press(`${mod}+z`);
  await k.type("x");
  assert.match(await value(), /^\\ce\{SO4\^2-.*x/);
  await setValue("");
  await focus();
  await tab("Química").click();
  await ed.locator("mathra-toolbar").locator("button").filter({ hasText: "" }).nth(0);
  const i = await ed.locator("mathra-toolbar").locator("button").evaluateAll((bs) => bs.findIndex((b) => /\\pu/.test(b.title)));
  await ed.locator("mathra-toolbar").locator("button").nth(i).click();
  await k.type("123 kJ/mol");
  assert.equal(await blockSource.inputValue(), "\\pu{123 kJ/mol}");
  await blockSource.press("Escape");
});

await check("A block of LaTeX (siunitx's \\qty) has a bar to edit it as written; a physics matrix is edited in its cells", async () => {
  await setValue("E=\\qty{1.10}{\\volt}");
  await focus();
  assert.match(await dbar.textContent(), /Editar como LaTeX/);
  await dbar.locator('[data-run="editAsLatex"]').click();
  await blockSource.fill("\\qty{1.20}{\\volt}");
  await blockSource.press(`${mod}+Enter`);
  assert.equal(await value(), "E=\\qty{1.20}{\\volt}");
  await setValue("\\bmqty{a & b \\\\ c & d}");
  await focus();
  const at = await page.evaluate(() => { const f = document.getElementById("editor").field; const id = f.editor.root.children[0].cells[1][1].children[0].id; const g = [...f.shadowRoot.querySelectorAll(".drawing [data-m]")].find((x) => x.getAttribute("data-m") === id).getBoundingClientRect(); return [g.right - 1, g.y + g.height / 2]; });
  await page.mouse.click(at[0], at[1]);
  await k.type("+1");
  assert.equal(await value(), "\\bmqty{a & b \\\\ c & d+1}");
});

await check("Diagrams: Alt+Left and Alt+Up draw arrows; a label moved to the other side", async () => {
  await setValue("");
  await focus();
  await tab("Diagramas").click();
  await button("Diagrama novo: digite na célula, Alt+seta cria uma seta").click();
  await k.type("A");
  await k.press("Alt+ArrowRight");
  await k.press("ArrowRight");
  await k.type("B");
  await k.press("Alt+ArrowLeft");
  await k.type("g");
  await dbar.locator('[data-run="arrowSwap"]').click();
  await page.evaluate(() => { const e = document.getElementById("editor").editor; e.setCursor({ row: e.root.children[0].cells[0][1], offset: 1 }); });
  await k.press("Alt+ArrowUp");
  assert.equal(await value(), '\\begin{tikzcd}& {} \\\\ A \\arrow[r] & B \\arrow[l, "g"\'] \\arrow[u]\\end{tikzcd}');
});

await check("Structures from the bar: an element, a ring, removed; edited as LaTeX, cancelled", async () => {
  await setValue("\\chemfig{A-B}");
  await focus();
  const b = await atomCenter(1);
  await page.mouse.click(b[0], b[1]);
  await dbar.locator('[data-run="chemLabel:O"]').click();
  assert.equal(await value(), "\\chemfig{A-O}");
  await dbar.locator('[data-run="chemRing:6"]').click();
  assert.equal(await value(), "\\chemfig{A-O*6(------)}");
  await ed.locator('[data-act="undo"]').click();
  await page.mouse.click(b[0], b[1]);
  await dbar.locator('[data-run="chemRemove"]').click();
  assert.equal(await value(), "\\chemfig{A}");
  const a = await atomCenter(0);
  await page.mouse.click(a[0], a[1]);
  await dbar.locator('[data-run="editAsLatex"]').click();
  assert.equal(await blockPanel.isVisible(), true);
  await blockSource.click();
  await blockSource.fill("\\chemfig{A=C}");
  await blockPanel.locator('[data-block="cancel"]').click();
  assert.equal(await blockPanel.isVisible(), false);
  assert.equal(await value(), "\\chemfig{A}");
});

await check("Reactions from the bar: a sign added, a piece removed", async () => {
  await setValue("\\ce{H2O -> H2 + O2}");
  await focus();
  await page.evaluate(() => { const e = document.getElementById("editor").editor; const b = e.root.children[0].body; e.setCursor({ row: b, offset: b.children.length }); });
  await dbar.locator('[data-run="rxSign:^"]').click();
  assert.equal(await value(), "\\ce{H2O -> H2 + O2 ^}");
  await dbar.locator('[data-run="rxRemove"]').click();
  assert.equal(await value(), "\\ce{H2O -> H2 + O2}");
});

await check("A block's LaTeX: Done, its warnings and errors as typed; a double click opens it, or selects the line", async () => {
  await setValue("");
  await focus();
  await tab("Química").click();
  await button("Unidade física (mhchem \\\\pu)").click();
  assert.equal(await blockPanel.isVisible(), true);
  await blockSource.fill("\\pu{5 kJ}");
  await blockPanel.locator('[data-block="done"]').click();
  assert.equal(await value(), "\\pu{5 kJ}");
  const svg = ed.locator("mathra-field").locator(".drawing svg");
  await svg.dblclick();
  assert.equal(await blockPanel.isVisible(), true);
  const status = blockPanel.locator(".status");
  await blockSource.fill("\\pu{5 kJ} \\foo");
  assert.equal(await status.getAttribute("class"), "status warn");
  assert.match(await status.textContent(), /foo/);
  await blockSource.fill(`${"{".repeat(70)}x${"}".repeat(70)}`);
  assert.match(await status.textContent(), /nesting/);
  await k.press("Escape");
  assert.equal(await value(), "\\pu{5 kJ}");
  await setValue("a+b");
  await svg.dblclick();
  assert.equal(await page.evaluate(() => document.getElementById("editor").editor.selectedLatex()), "a+b");
  // in a structure, a double click picks an atom and opens nothing
  await setValue("\\chemfig{A-B}");
  const at = await atomCenter(0);
  await page.mouse.dblclick(at[0], at[1]);
  assert.equal(await blockPanel.isVisible(), false);
  await k.press("Escape");
});

await check("Deep formulas: drawn around an empty diagram; too deep to draw with the cursor, the last drawing stays", async () => {
  const drawn = () => page.evaluate(() => document.getElementById("editor").field.shadowRoot.querySelector(".drawing").innerHTML);
  const deep = `${"x^{".repeat(14)}\\begin{tikzcd} \\arrow[r] & \\end{tikzcd}${"}".repeat(14)}+y`;
  await setValue(deep);
  // the empty cells an arrow reaches are written {}
  assert.equal(await value(), deep.replace("{tikzcd} \\arrow[r] & \\end", "{tikzcd}{} \\arrow[r] & {}\\end"));
  assert.match(await drawn(), /^<svg/);
  // ten roots: mathra reads the formula, but not with the cursor's marks around each piece
  await setValue("1");
  const before = await drawn();
  const roots = `${"\\sqrt{".repeat(10)}x${"}".repeat(10)}`;
  await setValue(roots);
  assert.equal(await value(), roots);
  assert.equal(await drawn(), before);
  assert.ok(await page.evaluate(() => document.getElementById("editor").field.output.mathml.includes("<msqrt>")));
});

await check("Outputs: the SVG written again, copied, downloaded; the PNG copied and downloaded; the rules copied", async () => {
  const out = ed.locator("mathra-output");
  const s = ed.locator("mathra-settings");
  await setValue("\\frac{1}{2}");
  await ed.locator('[data-act="settings"]').click();
  await s.locator("#animate").check();
  await out.locator("[role=tab]").filter({ hasText: "SVG" }).click();
  await out.locator('[data-act="replay"]').click();
  assert.equal(await out.locator(".image svg").count(), 1);
  await s.locator("#animate").uncheck();
  // Escape in the options closes them
  await s.locator("#animate").focus();
  await k.press("Escape");
  assert.equal(await page.evaluate(() => document.getElementById("editor").shadowRoot.querySelector(".settings-panel").hidden), true);
  const copy = out.locator('[data-act="copy"]');
  await copy.click();
  await page.waitForFunction(() => document.getElementById("editor").outputPanel.shadowRoot.querySelector('[data-act="copy"] span')?.textContent === "Copiado");
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^<svg/);
  const [svgFile] = await Promise.all([page.waitForEvent("download"), out.locator('[data-act="download"]').click()]);
  assert.equal(svgFile.suggestedFilename(), "formula.svg");
  assert.match(await readFile(await svgFile.path(), "utf8"), /^<svg/);
  await out.locator("[role=tab]").filter({ hasText: "PNG" }).click();
  await copy.click();
  await page.waitForFunction(() => document.getElementById("editor").outputPanel.shadowRoot.querySelector('[data-act="copy"] span')?.textContent === "Copiado");
  assert.deepEqual(await page.evaluate(async () => (await navigator.clipboard.read())[0].types), ["image/png"]);
  const [pngFile] = await Promise.all([page.waitForEvent("download"), out.locator('[data-act="download"]').click()]);
  assert.equal(pngFile.suggestedFilename(), "formula.png");
  assert.deepEqual([...(await readFile(await pngFile.path())).subarray(1, 4)], [0x50, 0x4e, 0x47]);
  assert.match(await page.evaluate(() => document.getElementById("editor").outputPanel.text("png")), /^data:image\/png;base64,/);
  await setValue("3,14+\\foo");
  await out.locator("[role=tab]").filter({ hasText: "Regras" }).click();
  await copy.click();
  await page.waitForFunction(() => document.getElementById("editor").outputPanel.shadowRoot.querySelector('[data-act="copy"] span')?.textContent === "Copiado");
  const rules = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
  const { applied, warnings } = await page.evaluate(() => document.getElementById("editor").field.output);
  assert.ok(applied.length && warnings.length, "rules applied and warnings");
  assert.deepEqual(rules, [...applied, ...warnings].map((r) => `${r.rule}: ${r.description}`));
});

await check("Outputs without the clipboard: the text is selected to copy by hand", async () => {
  const out = ed.locator("mathra-output");
  await setValue("a+b");
  await out.locator("[role=tab]").filter({ hasText: "LaTeX" }).click();
  await page.evaluate(() => (navigator.clipboard.writeText = () => Promise.reject(new Error("denied"))));
  await out.locator('[data-act="copy"]').click();
  await page.waitForFunction(() => getSelection().toString() === "a+b");
  await page.evaluate(() => delete navigator.clipboard.writeText);
});

await check("No error in the console", async () => {
  assert.deepEqual(errors, []);
});
await collect(page);
await context.close();

// ---------- without the font catalog ----------

const offline = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await offline.route(catalogUrl, (r) => r.abort());
const p4 = await offline.newPage();
await watch(p4);
await p4.goto(`${base}/editor/demo/`);
await ready(p4);
await check("Without the font catalog, the options say so and keep working", async () => {
  const ed4 = p4.locator("#editor");
  await ed4.locator('[data-act="settings"]').click();
  const note = ed4.locator("mathra-settings").locator(".note").last();
  await p4.waitForFunction(() => document.getElementById("editor").settings.fontsFailed === true);
  assert.ok((await note.textContent()).length > 0);
  assert.equal(await ed4.locator("mathra-settings").locator(".fonts").count(), 0);
  await ed4.locator("mathra-settings").locator('[data-set="display"][data-value="inline"]').click();
  assert.equal(await p4.evaluate(() => document.getElementById("editor").field.mathraOptions.display), false);
});
await collect(p4);
await offline.close();

// ---------- the pieces alone ----------

const alone = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const p3 = await alone.newPage();
await watch(p3);
await p3.goto(`${base}/editor/test/components.html`);
await p3.waitForFunction(() => document.getElementById("b")?.shadowRoot?.querySelector("svg"));
const v3 = (id) => p3.evaluate((id) => document.getElementById(id).value, id);
await check("Field and command menu alone: the placeholder, then a sum", async () => {
  assert.equal(await p3.locator("#b").locator(".placeholder").isVisible(), true);
  await p3.evaluate(() => document.getElementById("b").focus());
  await p3.keyboard.type("\\sum");
  await p3.waitForFunction(() => !document.querySelector('mathra-command-menu[for="b"]').hidden);
  await p3.keyboard.press("Enter");
  await p3.keyboard.type("k=1");
  await p3.keyboard.press("Tab");
  await p3.keyboard.type("n");
  await p3.keyboard.press("Tab");
  await p3.keyboard.type("k");
  assert.equal(await v3("b"), "\\sum_{k=1}^{n}k");
});
await check("Inline field and keyboard alone", async () => {
  const key = (title) => p3.locator('mathra-keyboard[for="c"]').locator(`button[title="${title}"]`);
  await p3.evaluate(() => document.getElementById("c").focus());
  await key("Fração").click();
  await key("8").click();
  await key("Mover para baixo").click();
  await key("3").click();
  assert.equal(await v3("c"), "\\frac{8}{3}");
  assert.equal(await p3.locator("#c-result").textContent(), "certo");
});
await check("Keyboard alone: letters, capitals for one key, layers by attribute and of your own", async () => {
  const kb = p3.locator('mathra-keyboard[for="c"]');
  const key = (title) => kb.locator(`button[title="${title}"]`);
  await p3.evaluate(() => (document.getElementById("c").value = ""));
  await p3.evaluate(() => document.getElementById("c").focus());
  await key("Letras").click();
  await key("Maiúsculas").click();
  assert.equal(await key("Maiúsculas").getAttribute("aria-pressed"), "true");
  await key("a").click();
  await key("b").click();
  assert.equal(await v3("c"), "Ab");
  assert.equal(await key("Maiúsculas").getAttribute("aria-pressed"), "false");
  // layers="…" picks and orders them: the first one shows
  await p3.evaluate(() => document.querySelector('mathra-keyboard[for="c"]').setAttribute("layers", "functions numbers nothing"));
  await key("Números").waitFor();
  assert.equal(await key("Letras").count(), 1);
  assert.equal(await key("Seno").count(), 1);
  // a layer of one's own
  await p3.evaluate(() => (document.querySelector('mathra-keyboard[for="c"]').layers = [{ id: "mine", title: { en: "Mine" }, rows: [[{ type: "z", title: { en: "Zed" } }, { insert: "\\heartsuit", title: { en: "Heart" } }]] }]));
  assert.equal(await kb.locator("button").count(), 2);
  await key("Zed").click();
  await key("Heart").click();
  assert.equal(await v3("c"), "Abz\\heartsuit");
});

await check("Keyboard in a narrow column: the words on the keys stay inside them", async () => {
  // as wide as a 300 px sidebar (Google Docs' and Slides'), and as a phone
  const kb = p3.locator('mathra-keyboard[for="c"]');
  // the keyboard's own layers again, after the test above gave it others
  await p3.evaluate(() => {
    const kb = document.querySelector('mathra-keyboard[for="c"]');
    kb.removeAttribute("layers");
    kb.layers = null;
  });
  for (const width of ["276px", "358px"]) {
    await p3.evaluate((w) => (document.querySelector('mathra-keyboard[for="c"]').style.width = w), width);
    for (const layer of ["Letras", "Funções e símbolos", "Números"]) {
      await kb.locator(`button[title="${layer}"]`).first().click();
      const out = await kb.evaluate((el) =>
        [...el.shadowRoot.querySelectorAll("button")].flatMap((b) => {
          const label = b.querySelector(".label");
          if (!label) return [];
          const [l, k] = [label.getBoundingClientRect(), b.getBoundingClientRect()];
          return l.left < k.left - 0.5 || l.right > k.right + 0.5 ? [label.textContent] : [];
        }),
      );
      assert.deepEqual(out, [], `${width}, ${layer}: ${out.join(" ")} past their keys`);
    }
  }
  // a phone's width keeps the words at their size
  const size = await kb.evaluate((el) => getComputedStyle(el.shadowRoot.querySelector("button .label")).fontSize);
  assert.equal(size, "15px");
  await p3.evaluate(() => (document.querySelector('mathra-keyboard[for="c"]').style.width = ""));
});

await check("Command menu alone: the commands of given palettes, and none once it leaves the field", async () => {
  const menu = p3.locator('mathra-command-menu[for="b"]');
  await p3.evaluate(() => {
    document.getElementById("b").value = "";
    document.querySelector('mathra-command-menu[for="b"]').palettes = [{ id: "mine", title: { en: "Mine" }, items: [{ insert: "\\heartsuit", title: { en: "Heart" }, command: "heart" }, { insert: "\\hbar", title: { en: "h-bar" } }] }];
  });
  await p3.evaluate(() => document.getElementById("b").focus());
  await p3.keyboard.type("\\h");
  await p3.waitForFunction(() => !document.querySelector('mathra-command-menu[for="b"]').hidden);
  assert.deepEqual(await menu.locator(".item .name").allTextContents(), ["\\heart"]);
  await p3.keyboard.press("Enter");
  assert.equal(await v3("b"), "\\heartsuit");
  // every palette's commands, for a menu of one's own
  const all = await p3.evaluate(async () => (await import("/editor/dist/command-menu.js")).ALL_COMMANDS().map((c) => c.name));
  assert.ok(all.includes("frac") && all.includes("alpha"), `${all.length} commands`);
  // away from the field, the menu no longer follows it
  await p3.evaluate(() => (document.querySelector('mathra-command-menu[for="b"]').field = null));
  await p3.keyboard.type("\\fr");
  assert.equal(await menu.isHidden(), true);
  await p3.keyboard.press("Escape");
  await p3.evaluate(() => (document.querySelector('mathra-command-menu[for="b"]').field = document.getElementById("b")));
});

await check("Palette alone: a set by name, another set, buttons of your own, another field", async () => {
  const pal = p3.locator("#p");
  await p3.evaluate(() => (document.getElementById("b").value = ""));
  await pal.locator('button[title="alfa"]').click();
  assert.equal(await v3("b"), "\\alpha");
  await p3.evaluate(() => document.getElementById("p").setAttribute("set", "arrows"));
  await pal.locator('button[title="alfa"]').waitFor({ state: "detached" });
  assert.equal(await pal.locator(".grid").getAttribute("aria-label"), "Setas");
  // one's own buttons; one whose drawing mathra refuses shows its LaTeX
  await p3.evaluate(() => (document.getElementById("p").items = [{ insert: "\\heartsuit", title: { en: "Heart" } }, { insert: "x", preview: "\\begin{CD}@@@\\end{CD}", title: { en: "Odd" } }]));
  assert.equal(await pal.locator("button").count(), 2);
  assert.equal(await pal.locator('button[title="Odd"]').textContent(), "\\begin{CD}@@@\\end{CD}");
  // for another field
  await p3.evaluate(() => {
    document.getElementById("c").value = "";
    document.getElementById("p").field = document.getElementById("c");
  });
  await pal.locator('button[title="Heart"]').click();
  assert.equal(await v3("c"), "\\heartsuit");
  assert.equal(await v3("b"), "\\alpha");
});

await check("Toolbar alone: palettes by name, arrows between tabs, palettes of your own", async () => {
  const bar = p3.locator("#t");
  const tabs = bar.locator("[role=tab]");
  assert.deepEqual(await tabs.allTextContents(), ["Gregas", "Cálculo"]);
  await tabs.first().focus();
  await p3.keyboard.press("ArrowRight");
  assert.equal(await bar.locator('[role=tab][aria-selected="true"]').textContent(), "Cálculo");
  assert.equal(await p3.evaluate(() => document.getElementById("t").shadowRoot.activeElement?.textContent), "Cálculo");
  await p3.keyboard.press("ArrowRight");
  await p3.keyboard.press("ArrowLeft");
  assert.equal(await bar.locator('[role=tab][aria-selected="true"]').textContent(), "Cálculo");
  const ids = await p3.evaluate(() => {
    const t = document.getElementById("t");
    t.palettes = [{ id: "mine", title: { en: "Mine", "pt-BR": "Minha" }, items: [{ insert: "\\heartsuit", title: { en: "Heart" } }] }];
    return t.palettes.map((p) => p.id);
  });
  assert.deepEqual(ids, ["mine"]);
  assert.deepEqual(await tabs.allTextContents(), ["Minha"]);
  await p3.evaluate(() => (document.getElementById("b").value = ""));
  await bar.locator('button[title="Heart"]').click();
  assert.equal(await v3("b"), "\\heartsuit");
});

await check("Outputs alone: only the formats asked for; another field followed", async () => {
  const out = p3.locator("#o");
  assert.deepEqual(await out.locator("[role=tab]").allTextContents(), ["Fala", "LaTeX"]);
  await out.locator("[role=tab]").filter({ hasText: "LaTeX" }).click();
  assert.equal(await out.locator("pre").textContent(), "\\heartsuit");
  await p3.evaluate(() => (document.getElementById("o").field = document.getElementById("c")));
  await p3.waitForFunction(() => document.getElementById("o").shadowRoot.querySelector("pre")?.textContent === document.getElementById("c").value);
  // the first field's changes no longer reach it
  await p3.evaluate(() => (document.getElementById("b").value = "y"));
  assert.equal(await out.locator("pre").textContent(), await v3("c"));
});

await check("Editor with some controls and languages", async () => {
  const e = p3.locator("#e");
  await e.locator('[data-act="undo"]').waitFor();
  assert.equal(await e.locator('[data-act="zoomIn"]').count(), 0);
  assert.equal(await e.locator("[data-theme]").count(), 0);
  await e.locator(".language > button").click();
  const options = e.locator(".language .menu [role=option]");
  assert.deepEqual(await options.locator("span:first-child").allTextContents(), ["English", "Português (Brasil)", "xx"]);
  await options.filter({ hasText: "Português" }).click();
  assert.equal(await p3.evaluate(() => document.getElementById("e").getAttribute("locale")), "pt-BR");
});
await collect(p3);
await alone.close();

// ---------- a phone ----------

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p2 = await phone.newPage();
await watch(p2);
await p2.goto(`${base}/editor/demo/`);
await ready(p2);
await check("Phone: the keyboard starts open, the outputs go below, nothing wider than the screen", async () => {
  assert.equal(await p2.evaluate(() => document.getElementById("editor").keyboard.hidden), false);
  const wide = await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(wide <= 0, `${wide}px too wide`);
  const field = await p2.locator("#editor").locator("mathra-field").boundingBox();
  const out = await p2.locator("#editor").locator("mathra-output").boundingBox();
  assert.ok(out.y > field.y, "the outputs are below");
  await settle(p2);
  if (shots) await p2.screenshot({ path: `${shots}/phone.png` });
});
await check("Phone: tapping keys builds a formula", async () => {
  const kb = p2.locator("#editor").locator("mathra-keyboard");
  await p2.evaluate(() => (document.getElementById("editor").value = ""));
  await kb.locator('button[title="Raiz quadrada"]').tap();
  await kb.locator('button[title="2"]').tap();
  assert.equal(await p2.evaluate(() => document.getElementById("editor").value), "\\sqrt{2}");
});
await check("Phone: a diagram's bar never covers the cell being edited", async () => {
  await p2.evaluate(() => {
    const ed = document.getElementById("editor");
    ed.value = "\\begin{tikzcd}A \\arrow[r, \"f\"] \\arrow[d] & B \\arrow[d] \\\\ C \\arrow[r] & D\\end{tikzcd}";
    const e = ed.field.editor;
    e.setCursor({ row: e.root.children[0].cells[0][0], offset: 1 });
  });
  await settle(p2);
  const r = await p2.evaluate(() => {
    const f = document.getElementById("editor").field;
    const bar = f.shadowRoot.querySelector(".dbar").getBoundingClientRect();
    const caret = f.shadowRoot.querySelector(".caret").getBoundingClientRect();
    return { bar: [bar.top, bar.bottom], caret: [caret.top, caret.bottom], hidden: f.shadowRoot.querySelector(".dbar").hidden };
  });
  assert.equal(r.hidden, false);
  assert.ok(r.bar[1] <= r.caret[0] || r.bar[0] >= r.caret[1], `bar ${r.bar} over the cursor ${r.caret}`);
});
await collect(p2);
await phone.close();
if (coverage) await writeFile(coverage, JSON.stringify(covered));

await browser.close();
server.close();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
