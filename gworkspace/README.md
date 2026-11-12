# mathra for Google Docs and Slides

An add-on: **Extensions → mathra → Insert equation** opens mathra's sidebar beside the document, with the palettes, the gallery, the options and fonts, the keyboard and the outputs. **Insert** puts the equation at the cursor (Docs) or on the slide (Slides) as an image, sharp when zoomed or printed, whose alt text is what a screen reader says, in the language chosen. Select an equation and it comes back to the sidebar, to be updated in place; its link opens it in [mathra's editor](https://matheusmota-dev-br.github.io/mathra/editor.html) on the web.

It asks Google for the current document or presentation only, and nothing is sent to mathra ([privacy](https://matheusmota-dev-br.github.io/mathra/privacy.html), [terms](https://matheusmota-dev-br.github.io/mathra/terms.html)).

## Files

- `src/Code.js`: Apps Script: the menu, the sidebar, the image put in the document, the selected equation read back from its link.
- `src/Sidebar.html` and `src/sidebar.js`: the sidebar, 300 px wide. mathra and the editor come from jsDelivr (an add-on's page may load them). `build.mjs` puts the script inside the page into `dist/`, since Apps Script serves one HTML file, and `dist/` is what clasp pushes.
- `preview/`: the sidebar beside a stand-in for Google Docs, with no Google account.

## Try it without Google

```sh
cd gworkspace
pnpm install
pnpm preview     # http://127.0.0.1:4530/ (LOCAL=1 to use this repository's npm/pkg and editor/dist)
```

## Try it in your Google Docs

Once: turn on the Apps Script API at https://script.google.com/home/usersettings, then `npx @google/clasp login`, and make a document with the script bound to it:

```sh
npx @google/clasp create-script --type docs --title "mathra (test)" --rootDir dist
```

Then `pnpm push` (build and push) after each change, and in the document **Extensions → mathra (test) → Insert equation**. Google asks to authorize the script the first time ("Google hasn't verified this app": Advanced → go to it). `.clasp.json` names your own project, so it stays out of git.

## Tests

```sh
pnpm test        # src/Code.js in Node, Apps Script stood in for (test/google.mts)
pnpm coverage    # that, at 100% of lines, branches and functions; then the sidebar in Chromium (test/sidebar.mjs)
```

`test/sidebar.mjs` drives the preview with this repository's mathra and editor (`npm/pkg` and `editor/dist` built): typing and the alt text, inserting, an equation selected and updated, what Docs refuses, the bar, the gallery, the options, the languages; every line and function of `src/sidebar.js` must run.
