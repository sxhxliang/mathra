// The sidebar in Chromium, beside the stand-in for Google Docs (preview/), with mathra and the editor of
// this repository (npm/pkg and editor/dist must be built): what a person does in it, and that every line
// and function of src/sidebar.js runs. node test/sidebar.mjs [--fail-under 100]

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { serve } from "../preview/serve.mjs";

const floor = process.argv.includes("--fail-under") ? Number(process.argv[process.argv.indexOf("--fail-under") + 1]) : null;
const port = 4531;
const server = serve(port, true);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.coverage.startJSCoverage({ resetOnNavigation: false });

let failed = 0;
async function check(name, run) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${String(e.message).split("\n").join("\n     ")}`);
  }
}

let side;
/** The page again, with the account in `locale`; the sidebar ready. */
async function open(locale) {
  await page.goto(`http://127.0.0.1:${port}/${locale === undefined ? "" : `?locale=${locale}`}`);
  side = page.frames().find((f) => f.url().endsWith("/Sidebar.html"));
  await side.waitForFunction(() => document.getElementById("locale").options.length > 0);
}
const value = () => side.evaluate(() => document.getElementById("field").value);
const text = (id) => side.evaluate((id) => document.getElementById(id).textContent, id);
// a click on the document's first equation (the blinking cursor may sit over it)
const pick = () => page.evaluate(() => document.querySelector("img.eq").click());
const typeIn = async (latex) => {
  await side.locator("mathra-field").click();
  await page.keyboard.type(latex, { delay: 10 });
};

await check("the account's language, as close as mathra has it", async () => {
  await open("pt_BR");
  assert.equal(await side.evaluate(() => document.getElementById("locale").value), "pt-BR");
  assert.equal(await text("insert"), "Inserir");
  assert.equal(await side.evaluate(() => document.querySelector('[data-open="gallery"]').title), "Galeria");
  await open("es_MX");
  assert.equal(await side.evaluate(() => document.getElementById("locale").value), "es");
  // words of its own only in English and Portuguese
  assert.equal(await text("insert"), "Insert");
  await open("sv");
  assert.equal(await side.evaluate(() => document.getElementById("locale").value), "en");
  await open("");
  assert.equal(await side.evaluate(() => document.getElementById("locale").value), "en");
});

await check("typing: the alt text follows the formula, and Insert waits for one", async () => {
  await open("en_US");
  assert.equal(await side.evaluate(() => document.getElementById("insert").disabled), true);
  assert.equal(await text("speech"), "");
  await typeIn("x^2");
  assert.equal(await text("speech"), "x squared");
  assert.equal(await side.evaluate(() => document.getElementById("insert").disabled), false);
  // another language: the alt text in it
  await side.selectOption("#locale", "pt-BR");
  assert.equal(await text("speech"), "x ao quadrado");
  assert.equal(await text("alt-label"), "Texto alternativo (o que o leitor de tela diz)");
});

await check("insert: the equation at the cursor, as PNG, with its alt text and LaTeX", async () => {
  await side.locator("#insert").click();
  await page.waitForSelector("img.eq");
  const img = await page.evaluate(() => { const i = document.querySelector("img.eq"); return { alt: i.alt, latex: i.dataset.latex, png: i.src.startsWith("data:image/png;base64,"), w: i.naturalWidth }; });
  // the LaTeX as the editor writes it
  assert.deepEqual({ ...img, w: img.w > 40 }, { alt: "x ao quadrado", latex: "x^{2}", png: true, w: true });
  assert.equal(await text("status"), "Inserida");
});

await check("a selected equation comes back to the sidebar, and is updated in place", async () => {
  await pick();
  await side.waitForFunction(() => document.getElementById("insert").textContent === "Atualizar");
  assert.equal(await value(), "x^{2}");
  await side.locator("mathra-field").click();
  await page.keyboard.press("End");
  await page.keyboard.type("+1");
  await side.locator("#insert").click();
  await side.waitForFunction(() => document.getElementById("status").textContent === "Atualizada");
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("img.eq")].map((i) => i.dataset.latex)), ["x^{2}+1"]);
  // once off the equation, the sidebar inserts a new one again
  assert.equal(await text("insert"), "Inserir");
});

await check("an equation unselected: the sidebar inserts a new one", async () => {
  await pick();
  await side.waitForFunction(() => document.getElementById("insert").textContent === "Atualizar");
  await page.locator("#paper h1").click();
  await side.waitForFunction(() => document.getElementById("insert").textContent === "Inserir");
});

await check("what Docs refuses is said, and Insert works again", async () => {
  await page.locator("#paper h1").click();
  await page.evaluate(() => (window.mathraFail = { insertEquation: "Ponha o cursor no texto." }));
  await side.locator("#insert").click();
  await side.waitForFunction(() => document.getElementById("status").classList.contains("error"));
  assert.equal(await text("status"), "Ponha o cursor no texto.");
  assert.equal(await side.evaluate(() => document.getElementById("insert").disabled), false);
  await page.evaluate(() => (window.mathraFail = null));
});

