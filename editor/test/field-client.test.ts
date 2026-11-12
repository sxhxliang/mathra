// A component that works for a field named by `for`: when the field comes later in the page, it waits
// for it, then stops watching. Only what that needs of the DOM, stood in for here.

import { test } from "node:test";
import assert from "node:assert/strict";

const elements = new Map<string, { localName: string }>();
const page = { getElementById: (id: string) => elements.get(id) ?? null };
const observers: { changed: () => void; watching: boolean }[] = [];

class StandInElement {
  attributes = new Map<string, string>();
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  getRootNode() {
    return page;
  }
}
class StandInObserver {
  entry: { changed: () => void; watching: boolean };
  constructor(changed: () => void) {
    this.entry = { changed, watching: false };
    observers.push(this.entry);
  }
  observe() {
    this.entry.watching = true;
  }
  disconnect() {
    this.entry.watching = false;
  }
}
Object.assign(globalThis, { HTMLElement: StandInElement, MutationObserver: StandInObserver });

test("a field named by `for` that comes later: watched for, found, then no longer watched", async () => {
  const { FieldClient } = await import("../src/shared.ts");
  const client = new FieldClient() as InstanceType<typeof FieldClient> & StandInElement;
  client.attributes.set("for", "f");
  client.connectedCallback();
  assert.equal(client.field, null);
  assert.equal(observers.length, 1);
  assert.ok(observers[0].watching);
  // something else changes in the page: still waiting
  observers[0].changed();
  assert.ok(observers[0].watching);
  // the field comes
  const field = { localName: "mathra-field" };
  elements.set("f", field);
  observers[0].changed();
  assert.equal(client.field, field);
  assert.equal(observers[0].watching, false);
  // another field set, then none: each attached and let go
  client.field = { localName: "mathra-field" } as never;
  client.field = null;
  assert.equal(client.field, null);
  // taken out of the page: nothing left watching
  client.disconnectedCallback();
  assert.equal(observers[0].watching, false);
});
