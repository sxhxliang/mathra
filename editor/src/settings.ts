// <mathra-settings>: mathra's options for a field, each with a control: the font (from the mathfonts
// catalog), display or inline, line breaking at a maximum width, the braille code, the SVG written
// stroke by stroke, strict mode, and the size of the PNG of an output panel.

import { catalogFonts, loadFontFromCatalog, type CatalogFont, type Options } from "@mathlabs/mathra";
import { FieldClient, TOKENS, html, say, UI, type Words } from "./shared.ts";
import type { MathraField } from "./field.ts";
import type { MathraOutput } from "./output.ts";

const STYLE = `
${TOKENS}
:host { display: block; color: var(--_ink); font: 14px var(--_font); }
:host([hidden]) { display: none; }
.settings { display: grid; gap: 18px; }
section { display: grid; gap: 8px; }
h3 { margin: 0; font: 600 12px var(--_font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--_muted); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.segmented { display: inline-flex; padding: 2px; gap: 2px; background: var(--_key-active); border-radius: calc(var(--_radius) + 2px); flex-wrap: wrap; }
.segmented button { min-width: 44px; height: 30px; padding: 0 12px; color: var(--_muted); background: none; border: 0; border-radius: var(--_radius); font: 13px var(--_font); cursor: pointer; transition: color 0.12s, background 0.15s, box-shadow 0.15s; }
.segmented button:hover { color: var(--_ink); }
.segmented button[aria-checked="true"] { color: var(--_ink); background: var(--_background); box-shadow: 0 1px 2px rgb(0 0 0 / 0.15); }
.switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; line-height: 1.35; }
.switch input { appearance: none; flex: none; width: 36px; height: 20px; margin: 0; border-radius: 999px; background: var(--_border); position: relative; cursor: pointer; transition: background 0.15s; }
.switch input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--_background); box-shadow: 0 1px 2px rgb(0 0 0 / 0.25); transition: transform 0.15s; }
.switch input:checked { background: var(--_accent); }
.switch input:checked::after { transform: translateX(16px); }
.range { display: flex; align-items: center; gap: 10px; }
.range input { flex: 1; accent-color: var(--_accent); }
.range output { min-width: 3.5em; text-align: right; font-variant-numeric: tabular-nums; color: var(--_muted); font-size: 13px; }
.range[aria-disabled="true"] { opacity: 0.45; }
.fonts { display: grid; gap: 2px; max-height: 260px; overflow-y: auto; padding: 2px; border: 1px solid var(--_border); border-radius: var(--_radius); background: var(--_background); }
.fonts button { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: baseline; text-align: left; padding: 7px 10px; color: var(--_ink); background: none; border: 0; border-radius: var(--_radius); font: 14px var(--_font); cursor: pointer; }
.fonts button:hover { background: var(--_key-active); }
.fonts button[aria-checked="true"] { background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent); font-weight: 600; }
.fonts small { grid-column: 1 / -1; color: var(--_muted); font-size: 12px; font-weight: 400; }
.fonts .cov { color: var(--_muted); font-size: 12px; font-weight: 400; }
.note { color: var(--_muted); font-size: 12px; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--_focus); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) { .segmented button, .switch input, .switch input::after { transition: none; } }
`;

/** What the panel changes, besides the field's `mathraOptions`. */
export interface SettingsState {
  font: string;
  pngScale: number;
}

