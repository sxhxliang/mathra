import { test } from "node:test";
import assert from "node:assert/strict";
import { init, texToSvg, render, locales, loadFont, catalogFonts, loadFontFromCatalog, version } from "@mathlabs/mathra";

test("works right away in Node, init is optional", async () => {
  assert.match(texToSvg("x^2"), /^<svg/);
  await init();
});

test("svg carries the speech", () => {
  assert.match(texToSvg(String.raw`\frac{1}{2}`), /1 over 2/);
});

test("options and the old locale string", () => {
  assert.match(texToSvg("3,14", { locale: "pt-BR" }), /3,14/);
  assert.equal(texToSvg("3,14", "pt-BR"), texToSvg("3,14", { locale: "pt-BR" }));
  assert.notEqual(texToSvg(String.raw`\sum_{n} x`, { display: false }), texToSvg(String.raw`\sum_{n} x`));
});

test("render returns every output as an object", () => {
  const r = render(String.raw`\vertA\vert`, { locale: "fr" });
  assert.match(r.svg, /^<svg/);
  assert.equal(r.speech, "valeur absolue de A");
  assert.equal(r.warnings[0].rule, "E-REC-1");
  assert.equal(typeof r.tree, "object");
});

test("strict refuses and errors are Error objects", () => {
  assert.throws(() => texToSvg(String.raw`\vertA\vert`, { strict: true }), Error);
  assert.throws(() => texToSvg("x", { locale: "xx" }), /unknown locale/);
});

test("locales and version", () => {
  const list = locales();
  assert.equal(list.length, 16);
  assert.deepEqual(list[0], { code: "en", name: "English" });
  assert.match(version, /^\d+\.\d+\.\d+/);
});

test("MathML and AsciiMath input", () => {
  assert.equal(render("sqrt(x)/2", { input: "asciimath" }).speech, render(String.raw`\frac{\sqrt{x}}{2}`).speech);
  assert.equal(render("<math><msup><mi>x</mi><mn>2</mn></msup></math>", { input: "mathml" }).text, "x^2");
  // MathML passed as LaTeX is recognized
  assert.equal(render("<math><mi>y</mi></math>").text, "y");
  assert.throws(() => texToSvg("x", { input: "word" }), /unknown input format/);
});

test("braille", () => {
  const r = render(String.raw`\frac{3}{4}`, { locale: "pt-BR" });
  assert.equal(r.braille, "⠼⠒⠙");
  assert.equal(r.braille_code, "cmu");
  assert.equal(render(String.raw`\frac{3}{4}`, { braille: "nemeth" }).braille, "⠹⠒⠌⠲⠼");
  assert.throws(() => render("x", { braille: "ueb" }), /unknown braille code/);
});

test("the writing animation and the steps", () => {
  assert.doesNotMatch(texToSvg("x+1"), /data-step/);
  assert.match(texToSvg("x+1", { animate: true }), /@keyframes mr-f/);
  const steps = texToSvg("x+1", { steps: true });
  assert.match(steps, /data-steps="3"/);
  assert.doesNotMatch(steps, /@keyframes/);
  assert.match(render("x", { animate: true }).svg, /mr-f/);
});

test("a math font from outside", async () => {
  const { readFile } = await import("node:fs/promises");
  const font = loadFont(await readFile(process.env.MATHRA_TEST_FONT));
  assert.equal(font.name, "Latin Modern Math");
  assert.deepEqual(loadFont(await readFile(process.env.MATHRA_TEST_FONT)), font);
  const svg = texToSvg(String.raw`\frac{a}{b}`, { font });
  assert.match(svg, /<mathra:font>Latin Modern Math<\/mathra:font>/);
  assert.equal(svg, texToSvg(String.raw`\frac{a}{b}`, { font: font.id }));
  assert.notEqual(svg, texToSvg(String.raw`\frac{a}{b}`));
  assert.match(render("x", { font }).svg, /Latin Modern Math/);
  assert.throws(() => loadFont(new Uint8Array([1, 2, 3])), /not a font/);
  assert.throws(() => texToSvg("x", { font: 99 }), /no font loaded/);
});

test("a font from a catalog, checked by its hash", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createServer } = await import("node:http");
  const { createHash } = await import("node:crypto");
  const bytes = await readFile(process.env.MATHRA_TEST_FONT);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const entry = { slug: "latin-modern-math", name: "Latin Modern Math", style: "Serif", base: "Latin Modern", designer: null, license: "GUST", license_file: "files/lm/LICENSE.txt", file: "files/lm/latinmodern-math.otf", size: bytes.length, sha256, coverage: 0 };
  const catalogs = {
    "/catalog.json": { version: 1, fonts: [entry] },
    "/bad.json": { version: 1, fonts: [{ ...entry, sha256: "0".repeat(64) }] },
  };
  let fontRequests = 0;
  const server = createServer((req, res) => {
    if (catalogs[req.url]) return res.end(JSON.stringify(catalogs[req.url]));
    if (req.url === "/files/lm/latinmodern-math.otf") { fontRequests++; return res.end(bytes); }
    res.statusCode = 404;
    res.end();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const fonts = await catalogFonts({ catalog: `${base}/catalog.json` });
    assert.equal(fonts[0].url, `${base}/files/lm/latinmodern-math.otf`);
    assert.equal(fonts[0].license_url, `${base}/files/lm/LICENSE.txt`);
    const font = await loadFontFromCatalog("latin-modern-math", { catalog: `${base}/catalog.json` });
    assert.deepEqual(font, loadFont(bytes));
    await loadFontFromCatalog("latin-modern-math", { catalog: `${base}/catalog.json` });
    assert.equal(fontRequests, 1, "a font is downloaded once");
    assert.match(texToSvg("x", { font }), /Latin Modern Math/);
    await assert.rejects(loadFontFromCatalog("nope", { catalog: `${base}/catalog.json` }), /no font "nope"/);
    await assert.rejects(loadFontFromCatalog("latin-modern-math", { catalog: `${base}/bad.json` }), /sha256/);
    await assert.rejects(catalogFonts({ catalog: `${base}/missing.json` }), /404/);
  } finally {
    server.close();
  }
});
