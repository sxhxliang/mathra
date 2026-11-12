import "./setup.ts";
import { strict as assert } from "node:assert";
import { beforeEach, test } from "node:test";
import { fake, ColorThemeKind, window, type FakePanel } from "./vscode.ts";

const { html, openEditor, targetOf, textFor } = await import("../src/panel.ts");

/** A document as the editor gives it, with offsets for positions, that applied edits change. */
function doc(text: string, languageId = "markdown", path = "/notes/doc.md") {
  const d = {
    text,
    languageId,
    uri: { path },
    getText: (range?: { start: number; end: number }) => (range ? d.text.slice(range.start, range.end) : d.text),
    offsetAt: (p: number) => p,
    positionAt: (o: number) => o,
  };
  fake.docs[path] = d;
  return d;
}
function editor(d: ReturnType<typeof doc>, start: number, end = start) {
  return { document: d, selection: { start, end, active: start, isEmpty: start === end } } as never;
}
const range = (t: { range: { start: unknown; end: unknown } } | undefined) => [t!.range.start, t!.range.end];
const context = { extensionUri: { path: "/ext" } } as never;
const plain = (x: unknown) => JSON.parse(JSON.stringify(x));

beforeEach(() => fake.reset());

test("the formula the editor starts from, and where it goes back", () => {
  assert.deepEqual(targetOf(undefined), { latex: "" });
  // the cursor in an equation: its LaTeX, without the spaces around it
  let t = targetOf(editor(doc("a $$ x+1 $$ b"), 5));
  assert.equal(t.latex, "x+1");
  assert.deepEqual(range(t.target), [5, 8]);
  assert.equal(t.target!.wrap, false);
  // a bare cursor: a new formula, between dollars
  t = targetOf(editor(doc("a b"), 1));
  assert.equal(t.latex, "");
  assert.deepEqual(range(t.target), [1, 1]);
  assert.equal(t.target!.wrap, true);
  // a selection: of one equation with its delimiters, of LaTeX alone, of spaces alone
  t = targetOf(editor(doc("see  \\( y \\) "), 3, 13));
  assert.equal(t.latex, "y");
  assert.deepEqual(range(t.target), [8, 9]);
  t = targetOf(editor(doc("\\begin{x} a+b", "latex"), 10, 13));
  assert.equal(t.latex, "a+b");
  assert.deepEqual(range(t.target), [10, 13]);
  assert.equal(t.target!.wrap, false);
  t = targetOf(editor(doc("a   b"), 1, 4));
  assert.deepEqual([t.latex, ...range(t.target), t.target!.wrap], ["", 1, 1, true]);
});

test("the page: its script, its policy, and what it starts from, safe inside a script element", () => {
  const webview = { cspSource: "vscode-resource:", asWebviewUri: (u: { path: string }) => `webview:${u.path}` } as never;
  const page = html(webview, { path: "/ext" } as never, { latex: "a</script>b", locale: "en", theme: "dark", action: "insert" });
  assert.match(page, /<script type="module" src="webview:\/ext\/dist\/webview.js"><\/script>/);
  assert.match(page, /script-src vscode-resource: 'wasm-unsafe-eval'/);
  assert.match(page, /color-scheme: dark;/);
  assert.match(page, /"latex":"a\\u003c\/script>b"/);
});

test("the text written back: delimited only at a bare cursor", () => {
  assert.equal(textFor("x", true), "$x$");
  assert.equal(textFor("x", false), "x");
});

/** Sends a message from the page to the extension, as the webview would. */
const send = (panel: FakePanel, latex: string) => panel.onMessage[0]({ type: "apply", latex });

test("a new formula goes in at the cursor, then each apply replaces it", async () => {
  const d = doc("a  b");
  fake.editor = editor(d, 2);
  openEditor(context, "en", fake.editor as never);
  const panel = fake.panels[0];
  assert.deepEqual(panel.options, {
    id: "mathra.editor",
    title: "mathra editor",
    column: -2,
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [{ path: "/ext" }],
  });
  assert.match(panel.webview.html, /"action":"insert"/);
  assert.match(panel.webview.html, /color-scheme: light;/);
  await send(panel, "x^2");
  assert.deepEqual(plain(fake.calls[0]), ["applyEdit", [[d.uri, { start: 2, end: 2 }, "$x^2$"]]]);
  assert.deepEqual(panel.posted, [{ type: "action", action: "replace" }]);
  // the document now holds it (as VS Code would have written it); the next apply replaces the LaTeX
  d.text = "a $x^2$ b";
  await send(panel, "y");
  assert.deepEqual(plain(fake.calls.filter((c) => c[0] === "applyEdit")[1]), ["applyEdit", [[d.uri, { start: 3, end: 6 }, "y"]]]);
  assert.deepEqual(fake.calls.at(-1), ["status", "mathra: formula written to the document"]);
});

test("an equation is replaced in place; a refused edit is said", async () => {
  window.activeColorTheme = { kind: ColorThemeKind.HighContrast };
  const d = doc("$a$");
  fake.editor = editor(d, 1);
  openEditor(context, "en", fake.editor as never);
  const panel = fake.panels[0];
  assert.match(panel.webview.html, /"latex":"a","locale":"en","theme":"dark","action":"replace"/);
  fake.editApplies = false;
  await send(panel, "b");
  assert.deepEqual(fake.calls.at(-1), ["error", "mathra: the document could not be changed."]);
  assert.deepEqual(panel.posted, []);
});

test("without a document the formula is copied; opening again replaces the panel", async () => {
  window.activeColorTheme = { kind: ColorThemeKind.Dark };
  openEditor(context, "en", fake.editor as never);
  const first = fake.panels[0];
  assert.match(first.webview.html, /"theme":"dark","action":"copy"/);
  await send(first, "z");
  assert.deepEqual(fake.calls, [["clipboard", "z"], ["status", "mathra: LaTeX copied"]]);
  openEditor(context, "en", fake.editor as never);
  assert.equal(first.disposed, true);
  // the old panel's closing leaves the new one as the open one
  const second = fake.panels[1];
  openEditor(context, "en", fake.editor as never);
  assert.equal(second.disposed, true);
  fake.panels[2].dispose();
});
