"""Math LaTeX to accessible SVG, without a TeX install.

>>> import mathra
>>> mathra.render(r"\\frac{3}{4}", locale="fr")["speech"]
'trois quarts'
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Sequence, TypedDict, Union

from . import _mathra

__version__: str = _mathra.__version__
#: The version of mathra's core inside this package.
core_version: str = _mathra.core_version


class Rule(TypedDict):
    """A numbered rule from spec/rules.md or spec/tolerance.md, and what it did to this equation."""

    rule: str
    description: str


class Result(TypedDict):
    svg: str
    """Standalone SVG with the speech in <title> and the source and tree in <metadata>."""
    speech: str
    """The phrase a screen reader says, in the locale's language."""
    text: str
    """Linear text, close to UnicodeMath."""
    braille: str
    """The equation in braille, as Unicode braille cells."""
    braille_code: str
    """The braille code used: "cmu" or "nemeth"."""
    mathml: str
    """The equation as presentation MathML (MathML Core, with intent where it adds meaning)."""
    tree: Any
    """The tree of meaning."""
    applied: List[Rule]
    """Rules that changed something in this equation, in the order they acted."""
    warnings: List[Rule]
    """Input problems the tolerant mode worked around (E-REC-*); empty in strict mode."""
    boxes: List[Dict[str, Any]]
    """The boxes of the groups marked with \\htmlData, \\htmlId, \\class...: ``attributes``, ``x``, ``y``,
    ``width``, ``height``, ``baseline`` and ``level``, in the SVG's coordinates (y down). Empty when nothing is marked."""


@dataclass(frozen=True)
class Font:
    """A math font loaded with :func:`load_font`, to pass as ``font``."""

    id: int
    name: str
    """The font's family name, as the SVG's ``<mathra:font>`` carries it."""


def load_font(source: Union[str, os.PathLike, bytes]) -> Font:
    """Loads an OpenType math font (an .otf or .ttf with a MATH table, such as Libertinus Math or Fira
    Math) from a path or its bytes. The same font again gives the same :class:`Font`. Raises
    ValueError if it is not a font or has no MATH table.
    """
    if isinstance(source, (bytes, bytearray)):
        data = bytes(source)
    else:
        with open(source, "rb") as f:
            data = f.read()
    font_id, name = _mathra.load_font(data)
    return Font(font_id, name)


@dataclass(frozen=True)
class FallbackFont:
    """A font loaded with :func:`load_fallback_font`, to pass in ``fallback_fonts``."""

    id: int
    name: str
    """The font's family name."""


def load_fallback_font(source: Union[str, os.PathLike, bytes]) -> FallbackFont:
    """Loads a fallback font for the characters the math font lacks (emoji, CJK in ``\\text{…}``) from a
    path or its bytes: any OpenType or TrueType font with outlines (glyf or CFF), no MATH table needed.
    Color layers are not read: its glyphs are drawn in one color, ``currentColor``. The same font again
    gives the same :class:`FallbackFont`. Raises ValueError if it is not a font or has no outlines.
    """
    if isinstance(source, (bytes, bytearray)):
        data = bytes(source)
    else:
        with open(source, "rb") as f:
            data = f.read()
    font_id, name = _mathra.load_fallback_font(data)
    return FallbackFont(font_id, name)


#: mathfonts: a catalog of math fonts checked with mathra. Nothing is downloaded unless asked for.
CATALOG = "https://matheusmota-dev-br.github.io/mathfonts/catalog.json"

_catalogs: Dict[str, List["CatalogFont"]] = {}


class CatalogFont(TypedDict):
    """A font of the mathfonts catalog."""

    slug: str
    """What :func:`load_font_from_catalog` takes, such as "euler-math"."""
    name: str
    style: str
    base: str
    """The text font it goes with."""
    designer: Optional[str]
    license: str
    """"OFL-1.1", "GUST", "Apache-2.0" or "MIT": all let the SVG carry the font's outlines."""
    url: str
    """The font file, absolute."""
    license_url: str
    size: int
    sha256: str
    """The file's hash, checked after the download."""
    coverage: int
    """Percent of the math symbols mathra draws that the font has."""


