#!/bin/sh
# Builds the wasm the playground loads into site/pkg. Open site/index.html straight from disk or serve site/.
# Needs the wasm32-unknown-unknown target and wasm-bindgen-cli at the version in Cargo.lock.
set -e
cd "$(dirname "$0")/.."
cargo build -p mathra-wasm --profile wasm --target wasm32-unknown-unknown
rm -rf site/pkg
wasm-bindgen --target no-modules --no-typescript --out-dir site/pkg target/wasm32-unknown-unknown/wasm/mathra_wasm.wasm
# file:// pages cannot fetch the .wasm, but they can run a classic script: the same bytes as base64
printf 'var MATHRA_WASM_BASE64 = "%s";\n' "$(base64 < site/pkg/mathra_wasm_bg.wasm | tr -d '\n')" > site/pkg/mathra_wasm_bytes.js
# the reference page's tables (corpus/reference.json, checked by crates/core/tests/reference.rs) as a script,
# so the page also works opened from disk
printf 'var MATHRA_REFERENCE = %s;\n' "$(cat corpus/reference.json)" > site/pkg/reference_data.js
# the gallery page's groups (corpus/gallery.json, checked by crates/core/tests/examples.rs), the same way
printf 'var MATHRA_GALLERY = %s;\n' "$(cat corpus/gallery.json)" > site/pkg/gallery_data.js
# the releases of CHANGELOG.md, for the evolution page
python3 -I scripts/changelog.py js > site/pkg/changelog.js
# Noto Emoji, which the npm package leaves out: the playground downloads it only for an equation with a
# character the math font lacks, from the site itself, with its license next to it (and, for file://
# pages, as a script, like the wasm)
mkdir -p site/pkg/fonts
cp crates/core/fonts/NotoEmoji-Regular-subset.ttf crates/core/fonts/OFL-NotoEmoji.txt site/pkg/fonts/
printf 'var MATHRA_EMOJI_BASE64 = "%s";\n' "$(base64 < site/pkg/fonts/NotoEmoji-Regular-subset.ttf | tr -d '\n')" > site/pkg/fonts/noto_emoji_bytes.js
