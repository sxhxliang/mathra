"""Writes the tiny fonts of crates/core/tests (fallback.rs, coverage_fonts.rs) into crates/core/tests/fonts.

Made here from plain shapes, so they are the repository's own (MIT OR Apache-2.0), not a cut of
someone's font:

- fallback-a.ttf: TrueType outlines (glyf), 1000 units per em; a square for U+4E2D (中) and a
  diamond for U+1F600 (😀).
- fallback-b.otf: CFF outlines, 2048 units per em; a triangle for U+1F600 (😀) and nothing else.
- ssty.ttf: TrueType outlines, 1000 units per em; a square A and a triangle B, each with a smaller
  script form (A.s1, B.s1) in a GSUB `ssty` alternate substitution whose coverage is format 1 (a
  list of glyphs: 1 and 3), which the embedded fonts do not use.

Needs fonttools (pip install fonttools==4.65.0). The output is checked in; run it only to change
the fonts: python3 tools/fonts/test_fonts.py
"""

import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "crates", "core", "tests", "fonts")


def shape(pen, points):
    pen.moveTo(points[0])
    for p in points[1:]:
        pen.lineTo(p)
    pen.closePath()


def build(path, upm, glyphs, cff, features=None):
    """`glyphs`: (name, code point or None, advance, points of one closed contour or None)."""
    fb = FontBuilder(upm, isTTF=not cff)
    order = [g[0] for g in glyphs]
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({cp: name for name, cp, _, _ in glyphs if cp is not None})
    name = os.path.splitext(os.path.basename(path))[0]
    if cff:
        charstrings = {}
        for g, _, advance, points in glyphs:
            pen = T2CharStringPen(advance, None)
            if points:
                shape(pen, points)
            charstrings[g] = pen.getCharString()
        fb.setupCFF(name, {"FullName": name}, charstrings, {})
    else:
        outlines = {}
        for g, _, _, points in glyphs:
            pen = TTGlyphPen(None)
            if points:
                shape(pen, points)
            outlines[g] = pen.glyph()
        fb.setupGlyf(outlines)
    metrics = {}
    for g, _, advance, points in glyphs:
        left = min(p[0] for p in points) if points else 0
        metrics[g] = (advance, left)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=int(upm * 0.8), descent=-int(upm * 0.2))
    fb.setupNameTable({"familyName": name, "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=int(upm * 0.8), sTypoDescender=-int(upm * 0.2), usWinAscent=int(upm * 0.8), usWinDescent=int(upm * 0.2))
    fb.setupPost()
    fb.setupHead(unitsPerEm=upm, created=0, modified=0)
    if features:
        fb.addOpenTypeFeatures(features)
    fb.save(path)


os.makedirs(OUT, exist_ok=True)
build(
    os.path.join(OUT, "fallback-a.ttf"),
    1000,
    [
        (".notdef", None, 500, None),
        ("uni4E2D", 0x4E2D, 1000, [(100, -100), (900, -100), (900, 700), (100, 700)]),
        ("u1F600", 0x1F600, 1000, [(500, -100), (900, 300), (500, 700), (100, 300)]),
    ],
    cff=False,
)
build(
    os.path.join(OUT, "fallback-b.otf"),
    2048,
    [
        (".notdef", None, 1024, None),
        ("u1F600", 0x1F600, 2048, [(200, 0), (1848, 0), (1024, 1600)]),
    ],
    cff=True,
)
build(
    os.path.join(OUT, "ssty.ttf"),
    1000,
    [
        (".notdef", None, 500, None),
        ("A", 0x41, 1000, [(100, 0), (900, 0), (900, 800), (100, 800)]),
        ("A.s1", None, 800, [(100, 0), (700, 0), (700, 600), (100, 600)]),
        ("B", 0x42, 1000, [(100, 0), (900, 0), (500, 800)]),
        ("B.s1", None, 800, [(100, 0), (700, 0), (400, 600)]),
    ],
    cff=False,
    features="feature ssty { sub A from [A.s1]; sub B from [B.s1]; } ssty;",
)
print("wrote", OUT)
