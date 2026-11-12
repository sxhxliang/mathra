#!/bin/sh
# Writes the fonts embedded in crates/core/fonts from the originals in this folder, named *-subset.otf
# so they are not taken for the originals (crates/core/fonts/README.md). Keeps only what mathra
# reads: outlines, metrics, cmap and the MATH table, with every character and every glyph ID.
# Glyph IDs stay as in the original because they name the paths in the SVG (`id="…-g3330"`).
# Left out: hinting (the SVG uses the outlines only), GPOS and all of GSUB but `ssty` (the forms for
# scripts; mathra does not shape text, so the glyphs reached only through the rest go too), glyph names and every name but copyright and license.
# Then Noto Emoji (the monochrome one, the fallback of the `emoji` feature): its variable font fixed
# at the default weight (wght 400) and cut to the glyphs the cmap reaches, with no GSUB (mathra does
# not shape text, so ZWJ sequences, flags and skin tones go), no vertical metrics and no hinting.
# Its glyph IDs change, which is fine: no SVG names them yet (a new font gets new ids).
# Needs fonttools (pip install fonttools==4.65.0); the output is checked in, so run it only when a
# font or this list changes, then `cargo test -p mathra --all-features`. SOURCE_DATE_EPOCH fixes the
# instancer's timestamp, so the same input writes the same bytes.
set -e
cd "$(dirname "$0")"
for font in STIXTwoMath-Regular.otf latinmodern-math.otf; do
  pyftsubset "$font" \
    --unicodes='*' \
    --retain-gids \
    --layout-features='ssty' \
    --drop-tables+=GPOS,GDEF,DSIG,FFTM \
    --name-IDs=0,13,14 \
    --no-glyph-names \
    --notdef-outline \
    --no-hinting \
    --desubroutinize \
    --output-file="../../crates/core/fonts/${font%.otf}-subset.otf"
  echo "crates/core/fonts/${font%.otf}-subset.otf: $(wc -c < "$font" | tr -d ' ') -> $(wc -c < "../../crates/core/fonts/${font%.otf}-subset.otf" | tr -d ' ') bytes"
done
emoji="NotoEmoji[wght].ttf"
out="../../crates/core/fonts/NotoEmoji-Regular-subset.ttf"
instance="$(mktemp -d)/NotoEmoji-Regular.ttf"
SOURCE_DATE_EPOCH=0 fonttools varLib.instancer "$emoji" wght=400 --quiet --output="$instance"
SOURCE_DATE_EPOCH=0 pyftsubset "$instance" \
  --unicodes='*' \
  --layout-features='' \
  --drop-tables+=GSUB,GPOS,GDEF,STAT,vhea,vmtx,gasp,DSIG \
  --name-IDs=0,13,14 \
  --no-glyph-names \
  --notdef-outline \
  --no-hinting \
  --output-file="$out"
rm -r "$(dirname "$instance")"
echo "crates/core/fonts/NotoEmoji-Regular-subset.ttf: $(wc -c < "$emoji" | tr -d ' ') -> $(wc -c < "$out" | tr -d ' ') bytes"