def _get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": f"mathra-python/{__version__}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def catalog_fonts(catalog: str = CATALOG) -> List[CatalogFont]:
    """The fonts of the mathfonts catalog (or of ``catalog``, another one in the same format). Downloads
    only the catalog, a few KB, once per process.
    """
    if catalog not in _catalogs:
        data = json.loads(_get(catalog))
        if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("fonts"), list):
            raise ValueError(f"{catalog} is not a mathfonts catalog (version 1)")
        _catalogs[catalog] = [
            {**f, "url": urllib.parse.urljoin(catalog, f["file"]), "license_url": urllib.parse.urljoin(catalog, f["license_file"])}  # type: ignore[typeddict-item]
            for f in data["fonts"]
        ]
    return [dict(f) for f in _catalogs[catalog]]  # type: ignore[misc]


def _cache_dir() -> pathlib.Path:
    if os.environ.get("MATHRA_CACHE"):
        return pathlib.Path(os.environ["MATHRA_CACHE"])
    base = os.environ.get("XDG_CACHE_HOME") or os.path.join(os.path.expanduser("~"), ".cache")
    return pathlib.Path(base) / "mathra"


def load_font_from_catalog(slug: str, *, catalog: str = CATALOG, cache: Union[bool, str, os.PathLike] = True) -> Font:
    """Downloads a font of the mathfonts catalog by its slug, checks its sha256 and loads it, to pass as
    ``font``. Nothing is downloaded unless this is called.

    The file is kept in a cache named by its hash, so it is downloaded once: ``~/.cache/mathra/fonts``
    (``$XDG_CACHE_HOME`` or ``$MATHRA_CACHE`` instead, when set), another folder with ``cache=path``, or
    none with ``cache=False``. The same slug and hash always give the same font: a file that does not
    match the catalog's hash is refused. Raises ValueError if the slug is not in the catalog.
    """
    entry = next((f for f in catalog_fonts(catalog) if f["slug"] == slug), None)
    if entry is None:
        raise ValueError(f'no font "{slug}" in the catalog; catalog_fonts() lists them')
    path = None
    if cache is not False:
        folder = (_cache_dir() if cache is True else pathlib.Path(cache)) / "fonts"
        path = folder / (entry["sha256"] + pathlib.PurePosixPath(entry["file"]).suffix)
        if path.is_file():
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() == entry["sha256"]:
                return load_font(data)
    data = _get(entry["url"])
    digest = hashlib.sha256(data).hexdigest()
    if digest != entry["sha256"]:
        raise ValueError(f"{entry['url']}: sha256 {digest}, the catalog says {entry['sha256']}")
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".part")
        partial.write_bytes(data)
        os.replace(partial, path)
    return load_font(data)


def _font_id(font: Optional[Font]) -> Optional[int]:
    return None if font is None else font.id


#: What ``fallback_fonts`` takes: fonts from :func:`load_fallback_font`, or math fonts from :func:`load_font`.
FallbackFonts = Optional[Sequence[Union[FallbackFont, Font]]]


def _fallback_ids(fonts: FallbackFonts) -> Optional[List[int]]:
    # a fallback font by its id n, a math font as -(n + 1)
    if fonts is None:
        return None
    return [f.id if isinstance(f, FallbackFont) else -f.id - 1 for f in fonts]


#: Keys and their numbers, for ``labels`` and ``citations``: ``{"eq:a": 3}``.
Numbers = Mapping[str, Union[str, int]]


def _numbers(numbers: Optional[Numbers]) -> Optional[Dict[str, str]]:
    return None if numbers is None else {str(key): str(n) for key, n in numbers.items()}


class Language(TypedDict):
    code: str
    name: str


