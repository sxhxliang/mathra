// A stand-in for the `vscode` module, with what src/extension.ts uses: tests set `fake` and read
// `fake.calls`. test/setup.ts makes `import "vscode"` load this file.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// the extension reads resvg's wasm from its folder (/ext in these tests): here, from node_modules
const resvgWasm = createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm");

export const fake = {
  config: {} as Record<string, unknown>,
  calls: [] as unknown[][],
  editor: undefined as unknown,
  pick: undefined as unknown,
  saveTo: undefined as unknown,
  /** what `workspace.applyEdit` answers */
  editApplies: true,
  /** the documents `workspace.openTextDocument` opens by uri path */
  docs: {} as Record<string, unknown>,
  panels: [] as FakePanel[],
  reset() {
    this.editApplies = true;
    this.docs = {};
    this.panels = [];
    this.config = {};
    this.calls = [];
    this.editor = undefined;
    this.pick = undefined;
    this.saveTo = undefined;
    env.language = "en";
    window.activeColorTheme = { kind: ColorThemeKind.Light };
  },
};
const record = (...call: unknown[]) => fake.calls.push(call);

export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };

export class Range {
  start: unknown;
  end: unknown;
  constructor(start: unknown, end: unknown) {
    this.start = start;
    this.end = end;
  }
}
export class MarkdownString {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}
export class Hover {
  contents: MarkdownString;
  range: Range;
  constructor(contents: MarkdownString, range: Range) {
    this.contents = contents;
    this.range = range;
  }
}
export const Uri = {
  parse: (uri: string) => ({ path: uri.replace(/^file:\/\//, "") }),
  joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join("/") }),
};
export const ViewColumn = { Beside: -2 };
export class WorkspaceEdit {
  edits: unknown[][] = [];
  replace(uri: unknown, range: unknown, text: string) {
    this.edits.push([uri, range, text]);
  }
}

/** A webview panel: what the extension set on it, and its listeners to call. */
export class FakePanel {
  options: unknown;
  disposed = false;
  onDispose: (() => void)[] = [];
  onMessage: ((m: unknown) => Promise<void>)[] = [];
  posted: unknown[] = [];
  webview = {
    html: "",
    cspSource: "vscode-resource:",
    asWebviewUri: (uri: { path: string }) => `webview:${uri.path}`,
    onDidReceiveMessage: (listener: (m: unknown) => Promise<void>) => void this.onMessage.push(listener),
    postMessage: async (m: unknown) => void this.posted.push(m),
  };
  constructor(options: unknown) {
    this.options = options;
  }
  onDidDispose(listener: () => void) {
    this.onDispose.push(listener);
  }
  dispose() {
    this.disposed = true;
    for (const l of this.onDispose) l();
  }
}

export const env = {
  language: "en",
  clipboard: { writeText: async (text: string) => void record("clipboard", text) },
};

export const workspace = {
  getConfiguration: (section: string) => ({
    get: (key: string, fallback: unknown) => fake.config[`${section}.${key}`] ?? fallback,
  }),
  onDidChangeConfiguration: (listener: unknown) => (record("onDidChangeConfiguration", listener), { dispose() {} }),
  fs: {
    writeFile: async (uri: unknown, bytes: Uint8Array) => void record("writeFile", uri, bytes),
    readFile: async (uri: { path: string }) => readFileSync(uri.path.replace(/^\/ext\/resvg\.wasm$/, resvgWasm)),
  },
  asRelativePath: (uri: { path: string }) => uri.path,
  openTextDocument: async (what: { path?: string; content?: string; language?: string }) =>
    what.path === undefined ? (record("openDocument", what), { untitled: what }) : fake.docs[what.path],
  applyEdit: async (edit: WorkspaceEdit) => (record("applyEdit", edit.edits), fake.editApplies),
};

export const window = {
  activeColorTheme: { kind: ColorThemeKind.Light },
  get activeTextEditor() {
    return fake.editor;
  },
  showInformationMessage: (message: string) => void record("info", message),
  showErrorMessage: (message: string) => void record("error", message),
  setStatusBarMessage: (message: string) => void record("status", message),
  // answers with the item labelled `fake.pick`
  showQuickPick: async (items: { label: string }[], options: unknown) => (
    record("quickPick", items, options), items.find((i) => i.label === fake.pick)
  ),
  showSaveDialog: async (options: unknown) => (record("saveDialog", options), fake.saveTo),
  showTextDocument: async (doc: unknown, options: unknown) => void record("showDocument", doc, options),
  createWebviewPanel: (id: string, title: string, column: number, options: unknown) => {
    const panel = new FakePanel({ id, title, column, ...(options as object) });
    fake.panels.push(panel);
    return panel;
  },
};

export const languages = {
  registerHoverProvider: (selector: unknown, provider: unknown) => (record("hoverProvider", selector, provider), { dispose() {} }),
};

export const commands = {
  registerCommand: (id: string, run: unknown) => (record("command", id, run), { dispose() {} }),
  executeCommand: async (id: string) => void record("execute", id),
};
