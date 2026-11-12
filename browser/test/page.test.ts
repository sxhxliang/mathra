import "./setup.ts";
import { strict as assert } from "node:assert";
import { test } from "node:test";

/** A page enough for the extension's: elements with attributes, a body, the frame callback. */
function page(hash: string, language: string) {
  const made: { tag: string; attributes: Record<string, string>; focused: boolean }[] = [];
  const classes: string[] = [];
  let frame: () => void = () => {};
  // Node has a `navigator` of its own, with getters only: the page's is defined over it
  Object.defineProperty(globalThis, "navigator", { value: { language }, configurable: true });
  Object.assign(globalThis, {
    location: { hash },
    requestAnimationFrame: (f: () => void) => (frame = f),
    document: {
      createElement: (tag: string) => {
        const el = { tag, attributes: {} as Record<string, string>, focused: false, setAttribute: (k: string, v: string) => (el.attributes[k] = v), focus: () => (el.focused = true) };
        made.push(el);
        return el;
      },
      body: { classList: { add: (c: string) => classes.push(c) }, append: () => {} },
    },
  });
  return { made, classes, frame: () => frame() };
}

// the module puts the editor in the page as it loads; later pages call `start` again
let start: (() => void) | undefined;
async function load() {
  if (start) return start();
  ({ start } = await import("../src/page.ts"));
}

test("the popup: the editor filling it, its bar on one line, empty, focused", async () => {
  const p = page("", "en-US");
  await load();
  const [editor] = p.made;
  assert.deepEqual(editor.attributes, {
    layout: "page",
    controls: "history gallery settings language keyboard outputs",
    theme: "auto",
    locale: "en",
    value: "",
    "aria-label": "Formula",
  });
  assert.deepEqual(p.classes, []);
  assert.equal(editor.focused, false);
  p.frame();
  assert.equal(editor.focused, true);
});

test("a selection's window: its LaTeX, the window's layout, Portuguese for pt", async () => {
  const p = page("#window&latex=%5Cfrac12", "pt-PT");
  await load();
  assert.equal(p.made[0].attributes.value, "\\frac12");
  assert.equal(p.made[0].attributes.locale, "pt-BR");
  assert.deepEqual(p.classes, ["window"]);
});