def tex_to_svg(tex: str, locale: str = "en", *, display: bool = True, strict: bool = False, input: str = "latex", braille: Optional[str] = None, animate: bool = False, steps: bool = False, font: Optional[Font] = None, max_width: Optional[float] = None, fallback_fonts: FallbackFonts = None, labels: Optional[Numbers] = None, citations: Optional[Numbers] = None) -> str:
    """Converts an equation to SVG.

    ``locale`` is a language code such as "en", "pt-BR", "fr" or "ja" (see :func:`locales`); ``display``
    False gives inline style; ``strict`` refuses invalid LaTeX instead of recovering with warnings;
    ``input`` is "latex" (default), "mathml" or "asciimath"; ``braille`` is "cmu" or "nemeth" (default:
    the locale's, CMU in pt-BR and es, Nemeth elsewhere). ``animate=True`` makes the SVG write itself in
    the browser, in the order the layout set it (CSS in the SVG); ``steps=True`` numbers each element by
    that order instead (``data-step``, and ``data-steps`` on the ``<svg>``), with no CSS. ``font`` is a
    math font from :func:`load_font` (default: STIX Two Math). ``max_width``, in em, breaks a wider
    equation into lines: after a relation, or also after ``+`` and ``−`` when relations alone are not
    enough, only at its top level, each line a ``<g data-line>`` of the SVG (default: one line).
    ``fallback_fonts`` are tried in order for a character the math font lacks (fonts from
    :func:`load_fallback_font`, or math fonts), then the embedded Noto Emoji; a character none has is
    drawn as a box (E-REC-8) or, with ``strict``, refused. ``labels`` and ``citations`` give the
    numbers of the document's cross-references, which an equation converted alone cannot know: with
    ``labels={"eq:a": 3}`` ``\\eqref{eq:a}`` shows ``(3)`` and ``\\ref{eq:a}`` shows ``3``, with
    ``citations={"knuth": 1}`` ``\\cite{knuth}`` shows ``[1]``; an unknown key is ``(??)``, ``??`` or
    ``[?]``, with a warning (an error with ``strict``). Raises ValueError on input it cannot read.
    """
    return _mathra.tex_to_svg(tex, locale, display=display, strict=strict, input=input, braille=braille, animate=animate, steps=steps, font=_font_id(font), max_width=max_width, fallback_fonts=_fallback_ids(fallback_fonts), labels=_numbers(labels), citations=_numbers(citations))


def tex_to_png(tex: str, locale: str = "en", *, display: bool = True, strict: bool = False, input: str = "latex", braille: Optional[str] = None, font: Optional[Font] = None, dpi: float = 300, background: Optional[str] = None, color: str = "#111", max_width: Optional[float] = None, fallback_fonts: FallbackFonts = None, labels: Optional[Numbers] = None, citations: Optional[Numbers] = None) -> bytes:
    """Converts an equation to PNG, as bytes.

    ``dpi`` is the resolution over a 12pt body: an em is ``dpi * 12 / 72`` pixels (50 at 300 dpi), and
    each side is the SVG's size in em times that, rounded up to a whole pixel. ``background`` is a CSS
    color (``"white"``, ``"#fff"``); the default None leaves it transparent. ``color`` is the ink, a CSS
    color; colors set in the equation (``\\color``) keep their own. The other arguments are those of
    :func:`tex_to_svg`. Raises ValueError on input it cannot read or a color it does not know.
    """
    return _mathra.tex_to_png(tex, locale, display=display, strict=strict, input=input, braille=braille, font=_font_id(font), dpi=dpi, background=background, color=color, max_width=max_width, fallback_fonts=_fallback_ids(fallback_fonts), labels=_numbers(labels), citations=_numbers(citations))


def tex_to_tree(tex: str, locale: str = "en", *, display: bool = True, strict: bool = False, input: str = "latex", braille: Optional[str] = None, animate: bool = False, steps: bool = False, font: Optional[Font] = None, max_width: Optional[float] = None, fallback_fonts: FallbackFonts = None, labels: Optional[Numbers] = None, citations: Optional[Numbers] = None) -> str:
    """The tree of meaning, as a JSON string."""
    return _mathra.tex_to_tree(tex, locale, display=display, strict=strict, input=input, braille=braille, animate=animate, steps=steps, font=_font_id(font), max_width=max_width, fallback_fonts=_fallback_ids(fallback_fonts), labels=_numbers(labels), citations=_numbers(citations))


def render(tex: str, locale: str = "en", *, display: bool = True, strict: bool = False, input: str = "latex", braille: Optional[str] = None, animate: bool = False, steps: bool = False, font: Optional[Font] = None, max_width: Optional[float] = None, fallback_fonts: FallbackFonts = None, labels: Optional[Numbers] = None, citations: Optional[Numbers] = None) -> Result:
    """Every output at once: svg, speech, text, braille, braille_code, mathml, tree, applied, warnings and boxes."""
    return json.loads(_mathra.render(tex, locale, display=display, strict=strict, input=input, braille=braille, animate=animate, steps=steps, font=_font_id(font), max_width=max_width, fallback_fonts=_fallback_ids(fallback_fonts), labels=_numbers(labels), citations=_numbers(citations)))


def locales() -> List[Language]:
    """The supported languages, English first."""
    return [{"code": code, "name": name} for code, name in _mathra.locales()]


__all__ = ["CATALOG", "CatalogFont", "FallbackFont", "FallbackFonts", "Font", "Language", "Numbers", "Result", "Rule", "__version__", "catalog_fonts", "core_version", "load_fallback_font", "load_font", "load_font_from_catalog", "locales", "render", "tex_to_png", "tex_to_svg", "tex_to_tree"]
