import { strict as assert } from "node:assert";
import { createRequire, registerHooks } from "node:module";
import { test, beforeEach } from "node:test";
import * as google from "./google.mts";
import { calls, docsImage, reset, slidesImage, state } from "./google.mts";

// Code.js is an Apps Script file: global functions, no exports. In these tests it loads as CommonJS
// with its functions exported at its end, and Apps Script's services as globals
const names = ["onOpen", "onInstall", "inDocs", "ui", "showSidebar", "latexOf", "selectedImage", "getContext", "insertEquation"];
registerHooks({
  load(url, context, next) {
    const loaded = next(url, context);
    if (!url.endsWith("/src/Code.js")) return loaded;
    return { ...loaded, source: `${loaded.source}\nmodule.exports = { ${names.join(", ")} };\n` };
  },
});
Object.assign(globalThis, { DocumentApp: google.DocumentApp, SlidesApp: google.SlidesApp, HtmlService: google.HtmlService, Session: google.Session, Utilities: google.Utilities });
const code = createRequire(import.meta.url)("../src/Code.js");

const EDITOR = "https://matheusmota-dev-br.github.io/mathra/editor.html#latex=";
const eq = { png: "UE5H", em: { width: 4, height: 2 }, alt: "x squared", latex: "x^2", replace: false };

beforeEach(() => reset("docs"));

test("the menu and the sidebar, in Docs and in Slides", () => {
  code.onInstall();
  code.showSidebar();
  reset("slides");
  code.onOpen();
  code.showSidebar();
  assert.deepEqual(calls, [
    ["menu", "slides", "Insert equation", "showSidebar"],
    ["addToUi", "slides"],
    ["sidebar", "slides", "Sidebar", "mathra"],
  ]);
});

test("the menu in Docs", () => {
  code.onOpen();
  code.showSidebar();
  assert.deepEqual(calls, [
    ["menu", "docs", "Insert equation", "showSidebar"],
    ["addToUi", "docs"],
    ["sidebar", "docs", "Sidebar", "mathra"],
  ]);
});

test("an equation's LaTeX is in its link to mathra's editor", () => {
  assert.equal(code.latexOf(EDITOR + encodeURIComponent("\\frac{a}{b}")), "\\frac{a}{b}");
  assert.equal(code.latexOf("https://example.com/#latex=x"), "");
  assert.equal(code.latexOf(null), "");
});

test("Docs: the context is the account's language and the selected equation", () => {
  assert.deepEqual(code.getContext(), { locale: "pt_BR", latex: "" });
  // a selection of text, an image with no link, an image linked elsewhere, then an equation
  const text = { getType: () => "TEXT" };
  state.selection = [text, docsImage(null), docsImage("https://example.com"), docsImage(EDITOR + "y")];
  assert.deepEqual(code.getContext(), { locale: "pt_BR", latex: "y" });
  state.selection = [text];
  assert.deepEqual(code.getContext(), { locale: "pt_BR", latex: "" });
});

test("Slides: the selected equation, among other elements", () => {
  reset("slides");
  assert.deepEqual(code.getContext(), { locale: "pt_BR", latex: "" });
  const shape = { getPageElementType: () => "SHAPE" };
  state.pageElements = [shape, slidesImage(null), slidesImage("https://example.com"), slidesImage(EDITOR + "z")];
  assert.deepEqual(code.getContext(), { locale: "pt_BR", latex: "z" });
  state.pageElements = [shape];
  assert.equal(code.selectedImage(), null);
});

test("Docs: a new equation at the cursor, sized at 11 pt, with its alt text and link", () => {
  state.cursor = { insertInlineImage: (blob) => (calls.push(["insert", blob]), docsImage(null)) };
  code.insertEquation(eq);
  assert.deepEqual(calls, [
    ["insert", { bytes: "bytes(UE5H)", type: "image/png", name: "equation.png" }],
    ["width", 59],
    ["height", 29],
    ["altTitle", "Equation"],
    ["altDescription", "x squared"],
    ["link", EDITOR + "x%5E2"],
  ]);
});

test("Docs: no cursor, or one where an image cannot go, is said", () => {
  assert.throws(() => code.insertEquation(eq), /Put the cursor in the text/);
  state.cursor = { insertInlineImage: () => null };
  assert.throws(() => code.insertEquation(eq), /Put the cursor in the text/);
});

test("Docs: the selected equation is replaced where it is", () => {
  const paragraph = {
    getChildIndex: () => 3,
    insertInlineImage: (index: number, blob: unknown) => (calls.push(["insertAt", index, blob]), docsImage(null)),
  };
  state.selection = [docsImage(EDITOR + "old", paragraph)];
  code.insertEquation({ ...eq, replace: true });
  assert.deepEqual(calls.slice(0, 2), [
    ["insertAt", 3, { bytes: "bytes(UE5H)", type: "image/png", name: "equation.png" }],
    ["removed", EDITOR + "old"],
  ]);
});

test("Slides: on the slide, or over the selected equation, sized in points", () => {
  reset("slides");
  code.insertEquation(eq);
  state.pageElements = [slidesImage(EDITOR + "old")];
  code.insertEquation({ ...eq, replace: true });
  const blob = { bytes: "bytes(UE5H)", type: "image/png", name: "equation.png" };
  const set = [["width", 72], ["height", 36], ["title", "Equation"], ["description", "x squared"], ["link", EDITOR + "x%5E2"]];
  assert.deepEqual(calls, [["insertImage", blob], ...set, ["replace", blob], ...set]);
});
