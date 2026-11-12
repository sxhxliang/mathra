/** A language code: "en" (default), "pt-BR", "es", "fr", "de", "it", "ru", "zh", "ja", "ko", "hi", "ar", "id", "tr", "nl" or "pl". A region is accepted ("es-MX", "zh-CN"). */
export type Locale = "en" | "pt-BR" | "es" | "fr" | "de" | "it" | "ru" | "zh" | "ja" | "ko" | "hi" | "ar" | "id" | "tr" | "nl" | "pl" | (string & {});

export interface Options {
  /** How the equation is read, written and spoken. Default "en". */
  locale?: Locale;
  /** Display style, as in `$$…$$` (default), or inline with the text, as in `$…$` (false). */
  display?: boolean;
  /** Refuse invalid LaTeX, like TeX does, instead of recovering with warnings. Default false. */
  strict?: boolean;
  /** The notation of the equation: "latex" (default), "mathml" or "asciimath". MathML passed as LaTeX (starting with `<math`) is recognized on its own. */
  input?: "latex" | "mathml" | "asciimath";
  /** The braille code of `Result.braille`: "cmu" or "nemeth". Default: the locale's (CMU in pt-BR and es, Nemeth elsewhere). */
  braille?: "cmu" | "nemeth";
  /** The SVG writes itself in the browser, glyph by glyph and stroke by stroke, in the order the layout set it (CSS in the SVG). Default false; without it the SVG is unchanged. */
  animate?: boolean;
  /** Each element of the SVG numbered by that order (`data-step`, and `data-steps` on the `<svg>`), with no CSS: for a page that walks through the equation itself. Default false. */
  steps?: boolean;
  /** The math font the equation is set in: what `loadFont` returned, or its id. Default STIX Two Math. */
  font?: Font | number;
  /** The widest a line may be, in em. A wider equation is broken after a relation (`=`, `≤`, `→`…), or also after `+` and `−` when relations alone are not enough, only at its top level (never inside a fraction, root, `\left…\right`, scripts or a table), with each line a `<g data-line>` of the SVG. Speech, text and braille do not change. Default: one line, however wide. */
  maxWidth?: number;
  /** Fonts for the characters the math font lacks (emoji, CJK in `\text{…}`), tried in order: what `loadFallbackFont` returned, or a math font from `loadFont` or `loadFontFromCatalog`. Their outlines go in the SVG as the other glyphs'. Default none: the npm package embeds no emoji font, so a character no font has is drawn as a box (E-REC-8) or, with `strict`, refused. */
  fallbackFonts?: (FallbackFont | Font)[];
  /** The numbers of the document's labels, which an equation converted alone cannot know: `{ "eq:a": 3 }` makes `\eqref{eq:a}` show `(3)` and `\ref{eq:a}` show `3`. An unknown label is `??`, with a warning (E-REC-9), or an error with `strict`. */
  labels?: Record<string, string | number>;
  /** The numbers of the document's citations: `{ knuth: 1 }` makes `\cite{knuth}` show `[1]`. An unknown key is `?`, with a warning (E-REC-9), or an error with `strict`. */
  citations?: Record<string, string | number>;
}

/** A font loaded with `loadFallbackFont`, for `options.fallbackFonts`. */
export interface FallbackFont {
  id: number;
  /** The font's family name. */
  name: string;
  fallback: true;
}

/** A math font loaded with `loadFont`. */
export interface Font {
  /** What `options.font` takes. */
  id: number;
  /** The font's family name, as the SVG's `<mathra:font>` carries it. */
  name: string;
}

/** A numbered rule from spec/rules.md or spec/tolerance.md, and what it did to this equation. */
export interface Rule {
  rule: string;
  description: string;
}

