// The extension's page: mathra's editor filling it, in the browser's language, on the LaTeX the
// address carries (#latex=…, from the menu on a selection).

import "@mathlabs/mathra-editor";

/** Puts the editor in the page, as the address and the browser's language say. */
export function start(): void {
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has("window")) document.body.classList.add("window");

  const editor = document.createElement("mathra-editor");
  editor.setAttribute("layout", "page");
  // the bar on one line in the popup: no zoom (the browser has its own), the theme follows the browser's
  editor.setAttribute("controls", "history gallery settings language keyboard outputs");
  editor.setAttribute("theme", "auto");
  // the browser's language, as close as mathra has it; the editor's menu changes it
  const lang = navigator.language;
  editor.setAttribute("locale", lang.toLowerCase().startsWith("pt") ? "pt-BR" : lang.split("-")[0]);
  editor.setAttribute("value", params.get("latex") ?? "");
  editor.setAttribute("aria-label", "Formula");
  document.body.append(editor);
  // the popup opens ready to type
  requestAnimationFrame(() => editor.focus());
}

start();
