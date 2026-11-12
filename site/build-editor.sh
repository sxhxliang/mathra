#!/bin/sh
# Puts the editor page's code into site/pkg/editor: mathra as the npm package has it for browsers (the
# web glue and the wasm, which editor.html maps "@mathlabs/mathra" to) and the editor built from editor/.
# Run after site/build.sh. Needs what npm/build.sh needs, Node 24 and pnpm. The page loads ES modules and
# fetches the wasm, so serve site/ to open it; it does not work straight from disk as the others do.
set -e
cd "$(dirname "$0")/.."
npm/build.sh
(
  cd editor
  pnpm install --frozen-lockfile --silent
  pnpm build
)
out=site/pkg/editor
rm -rf "$out"
mkdir -p "$out/dist"
cp -R npm/pkg/web "$out/web"
cp npm/pkg/mathra.wasm "$out/mathra.wasm"
cp editor/dist/*.js "$out/dist/"
