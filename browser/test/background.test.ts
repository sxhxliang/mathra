import { strict as assert } from "node:assert";
import { test } from "node:test";

// chrome, as a service worker has it: what the extension registers and calls
const calls: unknown[][] = [];
const listeners: Record<string, (...args: never[]) => void> = {};
Object.assign(globalThis, {
  chrome: {
    runtime: {
      onInstalled: { addListener: (f: () => void) => (listeners.installed = f) },
      getURL: (path: string) => `chrome-extension://id/${path}`,
    },
    i18n: { getMessage: (name: string) => `[${name}]` },
    contextMenus: {
      create: (item: unknown) => calls.push(["create", item]),
      onClicked: { addListener: (f: () => void) => (listeners.clicked = f) },
    },
    windows: { create: (options: unknown) => calls.push(["window", options]) },
  },
});
const { bare } = await import("../src/background.ts");

test("installed: the menu item on a selection, in the browser's language", () => {
  listeners.installed();
  assert.deepEqual(calls, [["create", { id: "mathra-open", title: "[openSelection]", contexts: ["selection"] }]]);
});

test("the item opens the selection, without its delimiters, in a window of the editor", () => {
  calls.length = 0;
  const click = listeners.clicked as (info: object) => void;
  click({ menuItemId: "mathra-open", selectionText: " $x^2$ " });
  click({ menuItemId: "mathra-open" });
  click({ menuItemId: "another" });
  assert.deepEqual(calls, [
    ["window", { url: "chrome-extension://id/editor.html#window&latex=x%5E2", type: "popup", width: 1000, height: 700 }],
    ["window", { url: "chrome-extension://id/editor.html#window&latex=", type: "popup", width: 1000, height: 700 }],
  ]);
});

test("bare: the delimiters of display and inline math, and nothing else", () => {
  assert.equal(bare("$$ a+b $$"), "a+b");
  assert.equal(bare("\\[x\\]"), "x");
  assert.equal(bare("\\(y\\)"), "y");
  assert.equal(bare("$z$"), "z");
  // too short to hold anything, or not closed: as it is
  assert.equal(bare("$$"), "$$");
  assert.equal(bare("$x"), "$x");
  assert.equal(bare("\\frac12"), "\\frac12");
});
