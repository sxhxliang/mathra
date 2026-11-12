// The extension: math drawn by mathra in hovers and in the Markdown preview, and commands to copy or
// save what mathra writes. The rest of src/ knows nothing of the editor; this file ties it to it.

import * as vscode from "vscode";
import type MarkdownIt from "markdown-it";
import type { Result } from "@mathlabs/mathra";
import { mathAt, mathIn, type Language } from "./find.ts";
import { draw, explain, hoverDetails, hoverEquation, resolveLocale, toHtml } from "./draw.ts";
import { mathPlugin } from "./markdown.ts";
import { openEditor } from "./panel.ts";
import { toPng } from "./png.ts";

const SELECTOR = ["markdown", "latex", "tex"].map((language) => ({ language }));

function settings() {
  const config = vscode.workspace.getConfiguration("mathra");
  return {
    locale: resolveLocale(config.get<string>("locale", "auto"), vscode.env.language),
    hover: config.get<boolean>("hover.enabled", true),
    preview: config.get<boolean>("preview.enabled", true),
  };
}

function language(doc: vscode.TextDocument): Language {
  return doc.languageId === "markdown" ? "markdown" : "latex";
}

/** The color of text in the current theme, for images that cannot take it from the page. */
function textColor(): string {
  const kind = vscode.window.activeColorTheme.kind;
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast ? "#e8e8e8" : "#111111";
}

/** An equation of a document, named by a place inside it: what the hover's links pass to the commands. */
interface Where {
  uri: string;
  offset: number;
}

const command = (id: string, ...args: unknown[]) => `command:${id}?${encodeURIComponent(JSON.stringify(args))}`;

/** The hover's links: the equation in the visual editor, and copied in each form, named for what lands in the clipboard. */
function hoverLinks(where: Where): string {
  const copy = OUTPUTS.map((o) => `[${o.label}](${command("mathra.copyAs", where, o.id)} "Copy ${o.description}")`).join(" · ");
  return `[$(edit) Open in the visual editor](${command("mathra.openEditor", where)})\n\n$(copy) Copy as: ${copy}`;
}

/** The math under the mouse, its range, and where it is for the links; undefined off math or with hovers turned off. */
function hovered(doc: vscode.TextDocument, position: vscode.Position) {
  const s = settings();
  if (!s.hover) return undefined;
  const offset = doc.offsetAt(position);
  const span = mathAt(doc.getText(), offset, language(doc));
  if (!span) return undefined;
  const range = new vscode.Range(doc.positionAt(span.start), doc.positionAt(span.end));
  return { span, range, locale: s.locale, where: { uri: doc.uri.toString(), offset } };
}

function markdown(value: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString(value);
  // the links run only these commands
  md.isTrusted = { enabledCommands: ["mathra.openEditor", "mathra.copyAs"] };
  md.supportThemeIcons = true;
  return md;
}

// Two providers, so the hover has two parts, each with VS Code's copy button: the equation (whose
// button copies its LaTeX) and its details. VS Code shows the provider registered last first.
const details: vscode.HoverProvider = {
  provideHover(doc, position) {
    const h = hovered(doc, position);
    const value = h && hoverDetails(h.span.tex, h.span.display, h.locale, hoverLinks(h.where));
    return value === undefined ? undefined : new vscode.Hover(markdown(value), h!.range);
  },
};
const equations: vscode.HoverProvider = {
  provideHover(doc, position) {
    const h = hovered(doc, position);
    return h && new vscode.Hover(markdown(hoverEquation(h.span.tex, h.span.display, h.locale, textColor())), h.range);
  },
};

/** The editor a hover's link points into, as if its cursor were there; else the active editor. */
async function source(where?: Where): Promise<vscode.TextEditor | undefined> {
  if (!where) return vscode.window.activeTextEditor;
  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(where.uri));
  const at = document.positionAt(where.offset);
  return { document, selection: { isEmpty: true, active: at, start: at, end: at } } as unknown as vscode.TextEditor;
}

/** The equation the commands act on: the selection, or the math at the cursor (or at a hover's link). Tells the user when there is none or mathra cannot read it. */
async function target(where?: Where): Promise<{ result: Result; doc: vscode.TextDocument; tex: string; locale: string } | undefined> {
  const editor = await source(where);
  if (!editor) return undefined;
  const { document: doc, selection } = editor;
  const math = selection.isEmpty
    ? mathAt(doc.getText(), doc.offsetAt(selection.active), language(doc))
    : mathIn(doc.getText(selection), language(doc));
  if (!math) {
    vscode.window.showInformationMessage("mathra: no math at the cursor; select an equation or put the cursor inside one.");
    return undefined;
  }
  const { locale } = settings();
  const result = draw(math.tex, math.display, locale);
  if (result instanceof Error) {
    vscode.window.showErrorMessage(`mathra: ${result.message}`);
    return undefined;
  }
  return { result, doc, tex: math.tex.trim(), locale };
}

