// The visual editor: mathra's editor in a webview beside the document. It opens on the equation at the
// cursor (or the selection) and writes the formula back over it, or at the cursor as `$…$`.

import * as vscode from "vscode";
import { inner, mathAt, mathIn, type Language } from "./find.ts";
import type { PageInit, ToExtension, ToPage } from "./webview/page.ts";

/** Where the formula goes back: a range of a document, and whether it still needs delimiters there. */
interface Target {
  uri: vscode.Uri;
  range: vscode.Range;
  wrap: boolean;
}

/** The equation the editor starts from and where it goes back, from the active editor. */
export function targetOf(editor: vscode.TextEditor | undefined): { latex: string; target?: Target } {
  if (!editor) return { latex: "" };
  const { document: doc, selection } = editor;
  const language: Language = doc.languageId === "markdown" ? "markdown" : "latex";
  const at = (start: number, end: number, wrap: boolean): Target => ({
    uri: doc.uri,
    range: new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
    wrap,
  });
  if (!selection.isEmpty) {
    const base = doc.offsetAt(selection.start);
    const math = mathIn(doc.getText(selection), language);
    // a selection of spaces alone holds no formula: a new one goes where it starts
    if (!math) return { latex: "", target: at(base, base, true) };
    return { latex: math.tex, target: at(base + math.texStart, base + math.texStart + math.tex.length, false) };
  }
  const offset = doc.offsetAt(selection.active);
  const text = doc.getText();
  const span = mathAt(text, offset, language);
  if (!span) return { latex: "", target: at(offset, offset, true) };
  const { tex, start } = inner(text, span);
  return { latex: tex, target: at(start, start + tex.length, false) };
}

/** The webview's HTML: the page's script and what it starts from, under a policy that lets only them in. */
export function html(webview: vscode.Webview, root: vscode.Uri, init: PageInit): string {
  const script = webview.asWebviewUri(vscode.Uri.joinPath(root, "dist", "webview.js"));
  const src = webview.cspSource;
  // the wasm is fetched and compiled ('wasm-unsafe-eval'); the fonts of mathra's catalog come over https
  const csp = [
    "default-src 'none'",
    `script-src ${src} 'wasm-unsafe-eval'`,
    `style-src ${src} 'unsafe-inline'`,
    `img-src ${src} data: blob:`,
    `font-src ${src} data:`,
    `connect-src ${src} https:`,
  ].join("; ");
  // `<` in the JSON would end the script element early
  const data = JSON.stringify(init).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${init.locale}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { height: 100%; margin: 0; padding: 0; }
  body {
    --mathra-background: var(--vscode-editor-background);
    --mathra-page: var(--vscode-editor-background);
    --mathra-surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
    --mathra-ink: var(--vscode-editor-foreground);
    --mathra-muted: var(--vscode-descriptionForeground);
    --mathra-border: var(--vscode-panel-border, var(--vscode-widget-border));
    --mathra-focus: var(--vscode-focusBorder);
    --mathra-accent: var(--vscode-button-background);
    --mathra-font: var(--vscode-font-family);
    --mathra-mono: var(--vscode-editor-font-family);
    color-scheme: ${init.theme};
  }
  mathra-editor { height: 100%; }
  button[slot="actions"] {
    font: inherit; padding: 4px 12px; border: 0; border-radius: 2px; cursor: pointer;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  button[slot="actions"]:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
<script id="init" type="application/json">${data}</script>
<script type="module" src="${script}"></script>
</body>
</html>`;
}

/** The text that goes into the document for a formula: as it is over an equation, between `$` at a bare cursor. */
export function textFor(latex: string, wrap: boolean): string {
  return wrap ? `$${latex}$` : latex;
}

let panel: vscode.WebviewPanel | undefined;

/** Opens the editor on the equation at the cursor of `editor`; an editor already open is closed and opened again on it. */
export function openEditor(context: vscode.ExtensionContext, locale: string, editor: vscode.TextEditor | undefined): void {
  const { latex, target: first } = targetOf(editor);
  let target = first;
  panel?.dispose();
  const current = vscode.window.createWebviewPanel("mathra.editor", "mathra editor", vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [context.extensionUri],
  });
  panel = current;
  const kind = vscode.window.activeColorTheme.kind;
  const theme = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast ? "dark" : "light";
  const action = !target ? "copy" : target.wrap ? "insert" : "replace";
  current.webview.html = html(current.webview, context.extensionUri, { latex, locale, theme, action });
  // the panel before this one closes above, before `panel` is this one
  current.onDidDispose(() => (panel = undefined));
  current.webview.onDidReceiveMessage(async (message: ToExtension) => {
    if (!target) {
      await vscode.env.clipboard.writeText(message.latex);
      vscode.window.setStatusBarMessage("mathra: LaTeX copied", 3000);
      return;
    }
    const doc = await vscode.workspace.openTextDocument(target.uri);
    const text = textFor(message.latex, target.wrap);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(target.uri, target.range, text);
    if (!(await vscode.workspace.applyEdit(edit))) {
      vscode.window.showErrorMessage("mathra: the document could not be changed.");
      return;
    }
    // from now on the formula replaces what was just written, inside its delimiters
    const start = doc.offsetAt(target.range.start) + (target.wrap ? 1 : 0);
    target = { uri: target.uri, range: new vscode.Range(doc.positionAt(start), doc.positionAt(start + message.latex.length)), wrap: false };
    current.webview.postMessage({ type: "action", action: "replace" } satisfies ToPage);
    vscode.window.setStatusBarMessage("mathra: formula written to the document", 3000);
  });
}
