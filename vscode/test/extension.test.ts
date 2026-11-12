import "./setup.ts";
import { strict as assert } from "node:assert";
import { beforeEach, test } from "node:test";
import MarkdownIt from "markdown-it";
import { fake, ColorThemeKind, env, window } from "./vscode.ts";

const { activate, deactivate } = await import("../src/extension.ts");

/** A document as the editor gives it, with offsets for positions. */
function doc(text: string, languageId = "markdown") {
  const path = "/notes/doc.md";
  return (fake.docs[path] = {
    languageId,
    uri: { path, toString: () => `file://${path}` },
    getText: (range?: { start: number; end: number }) => (range ? text.slice(range.start, range.end) : text),
    offsetAt: (p: number) => p,
    positionAt: (o: number) => o,
  }) as { languageId: string; uri: { path: string }; getText(): string; offsetAt(p: number): number; positionAt(o: number): number };
}
function editor(text: string, start: number, end = start, languageId?: string) {
  return { document: doc(text, languageId), selection: { start, end, active: start, isEmpty: start === end } };
}

const subscriptions: { dispose(): void }[] = [];
const api = activate({ subscriptions, extensionUri: { path: "/ext" } } as never);
const registered = fake.calls;
const command = (id: string) => registered.find((c) => c[0] === "command" && c[1] === id)![2] as (...args: unknown[]) => Promise<void>;
type Provider = { provideHover: (d: unknown, p: number) => { contents: { value: string; isTrusted: unknown; supportThemeIcons: boolean }; range: { start: number; end: number } } | undefined };
// registered in this order: the details, then the equation (which VS Code shows first)
const [details, hover] = registered.filter((c) => c[0] === "hoverProvider").map((c) => c[2] as Provider);
const onConfig = registered.find((c) => c[0] === "onDidChangeConfiguration")![1] as (e: { affectsConfiguration: (s: string) => boolean }) => void;

beforeEach(() => fake.reset());

test("activation registers the hover, the commands and the settings' listener", () => {
  assert.equal(subscriptions.length, 8);
  assert.deepEqual(
    registered.filter((c) => c[0] === "command").map((c) => c[1]),
    ["mathra.copyAs", "mathra.saveSvg", "mathra.savePng", "mathra.explain", "mathra.openEditor"],
  );
  assert.deepEqual(registered.find((c) => c[0] === "hoverProvider")![1], [{ language: "markdown" }, { language: "latex" }, { language: "tex" }]);
  deactivate();
});

test("a hover over math, in the theme's color", () => {
  const h = hover.provideHover(doc("a $x_1$ b"), 3)!;
  assert.deepEqual([h.range.start, h.range.end], [2, 7]);
  assert.match(h.contents.value, /^!\[x sub 1\]/);
  assert.match(atob(/base64,([^)]+)/.exec(h.contents.value)![1]), /color:#111111/);
  window.activeColorTheme = { kind: ColorThemeKind.Dark };
  assert.match(atob(/base64,([^)]+)/.exec(hover.provideHover(doc("$x$"), 1)!.contents.value)![1]), /color:#e8e8e8/);
  window.activeColorTheme = { kind: ColorThemeKind.HighContrast };
  assert.match(atob(/base64,([^)]+)/.exec(hover.provideHover(doc("$x$"), 1)!.contents.value)![1]), /color:#e8e8e8/);
});

test("a hover in LaTeX, in the locale of the editor or of the setting", () => {
  assert.match(details.provideHover(doc("% $y$\n\\[\\sin x\\]", "latex"), 9)!.contents.value, /\*sine of x\*/);
  env.language = "pt-br";
  assert.match(details.provideHover(doc("\\[\\sin x\\]", "latex"), 3)!.contents.value, /\*seno de x\*/);
  fake.config["mathra.locale"] = "de";
  assert.doesNotMatch(details.provideHover(doc("\\[\\sin x\\]", "latex"), 3)!.contents.value, /seno/);
});

