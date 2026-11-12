// The sidebar beside a stand-in for Google Docs (doc.html), with no Google account: google.script.run
// calls the page's functions instead of Code.js. node preview/serve.mjs, then http://127.0.0.1:4530/
// mathra and the editor come from jsDelivr, as in Google; with LOCAL=1 (as the tests run it), from this
// repository's npm/pkg and editor/dist, which must be built.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const at = (path) => new URL(path, import.meta.url);
const root = fileURLToPath(new URL("../../", import.meta.url));
const types = { js: "text/javascript", mjs: "text/javascript", wasm: "application/wasm", json: "application/json", css: "text/css", html: "text/html; charset=utf-8" };

// google.script.run, as Apps Script gives it to a sidebar: chained handlers, then the function's name.
// parent.mathraFail[name], when set, makes that call fail with it as the message
const mock = `<script>
window.google = { script: { run: (function chain(ok, fail) {
  return new Proxy({}, { get: (_, name) =>
    name === "withSuccessHandler" ? (f) => chain(f, fail)
    : name === "withFailureHandler" ? (f) => chain(ok, f)
    : (...args) => setTimeout(() => {
        try {
          const failure = parent.mathraFail && parent.mathraFail[name];
          if (failure) throw new Error(failure);
          const r = parent.mathraMock[name](...args); ok && ok(r);
        } catch (e) { fail && fail(e); }
      }, 60) });
})() } };
</script>`;

/** Serves the preview on `port`; with `local`, mathra and the editor from the repository. */
export function serve(port, local = false) {
  return createServer((req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    const send = (body, type) => res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
    if (path === "/Sidebar.html") {
      let html = readFileSync(at("../src/Sidebar.html"), "utf8").replace("<head>", `<head>${mock}`);
      if (local) {
        html = html
          .replace(/"@mathlabs\/mathra": "[^"]+"/, '"@mathlabs/mathra": "/npm/pkg/web/index.js"')
          .replace(/"@mathlabs\/mathra-editor": "[^"]+"/, '"@mathlabs/mathra-editor": "/editor/dist/index.js"');
      }
      return send(html, types.html);
    }
    if (path === "/sidebar.js") return send(readFileSync(at("../src/sidebar.js")), types.js);
    if (local && (path.startsWith("/npm/pkg/") || path.startsWith("/editor/dist/"))) {
      try {
        return send(readFileSync(root + path.slice(1)), types[path.split(".").pop()] ?? "application/octet-stream");
      } catch {
        return res.writeHead(404).end();
      }
    }
    send(readFileSync(at("doc.html")), types.html);
  }).listen(port, "127.0.0.1");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = 4530;
  serve(port, process.env.LOCAL === "1");
  console.log(`http://127.0.0.1:${port}/`);
}
