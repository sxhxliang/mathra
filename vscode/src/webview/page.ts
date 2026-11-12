// The visual editor's page, inside a VS Code webview: mathra's <mathra-editor> filling the panel, and a
// button in its bar that sends the formula back to the document. Runs in the webview; the extension
// side is src/panel.ts.

/** What the extension gives the page: the formula to start from, and how it goes back. */
export interface PageInit {
  latex: string;
  locale: string;
  theme: "light" | "dark";
  /** "insert" puts the formula at the cursor, "replace" over the equation it came from, "copy" in the clipboard (no document). */
  action: "insert" | "replace" | "copy";
}

/** The messages between the page and the extension. */
export type ToExtension = { type: "apply"; latex: string };
export type ToPage = { type: "action"; action: PageInit["action"] };

const LABELS: Record<PageInit["action"], string> = {
  insert: "Insert in the document",
  replace: "Update the document",
  copy: "Copy LaTeX",
};

interface Element {
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: { key?: string; ctrlKey?: boolean; metaKey?: boolean; preventDefault(): void }) => void): void;
  append(...nodes: Element[]): void;
  textContent: string | null;
  slot: string;
  value?: string;
}
interface Page {
  createElement(tag: string): Element;
  body: Element;
}

/** Builds the page and wires it to the extension; returns what handles the extension's messages. */
export function start(doc: Page, post: (message: ToExtension) => void, init: PageInit): (message: ToPage) => void {
  const editor = doc.createElement("mathra-editor");
  editor.setAttribute("layout", "page");
  editor.setAttribute("locale", init.locale);
  editor.setAttribute("theme", init.theme);
  editor.setAttribute("value", init.latex);
  editor.setAttribute("aria-label", "Formula");

  const apply = doc.createElement("button");
  apply.slot = "actions";
  apply.setAttribute("part", "action");
  apply.setAttribute("title", "Ctrl/⌘+S");
  apply.textContent = LABELS[init.action];
  const send = () => post({ type: "apply", latex: editor.value! });
  apply.addEventListener("click", send);
  // Ctrl/⌘+S, as saving a file: the formula goes back to the document
  editor.addEventListener("keydown", (e) => {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  });

  editor.append(apply);
  doc.body.append(editor);
  return (message) => {
    apply.textContent = LABELS[message.action];
  };
}
