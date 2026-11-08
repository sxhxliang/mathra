// The JavaScript API over the raw wasm-bindgen exports, shared by the Node and the browser builds.

/** `options` may be an object or, as in earlier versions, just the locale code. */
function args(options) {
  const o = typeof options === "string" ? { locale: options } : options ?? {};
  // a font is what `loadFont` returned, or its id
  const font = typeof o.font === "object" && o.font !== null ? o.font.id : o.font;
  return [o.locale ?? null, o.display ?? null, o.strict ?? null, o.input ?? null, o.braille ?? null, o.animate ?? null, o.steps ?? null, font ?? null];
}

// mathfonts: a catalog of math fonts checked with mathra. Nothing is downloaded unless asked for.
const CATALOG = "https://matheusmota-dev-br.github.io/mathfonts/catalog.json";
const catalogs = new Map();
const downloads = new Map();

async function get(url, kind) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`mathra: ${url}: ${response.status} ${response.statusText}`);
  return kind === "json" ? response.json() : new Uint8Array(await response.arrayBuffer());
}

/** The catalog's fonts, each with `url` made absolute; read once per catalog. */
function catalog(url = CATALOG) {
  if (!catalogs.has(url)) {
    const loading = get(url, "json").then((data) => {
      if (data?.version !== 1 || !Array.isArray(data.fonts)) throw new Error(`mathra: ${url} is not a mathfonts catalog (version 1)`);
      return data.fonts.map((f) => ({ ...f, url: new URL(f.file, url).href, license_url: new URL(f.license_file, url).href }));
    });
    loading.catch(() => catalogs.delete(url));
    catalogs.set(url, loading);
  }
  return catalogs.get(url);
}

async function sha256(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("mathra: checking a downloaded font needs Web Crypto (crypto.subtle): Node 19+, or a page served over https");
  return [...new Uint8Array(await subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function wrap(raw, isReady) {
  const check = () => {
    if (!isReady()) throw new Error("mathra: call `await init()` once before converting (only needed outside Node)");
  };
  return {
    texToSvg(tex, options) {
      check();
      return raw.texToSvg(tex, ...args(options));
    },
    render(tex, options) {
      check();
      return JSON.parse(raw.render(tex, ...args(options)));
    },
    locales() {
      check();
      return JSON.parse(raw.locales());
    },
    loadFont(bytes) {
      check();
      return JSON.parse(raw.loadFont(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)));
    },
    catalogFonts(options) {
      return catalog(options?.catalog);
    },
    async loadFontFromCatalog(slug, options) {
      check();
      const fonts = await catalog(options?.catalog);
      const entry = fonts.find((f) => f.slug === slug);
      if (!entry) throw new Error(`mathra: no font "${slug}" in the catalog; catalogFonts() lists them`);
      // the same slug and hash give the same bytes: a font that changed upstream is refused, not used
      if (!downloads.has(entry.url + entry.sha256)) {
        const loading = get(entry.url, "bytes").then(async (bytes) => {
          const hash = await sha256(bytes);
          if (hash !== entry.sha256) throw new Error(`mathra: ${entry.url}: sha256 ${hash}, the catalog says ${entry.sha256}`);
          return bytes;
        });
        loading.catch(() => downloads.delete(entry.url + entry.sha256));
        downloads.set(entry.url + entry.sha256, loading);
      }
      return JSON.parse(raw.loadFont(await downloads.get(entry.url + entry.sha256)));
    },
  };
}
