#!/bin/sh
# Packs npm/pkg the way npm publish would, installs the tarball in a scratch project and runs the
# tests against it, so exports, files and both module systems are checked as users get them.
set -e
cd "$(dirname "$0")/.."
tgz=$(cd pkg && npm pack --silent --pack-destination ..)
project=$(mktemp -d)
cp test/*.test.* "$project/"
# a math font from outside the package, for the loadFont test
font="$PWD/../tools/fonts/latinmodern-math.otf"
# a tiny fallback font (a square 中 and a diamond 😀), for the loadFallbackFont test
fallback="$PWD/../crates/core/tests/fonts/fallback-a.ttf"
(cd "$project" && npm init -y >/dev/null && npm install --silent "$OLDPWD/$tgz" && MATHRA_TEST_FONT="$font" MATHRA_TEST_FALLBACK="$fallback" node --test)
rm -rf "$project" "$tgz"
