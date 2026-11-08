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
  /** The tree of meaning. */
  tree: unknown;
  /** Rules that changed something in this equation, in the order they acted. */
  applied: Rule[];
  /** Input problems the tolerant mode worked around (E-REC-*); empty in strict mode. */
  warnings: Rule[];
}

/** Loads the WebAssembly module: await it once before converting in browsers and bundlers. In Node it does nothing. */
export function init(input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module): Promise<void>;

/** Converts an equation (LaTeX unless `options.input` says otherwise) to SVG. Throws on input it cannot read (or on any invalid input with `strict`). */
export function texToSvg(tex: string, options?: Options | Locale): string;

/** Converts an equation and returns every output at once. */
export function render(tex: string, options?: Options | Locale): Result;

/** Loads an OpenType math font (an `.otf` or `.ttf` with a MATH table, such as Libertinus Math or Fira Math) from its bytes, to pass as `options.font`. The same bytes again give the same font. Throws if it is not a font or has no MATH table. */
export function loadFont(bytes: Uint8Array | ArrayBuffer): Font;

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
