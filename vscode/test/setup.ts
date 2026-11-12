// `import "vscode"` loads test/vscode.ts, and the editor's components (which need a browser) nothing:
// import this before src/extension.ts or src/webview/main.ts.

import { registerHooks } from "node:module";

const stand = {
  vscode: new URL("./vscode.ts", import.meta.url).href,
  "@mathlabs/mathra-editor": "data:text/javascript,",
} as Record<string, string>;
registerHooks({
  resolve: (specifier, context, next) => (specifier in stand ? { url: stand[specifier], shortCircuit: true } : next(specifier, context)),
});