/** What the equation can be copied as: each is text, and says which. */
const OUTPUTS: { id: string; label: string; description: string; get: (r: Result, tex: string) => string }[] = [
  { id: "latex", label: "LaTeX", description: "the equation's source, without its delimiters", get: (_, tex) => tex },
  { id: "svg", label: "SVG", description: "the drawing's code, to paste in a page or a file", get: (r) => r.svg },
  { id: "mathml", label: "MathML", description: "the equation's markup, for HTML or Word", get: (r) => r.mathml },
  { id: "speech", label: "Speech", description: "the sentence a screen reader says", get: (r) => r.speech },
  { id: "braille", label: "Braille", description: "the braille cells, as Unicode text", get: (r) => r.braille },
  { id: "text", label: "Plain text", description: "a line of plain text, close to UnicodeMath", get: (r) => r.text },
];

/** A value in one line, short enough for a list or the status bar. */
function glimpse(value: string): string {
  const line = value.replace(/\s+/g, " ").trim();
  return line.length > 70 ? `${line.slice(0, 69)}…` : line;
}

/** Copies the equation in a form: the one a hover's link names, or the one picked in a list showing what each puts in the clipboard. */
async function copyAs(where?: Where, id?: string): Promise<void> {
  const t = await target(where);
  if (!t) return;
  const items = OUTPUTS.map((o) => ({ ...o, detail: glimpse(o.get(t.result, t.tex)) }));
  const pick = items.find((o) => o.id === id) ?? (await vscode.window.showQuickPick(items, { title: `Copy ${glimpse(t.tex)} as…`, placeHolder: "What goes to the clipboard is shown under each" }));
  if (!pick) return;
  await vscode.env.clipboard.writeText(pick.get(t.result, t.tex));
  vscode.window.setStatusBarMessage(`mathra: copied the ${pick.label}: ${pick.detail}`, 4000);
}

/** Asks where to save the equation as `kind`, next to the document, and writes what `bytes` makes. */
async function save(kind: "SVG" | "PNG", bytes: (r: Result) => Uint8Array | Promise<Uint8Array>): Promise<void> {
  const t = await target();
  if (!t) return;
  const ext = kind.toLowerCase();
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(t.doc.uri, "..", `equation.${ext}`),
    filters: { [kind]: [ext] },
  });
  if (!uri) return;
  await vscode.workspace.fs.writeFile(uri, await bytes(t.result));
  vscode.window.setStatusBarMessage(`mathra: saved ${vscode.workspace.asRelativePath(uri)}`, 3000);
}

/** What mathra did with the equation, as `mathra --explain` writes it, in a document beside. */
async function explainCommand(): Promise<void> {
  const t = await target();
  if (!t) return;
  const doc = await vscode.workspace.openTextDocument({ content: explain(t.tex, t.locale, t.result), language: "plaintext" });
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
}

export function activate(context: vscode.ExtensionContext) {
  // resvg's wasm, copied next to the bundle by build.mjs
  const resvg = async () => vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, "resvg.wasm"));
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(SELECTOR, details),
    vscode.languages.registerHoverProvider(SELECTOR, equations),
    vscode.commands.registerCommand("mathra.copyAs", copyAs),
    vscode.commands.registerCommand("mathra.saveSvg", () => save("SVG", (r) => new TextEncoder().encode(r.svg))),
    // three times the SVG's size, black on transparent: for a document or a slide
    vscode.commands.registerCommand("mathra.savePng", () => save("PNG", (r) => toPng(r.svg, 3, resvg))),
    vscode.commands.registerCommand("mathra.explain", explainCommand),
    vscode.commands.registerCommand("mathra.openEditor", async (where?: Where) => openEditor(context, settings().locale, await source(where))),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("mathra")) vscode.commands.executeCommand("markdown.preview.refresh");
    }),
  );
  return {
    extendMarkdownIt(md: MarkdownIt): MarkdownIt {
      return md.use(mathPlugin, {
        enabled: () => settings().preview,
        html: (tex: string, display: boolean) => toHtml(tex, display, settings().locale),
      });
    },
  };
}

export function deactivate(): void {}