await check("a formula mathra refuses (strict mode) inserts nothing", async () => {
  const before = await page.locator("img.eq").count();
  await side.evaluate(() => {
    const f = document.getElementById("field");
    // a command mathra does not know: the editor keeps it as written, and strict mathra refuses it
    f.mathraOptions = { strict: true };
    f.value = "\\foo";
  });
  await side.locator("#insert").click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("img.eq").count(), before);
  await side.evaluate(() => (document.getElementById("field").mathraOptions = {}));
});

await check("New empties the field", async () => {
  await side.locator("#clear").click();
  assert.equal(await value(), "");
  assert.equal(await text("insert"), "Inserir");
});

await check("the bar: undo and redo, the keyboard and the outputs under the field", async () => {
  await typeIn("ab");
  // the typing is one step of undo
  await side.locator('[data-run="undo"]').click();
  assert.equal(await value(), "");
  await side.locator('[data-run="redo"]').click();
  assert.equal(await value(), "ab");
  for (const id of ["keyboard", "output"]) {
    const button = side.locator(`[data-toggle="${id}"]`);
    await button.click();
    assert.equal(await side.locator(`#${id}`).isVisible(), true, id);
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    await button.click();
    assert.equal(await side.locator(`#${id}`).isVisible(), false, id);
  }
  // a click on the bar off its buttons does nothing
  await side.evaluate(() => document.querySelector(".bar .sep").click());
  assert.equal(await value(), "ab");
});

await check("the gallery over the sidebar: an example chosen comes into the field", async () => {
  await side.locator('[data-open="gallery"]').click();
  assert.equal(await side.locator("#gallery").isVisible(), true);
  await side.locator("mathra-gallery").locator("button").first().click();
  assert.equal(await side.locator("#gallery").isVisible(), false);
  assert.equal(await value(), "e^{i\\pi}+1=0");
});

await check("the options and the gallery over the sidebar, closed by their button or Escape", async () => {
  await side.locator('[data-open="settings"]').click();
  assert.equal(await side.locator("#settings").isVisible(), true);
  await side.locator("#settings [data-close]").click();
  assert.equal(await side.locator("#settings").isVisible(), false);
  await side.locator('[data-open="settings"]').click();
  await side.locator("#settings [data-close]").focus();
  await page.keyboard.press("Shift");
  assert.equal(await side.locator("#settings").isVisible(), true, "another key leaves it open");
  await page.keyboard.press("Escape");
  assert.equal(await side.locator("#settings").isVisible(), false);
  await side.locator('[data-open="gallery"]').click();
  await side.locator("#gallery [data-close]").click();
  assert.equal(await side.locator("#gallery").isVisible(), false);
});

await check("Google not answering is waited out", async () => {
  await page.evaluate(() => (window.mathraFail = { getContext: "offline" }));
  await page.waitForTimeout(1700);
  await page.evaluate(() => (window.mathraFail = null));
  await pick();
  await side.waitForFunction(() => document.getElementById("insert").textContent === "Atualizar");
});

await check("no error in the page", async () => {
  assert.deepEqual(errors, []);
});

// what of src/sidebar.js ran: a line is uncovered when none of its code ran; every function must run
const coverage = await page.coverage.stopJSCoverage();
await browser.close();
server.close();
const source = readFileSync(new URL("../src/sidebar.js", import.meta.url), "utf8");
const entries = coverage.filter((e) => e.url.endsWith("/sidebar.js"));
const ran = new Uint8Array(source.length);
const fnRan = new Map();
for (const e of entries) {
  const counts = new Int32Array(source.length).fill(-1);
  const ranges = e.functions.flatMap((f) => f.ranges).sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset));
  for (const r of ranges) counts.fill(r.count, r.startOffset, Math.min(r.endOffset, source.length));
  for (let i = 0; i < source.length; i++) if (counts[i] > 0) ran[i] = 1;
  for (const f of e.functions) {
    if (!f.functionName && f.ranges[0].startOffset === 0) continue;
    const key = f.ranges[0].startOffset;
    fnRan.set(key, (fnRan.get(key) ?? false) || f.ranges[0].count > 0);
  }
}
const missed = [];
let lines = 0;
let at = 0;
for (const [n, line] of source.split("\n").entries()) {
  const code = line.replace(/\/\/.*$/, "");
  if (code.trim() && entries.length) {
    lines++;
    let some = false;
    for (let i = 0; i < code.length; i++) if (!/\s/.test(code[i]) && ran[at + i]) some = true;
    if (!some) missed.push(n + 1);
  }
  at += line.length + 1;
}
const fns = [...fnRan.values()];
const linePct = lines ? (100 * (lines - missed.length)) / lines : 0;
const fnPct = fns.length ? (100 * fns.filter(Boolean).length) / fns.length : 0;
const missedFns = [...fnRan].filter(([, r]) => !r).map(([offset]) => source.slice(0, offset).split("\n").length);
console.log(`\nsrc/sidebar.js: lines ${linePct.toFixed(2)}%, functions ${fnPct.toFixed(2)}%${missed.length ? `, uncovered lines ${missed.join(" ")}` : ""}${missedFns.length ? `, functions not run at lines ${missedFns.join(" ")}` : ""}`);
if (failed || (floor !== null && (linePct < floor || fnPct < floor))) process.exit(1);