export interface Result {
  /** Standalone SVG with the speech in `<title>` and the source and tree in `<metadata>`. */
  svg: string;
  /** The phrase a screen reader says, in the locale's language. */
  speech: string;
  /** Linear text, close to UnicodeMath. */
  text: string;
  /** The equation in braille, as Unicode braille cells. */
  braille: string;
  /** The braille code used: "cmu" or "nemeth". */
  braille_code: "cmu" | "nemeth";
  /** The equation as presentation MathML: a `<math>` element with MathML Core's elements, `display="block"` or `"inline"` as `options.display`, and `intent` where the tree knows what the drawing does not say. What MathML cannot draw (chemfig, diagrams, `\cancel`) is a `<semantics>` with the source as an annotation. */
  mathml: string;
  /** The tree of meaning. */
  tree: unknown;
  /** Rules that changed something in this equation, in the order they acted. */
  applied: Rule[];
  /** Input problems the tolerant mode worked around (E-REC-*); empty in strict mode. */
  warnings: Rule[];
  /** The boxes of the groups the equation marks with `\htmlData`, `\htmlId`, `\class`…: where each marked piece sits, for an editor's cursor and clicks. Empty when nothing is marked. */
  boxes: GroupBox[];
}

/** A marked group's box, in the SVG's own coordinates (those of its `viewBox`, y down): the box the content was set in (advance width, height and depth), not the ink. */
export interface GroupBox {
  /** The group's attributes as the SVG writes them, e.g. `{ "data-m": "7" }` for `\htmlData{m=7}{…}`. */
  attributes: Record<string, string>;
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  width: number;
  /** Height plus depth. */
  height: number;
  /** The baseline, as a y. */
  baseline: number;
  /** How many marked groups hold this one (0: none). */
  level: number;
}

/** Loads the WebAssembly module: await it once before converting in browsers and bundlers. In Node it does nothing. */
export function init(input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>;

/** Converts an equation (LaTeX unless `options.input` says otherwise) to SVG. Throws on input it cannot read (or on any invalid input with `strict`). */
export function texToSvg(tex: string, options?: Options | Locale): string;

/** Converts an equation and returns every output at once. */
export function render(tex: string, options?: Options | Locale): Result;

/** Loads an OpenType math font (an `.otf` or `.ttf` with a MATH table, such as Libertinus Math or Fira Math) from its bytes, to pass as `options.font`. The same bytes again give the same font. Throws if it is not a font or has no MATH table. */
export function loadFont(bytes: Uint8Array | ArrayBuffer): Font;

/** Loads a fallback font from its bytes, to pass in `options.fallbackFonts`: any OpenType or TrueType font with outlines (glyf or CFF), such as Noto Emoji (the monochrome one) or a CJK font; no MATH table needed. Color layers are not read: glyphs are drawn in one color, `currentColor`. The same bytes again give the same font. Throws if it is not a font or has no outlines. */
export function loadFallbackFont(bytes: Uint8Array | ArrayBuffer): FallbackFont;

/** A font of the mathfonts catalog (https://matheusmota-dev-br.github.io/mathfonts/). */
export interface CatalogFont {
  /** What `loadFontFromCatalog` takes, such as "euler-math". */
  slug: string;
  name: string;
  /** "Serif", "Sans", "Handwritten", … */
  style: string;
  /** The text font it goes with. */
  base: string;
  designer: string | null;
  /** "OFL-1.1", "GUST", "Apache-2.0" or "MIT": all let the SVG carry the font's outlines. */
  license: string;
  /** The font file, absolute. */
  url: string;
  /** The license text, absolute. */
  license_url: string;
  /** Bytes of the file. */
  size: number;
  /** The file's hash, checked after the download. */
  sha256: string;
  /** Percent of the math symbols mathra draws that the font has. */
  coverage: number;
}

export interface CatalogOptions {
  /** Another catalog in the same format. Default the mathfonts one. */
  catalog?: string;
}

/** The fonts of the mathfonts catalog. Downloads only the catalog (a few KB), once. */
export function catalogFonts(options?: CatalogOptions): Promise<CatalogFont[]>;

/** Downloads a font of the mathfonts catalog by its slug, checks its sha256 and loads it, to pass as `options.font`. Each font is downloaded once; nothing is downloaded unless this is called. Rejects if the slug is not in the catalog or the file does not match its hash. */
export function loadFontFromCatalog(slug: string, options?: CatalogOptions): Promise<Font>;

/** The supported languages, English first. */
export function locales(): { code: string; name: string }[];

/** The version of mathra's core inside this package (the npm package has its own version). */
export const version: string;
