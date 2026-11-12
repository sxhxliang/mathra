import "./setup.ts";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { start, type PageInit } from "../src/webview/page.ts";

type Listener = (e: { key?: string; ctrlKey?: boolean; metaKey?: boolean; preventDefault(): void }) => void;

/** Elements enough for the page: attributes, listeners, children. */
class Element {
  tag: string;
  attributes: Record<string, string> = {};
  listeners: Record<string, Listener> = {};
  children: Element[] = [];
  textContent: string | null = null;
  slot = "";
  value?: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners[type] = listener;
  }
  append(...nodes: Element[]) {
    this.children.push(...nodes);
  }
}
const page = () => ({ createElement: (tag: string) => new Element(tag), body: new Element("body") });

test("the editor fills the page, with the button that sends the formula back", () => {
  const doc = page();
  const sent: unknown[] = [];
  const init: PageInit = { latex: "x", locale: "pt-BR", theme: "dark", action: "insert" };
  const update = start(doc, (m) => sent.push(m), init);
  const editor = doc.body.children[0];
  assert.equal(editor.tag, "mathra-editor");
  assert.deepEqual(editor.attributes, { layout: "page", locale: "pt-BR", theme: "dark", value: "x", "aria-label": "Formula" });
  const button = editor.children[0];
  assert.equal(button.slot, "actions");
  assert.equal(button.textContent, "Insert in the document");
  editor.value = "x^2";
  button.listeners.click({ preventDefault() {} });
  // Ctrl/⌘+S sends too; other keys do not
  let prevented = 0;
  const key = (e: object) => editor.listeners.keydown({ preventDefault: () => prevented++, ...e });
  key({ key: "s", metaKey: true });
  key({ key: "s", ctrlKey: true });
  key({ key: "s" });
  key({ key: "a", ctrlKey: true });
  assert.equal(prevented, 2);
  assert.deepEqual(sent, Array(3).fill({ type: "apply", latex: "x^2" }));
  update({ type: "action", action: "replace" });
  assert.equal(button.textContent, "Update the document");
  start(page(), () => {}, { ...init, action: "copy" });
});

test("the webview's script: the page from <script id=init>, the extension's messages to it", async () => {
  const doc = page();
  const posted: unknown[] = [];
  let onMessage: (e: { data: unknown }) => void = () => {};
  Object.assign(globalThis, {
    acquireVsCodeApi: () => ({ postMessage: (m: unknown) => posted.push(m) }),
    document: Object.assign(doc, {
      getElementById: (id: string) => (id === "init" ? { textContent: JSON.stringify({ latex: "a", locale: "en", theme: "light", action: "replace" }) } : null),
    }),
    window: { addEventListener: (_: string, l: typeof onMessage) => (onMessage = l) },
  });
  await import("../src/webview/main.ts");
  const editor = doc.body.children[0];
  assert.equal(editor.attributes.value, "a");
  editor.value = "b";
  editor.children[0].listeners.click({ preventDefault() {} });
  assert.deepEqual(posted, [{ type: "apply", latex: "b" }]);
  onMessage({ data: { type: "action", action: "copy" } });
  assert.equal(editor.children[0].textContent, "Copy LaTeX");
});
