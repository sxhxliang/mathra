# mathra for Chrome and Edge

mathra's editor in the browser: click the toolbar's *m* to build an equation (palettes, the gallery, the fonts, the keyboard) and copy it as LaTeX, MathML, SVG, an image, speech or braille; or select LaTeX on any page, right-click and choose **Open “…” in mathra** to see it drawn and spoken, in a window of its own. Everything runs in the extension, on mathra's WebAssembly: nothing is sent anywhere ([privacy](https://matheusmota-dev-br.github.io/mathra/privacy.html)).

One build serves Chrome and Edge (Manifest V3). Its texts are in English and Portuguese (`static/_locales`).

## Try it

From the repository, with `npm/pkg` and the editor built (`npm/build.sh`, then `pnpm build` in `editor/`):

```sh
cd browser
pnpm install
pnpm build       # extension/
```

Then in `chrome://extensions` (or `edge://extensions`), turn on Developer mode, **Load unpacked**, and pick `browser/extension`. After a change, `pnpm build` and the card's reload button.

## Develop

```sh
pnpm test        # the tests; `pnpm coverage` asks every line, branch and function of src/ to run
pnpm typecheck
pnpm zip         # mathra-<version>.zip, for the Chrome Web Store and Edge Add-ons
```

`src/page.ts` is the page of the popup and of the window a selection opens: `<mathra-editor>` filling it. `src/background.ts` is the service worker: the menu on a selection. `static/` holds the manifest, the page and the texts; `build.mjs` bundles mathra and the editor into the extension (an extension may not load code from elsewhere), copies the wasm and draws the icons from `docs/vscode-icon.svg`. The tests run both scripts in Node, `chrome` and the page stood in for.
