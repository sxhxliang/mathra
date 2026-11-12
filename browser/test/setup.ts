// The editor's components need a browser: in these tests, `import "@mathlabs/mathra-editor"` loads nothing.

import { registerHooks } from "node:module";

registerHooks({
  resolve: (specifier, context, next) =>
    specifier === "@mathlabs/mathra-editor" ? { url: "data:text/javascript,", shortCircuit: true } : next(specifier, context),
});