export class MathraSettings extends FieldClient {
  static observedAttributes = ["locale"];
  /** The output panel whose PNG size this sets (the editor sets it). */
  output: MathraOutput | null = null;
  private root: ShadowRoot;
  private fonts: CatalogFont[] | null = null;
  private fontsFailed = false;
  private fontSlug = "";
  private loading = "";

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.addEventListener("click", (e) => this.clicked(e));
    this.root.addEventListener("input", (e) => this.inputChanged(e));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.paint();
  }

  attributeChangedCallback(): void {
    this.paint();
  }


  protected override fieldChanged(): void {
    this.paint();
  }

  /** Reads the font catalog (a few KB), once; the fonts themselves only when chosen. */
  async loadCatalog(): Promise<void> {
    if (this.fonts || this.fontsFailed) return;
    try {
      this.fonts = (await catalogFonts()).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      this.fontsFailed = true;
    }
    this.paint();
  }

  private get options(): Partial<Options> {
    return this.field?.mathraOptions ?? {};
  }

  private set(change: Partial<Options>): void {
    const f = this.field;
    if (!f) return;
    const next: Partial<Options> = { ...f.mathraOptions, ...change };
    for (const k of Object.keys(next) as (keyof Options)[]) if (next[k] === undefined) delete next[k];
    f.mathraOptions = next;
    this.dispatchEvent(new CustomEvent("mathra-options", { detail: next, bubbles: true, composed: true }));
    this.paint();
  }

  private paint(): void {
    const l = this.locale;
    const o = this.options;
    const w = (words: Words) => html(say(words, l));
    const seg = (name: string, value: string, current: string, label: Words | string) =>
      `<button type="button" role="radio" data-set="${name}" data-value="${html(value)}" aria-checked="${value === current}">${typeof label === "string" ? html(label) : w(label)}</button>`;
    const display = o.display === false ? "inline" : "display";
    const braille = o.braille ?? "auto";
    const pngScale = String(this.output?.getAttribute("png-scale") ?? 3);
    const breaking = o.maxWidth !== undefined;
    const fontList = this.fontsFailed
      ? `<div class="note">${w(UI.fontCatalogFailed)}</div>`
      : `<div class="fonts" role="radiogroup" aria-label="${w(UI.font)}">` +
        `<button type="button" role="radio" data-font="" aria-checked="${this.fontSlug === ""}"><span>${w(UI.fontDefault)}</span></button>` +
        (this.fonts ?? [])
          .filter((f) => f.slug !== "stix-two-math")
          .map(
            (f) =>
              `<button type="button" role="radio" data-font="${html(f.slug)}" aria-checked="${this.fontSlug === f.slug}"><span>${html(f.name)}${this.loading === f.slug ? ` · ${w(UI.fontLoading)}` : ""}</span><span class="cov">${f.coverage}% ${w(UI.coverage)}</span><small>${html(f.style)} · ${html(f.base)} · ${html(f.license)}</small></button>`,
          )
          .join("") +
        (this.fonts ? "" : `<div class="note">${w(UI.fontLoading)}</div>`) +
        "</div>";
    const scroll = this.root.querySelector(".fonts")?.scrollTop ?? 0;
    this.root.innerHTML = `<style>${STYLE}</style><div class="settings" part="settings">
      <section><h3>${w(UI.font)}</h3>${fontList}</section>
      <section><h3>${w(UI.style)}</h3><div class="segmented" role="radiogroup" aria-label="${w(UI.style)}">${seg("display", "display", display, UI.display)}${seg("display", "inline", display, UI.inline)}</div></section>
      <section>
        <label class="switch"><span>${w(UI.lineBreaks)}</span><input type="checkbox" id="breaking" data-toggle="breaking"${breaking ? " checked" : ""}></label>
        <div class="range" aria-disabled="${!breaking}"><span class="note">${w(UI.maxWidth)}</span><input type="range" id="width" min="8" max="60" step="1" value="${o.maxWidth ?? 30}"${breaking ? "" : " disabled"} aria-label="${w(UI.maxWidth)}"><output>${o.maxWidth ?? 30} em</output></div>
      </section>
      <section><h3>${w(UI.braille)}</h3><div class="segmented" role="radiogroup" aria-label="${w(UI.braille)}">${seg("braille", "auto", braille, UI.brailleAuto)}${seg("braille", "cmu", braille, "CMU")}${seg("braille", "nemeth", braille, "Nemeth")}</div></section>
      <section>
        <label class="switch"><span>${w(UI.animate)}</span><input type="checkbox" id="animate" data-toggle="animate"${o.animate ? " checked" : ""}></label>
        <label class="switch"><span>${w(UI.strict)}</span><input type="checkbox" id="strict" data-toggle="strict"${o.strict ? " checked" : ""}></label>
      </section>
      <section><h3>${w(UI.pngSize)}</h3><div class="segmented" role="radiogroup" aria-label="${w(UI.pngSize)}">${["1", "2", "3", "4"].map((s) => seg("png", s, pngScale, `${s}×`)).join("")}</div></section>
    </div>`;
    const list = this.root.querySelector(".fonts");
    if (list) list.scrollTop = scroll;
  }

  private async clicked(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    const font = t.closest<HTMLElement>("[data-font]");
    if (font) return this.chooseFont(font.dataset.font!);
    const b = t.closest<HTMLElement>("[data-set]");
    if (!b) return;
    const value = b.dataset.value!;
    switch (b.dataset.set) {
      case "display":
        return this.set({ display: value === "display" ? undefined : false });
      case "braille":
        return this.set({ braille: value === "auto" ? undefined : (value as Options["braille"]) });
      case "png":
        this.output?.setAttribute("png-scale", value);
        this.dispatchEvent(new CustomEvent("mathra-options", { detail: { pngScale: Number(value) }, bubbles: true, composed: true }));
        return this.paint();
    }
  }

  private inputChanged(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.dataset.toggle === "breaking") this.set({ maxWidth: t.checked ? Number((this.root.querySelector("#width") as HTMLInputElement).value) : undefined });
    else if (t.dataset.toggle === "animate") this.set({ animate: t.checked || undefined });
    else if (t.dataset.toggle === "strict") this.set({ strict: t.checked || undefined });
    else if (t.id === "width") {
      // the value shows while the slider moves; mathra redraws once it stops
      const out = this.root.querySelector(".range output");
      if (out) out.textContent = `${t.value} em`;
      clearTimeout(this.widthTimer);
      this.widthTimer = window.setTimeout(() => this.set({ maxWidth: Number(t.value) }), 120);
    }
  }

  private widthTimer = 0;

  private async chooseFont(slug: string): Promise<void> {
    if (!slug) {
      this.fontSlug = "";
      return this.set({ font: undefined });
    }
    this.loading = slug;
    this.paint();
    try {
      const font = await loadFontFromCatalog(slug);
      this.fontSlug = slug;
      this.loading = "";
      this.set({ font });
    } catch {
      this.loading = "";
      this.paint();
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("mathra-settings")) customElements.define("mathra-settings", MathraSettings);