test("no hover off math, or when turned off", () => {
  for (const p of [hover, details]) assert.equal(p.provideHover(doc("a $x$"), 0), undefined);
  // what mathra cannot read has its error over the LaTeX, and no details
  assert.match(hover.provideHover(doc("$$<math><mi>$$"), 3)!.contents.value, /^\*\*mathra:\*\* /);
  assert.equal(details.provideHover(doc("$$<math><mi>$$"), 3), undefined);
  fake.config["mathra.hover.enabled"] = false;
  for (const p of [hover, details]) assert.equal(p.provideHover(doc("a $x$"), 3), undefined);
});

type Item = { label: string; description: string; detail: string };

test("copy as: a list that shows what each choice puts in the clipboard", async () => {
  fake.editor = editor("a $\\frac12$ b", 4);
  fake.pick = "Speech";
  await command("mathra.copyAs")();
  const [, items, options] = fake.calls[0] as [string, Item[], { title: string }];
  assert.deepEqual(items.map((i) => i.label), ["LaTeX", "SVG", "MathML", "Speech", "Braille", "Plain text"]);
  assert.equal(options.title, "Copy \\frac12 as…");
  assert.equal(items[0].detail, "\\frac12");
  assert.equal(items[3].detail, "1 over 2");
  // long values are cut, in one line
  assert.match(items[1].detail, /^<svg [^\n]{60,}…$/);
  assert.equal(items[1].detail.length, 70);
  assert.deepEqual(fake.calls.slice(1), [["clipboard", "1 over 2"], ["status", "mathra: copied the Speech: 1 over 2"]]);
});

test("copy as: every output, and nothing when nothing is picked", async () => {
  fake.editor = editor("$x$", 1);
  await command("mathra.copyAs")();
  const items = fake.calls[0][1] as Item[];
  assert.equal(items.length, 6);
  assert.deepEqual(items.map((i) => i.detail).slice(2), ['<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><mi…', "x", "⠰⠭", "x"]);
  assert.equal(fake.calls.length, 1, "nothing picked, nothing copied");
});

test("copy as: a selection, with or without its delimiters", async () => {
  fake.pick = "Plain text";
  fake.editor = editor("see $a/b$ here", 4, 9);
  await command("mathra.copyAs")();
  fake.editor = editor("a+b", 0, 3);
  await command("mathra.copyAs")();
  assert.deepEqual(fake.calls.filter((c) => c[0] === "clipboard"), [["clipboard", "a/b"], ["clipboard", "a + b"]]);
});

test("the hover's links: the visual editor, and each form to copy, for the equation under the mouse", async () => {
  const h = details.provideHover(doc("a $x^2$ b"), 4)!;
  assert.deepEqual([h.range.start, h.range.end], [2, 7]);
  for (const md of [h.contents, hover.provideHover(doc("a $x^2$ b"), 4)!.contents]) {
    assert.deepEqual(md.isTrusted, { enabledCommands: ["mathra.openEditor", "mathra.copyAs"] });
    assert.equal(md.supportThemeIcons, true);
  }
  const where = { uri: "file:///notes/doc.md", offset: 4 };
  const link = (id: string, ...args: unknown[]) => `command:${id}?${encodeURIComponent(JSON.stringify(args))}`;
  assert.ok(h.contents.value.includes(`\n\n[$(edit) Open in the visual editor](${link("mathra.openEditor", where)})`));
  assert.ok(h.contents.value.includes(`$(copy) Copy as: [LaTeX](${link("mathra.copyAs", where, "latex")} "Copy the equation's source, without its delimiters") · [SVG](`));
  // the link copies without asking, from the document it names, with or without an editor on it
  fake.editor = undefined;
  await command("mathra.copyAs")(where, "latex");
  assert.deepEqual(fake.calls, [["clipboard", "x^2"], ["status", "mathra: copied the LaTeX: x^2"]]);
  fake.calls = [];
  await command("mathra.openEditor")(where);
  assert.match(fake.panels[0].webview.html, /"latex":"x\^2"/);
  fake.panels[0].dispose();
});

