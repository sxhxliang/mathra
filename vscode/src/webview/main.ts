// The webview's script: the editor's components, and the page built from what the extension wrote
// in <script id="init">.

import "@mathlabs/mathra-editor";
import { start, type PageInit, type ToExtension, type ToPage } from "./page.ts";

declare function acquireVsCodeApi(): { postMessage(message: ToExtension): void };

const vscode = acquireVsCodeApi();
const init: PageInit = JSON.parse(document.getElementById("init")!.textContent!);
const update = start(document as never, (m) => vscode.postMessage(m), init);
window.addEventListener("message", (e: MessageEvent<ToPage>) => update(e.data));