test("the commands say when there is no math, no editor, or math mathra cannot read", async () => {
  await command("mathra.copyAs")();
  assert.deepEqual(fake.calls, []);
  fake.editor = editor("no math", 2);
  await command("mathra.saveSvg")();
  assert.match(fake.calls[0][1] as string, /^mathra: no math at the cursor/);
  fake.calls = [];
  fake.editor = editor("<math><mi>", 0, 10);
  await command("mathra.copyAs")();
  assert.equal(fake.calls[0][0], "error");
  assert.match(fake.calls[0][1] as string, /^mathra: /);
});

test("save as SVG: next to the document, unless cancelled", async () => {
  fake.editor = editor("$x$", 1);
  await command("mathra.saveSvg")();
  assert.deepEqual(fake.calls, [["saveDialog", { defaultUri: { path: "/notes/doc.md/../equation.svg" }, filters: { SVG: ["svg"] } }]]);
  fake.calls = [];
  fake.saveTo = { path: "/notes/x.svg" };
  await command("mathra.saveSvg")();
  assert.equal(fake.calls[1][0], "writeFile");
  assert.deepEqual(fake.calls[1][1], { path: "/notes/x.svg" });
  assert.match(new TextDecoder().decode(fake.calls[1][2] as Uint8Array), /^<svg /);
  assert.deepEqual(fake.calls[2], ["status", "mathra: saved /notes/x.svg"]);
});

test("a change to mathra's settings refreshes the preview", () => {
  onConfig({ affectsConfiguration: (s) => s === "mathra" });
  onConfig({ affectsConfiguration: () => false });
  assert.deepEqual(fake.calls, [["execute", "markdown.preview.refresh"]]);
});

test("the preview's math, drawn by mathra while the setting says so", () => {
  const md = api.extendMarkdownIt(new MarkdownIt());
  assert.match(md.render("$x$"), /^<p><span class="mathra mathra-inline"><svg /);
  fake.config["mathra.preview.enabled"] = false;
  assert.equal(md.render("$x$"), "<p>$x$</p>\n");
});

test("save as PNG: resvg's drawing of the SVG", async () => {
  fake.editor = editor("$x^2$", 1);
  fake.saveTo = { path: "/notes/x.png" };
  await command("mathra.savePng")();
  assert.deepEqual(fake.calls[0], ["saveDialog", { defaultUri: { path: "/notes/doc.md/../equation.png" }, filters: { PNG: ["png"] } }]);
  const png = fake.calls[1][2] as Uint8Array;
  assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  // a second one, with resvg already loaded
  await command("mathra.savePng")();
  assert.equal(fake.calls.filter((c) => c[0] === "writeFile").length, 2);
});

test("explain: the rules and outputs, in a document beside", async () => {
  fake.editor = editor("$3,14$", 1);
  fake.config["mathra.locale"] = "pt-BR";
  await command("mathra.explain")();
  const [, opened] = fake.calls[0] as [string, { content: string; language: string }];
  assert.equal(opened.language, "plaintext");
  assert.match(opened.content, /^input    3,14\nlocale   pt-BR\n/);
  assert.match(opened.content, /\n  L-NUM-1   /);
  assert.deepEqual(fake.calls[1], ["showDocument", { untitled: opened }, { viewColumn: -2, preview: true }]);
  fake.editor = undefined;
  await command("mathra.explain")();
  assert.equal(fake.calls.length, 2);
});

test("the visual editor opens from the command, in mathra's locale", async () => {
  fake.config["mathra.locale"] = "pt-BR";
  await command("mathra.openEditor")();
  assert.match(fake.panels[0].webview.html, /<html lang="pt-BR">/);
  fake.panels[0].dispose();
});
