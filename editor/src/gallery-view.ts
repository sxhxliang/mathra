// <mathra-gallery>: mathra's gallery, drawn by mathra, to open an example in a field. A search filters
// it by caption; choosing an example replaces the formula (it can be undone) and applies its options.

import { render } from "@mathlabs/mathra";
import { FieldClient, TOKENS, html, icon, say, UI } from "./shared.ts";
import { GALLERY, type GalleryExample } from "./gallery.ts";
import { mathraReady } from "./palette.ts";

const STYLE = `
${TOKENS}
:host { display: block; color: var(--_ink); font: 14px var(--_font); }
:host([hidden]) { display: none; }
.top { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 0 0 12px; background: var(--_background); }
.search { flex: 1; display: flex; align-items: center; gap: 6px; padding: 0 12px; height: 36px; color: var(--_muted); background: var(--_surface); border: 1px solid var(--_border); border-radius: 999px; }
.search:focus-within { border-color: var(--_focus); color: var(--_ink); }
.search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--_ink); font: 14px var(--_font); }
.hint { color: var(--_muted); font-size: 13px; margin: 0 0 14px; }
.group { margin-bottom: 22px; }
.group h3 { margin: 0 0 2px; font: 600 15px var(--_font); }
.group p { margin: 0 0 10px; color: var(--_muted); font-size: 13px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.card { display: grid; grid-template-rows: 1fr auto; gap: 8px; min-height: 120px; padding: 12px; text-align: left; color: var(--_ink); background: var(--_background); border: 1px solid var(--_border); border-radius: var(--_radius); cursor: pointer; font: inherit; transition: border-color 0.12s, transform 0.12s, box-shadow 0.12s; }
.card:hover { border-color: var(--_accent); box-shadow: 0 4px 14px rgb(0 0 0 / 0.08); transform: translateY(-1px); }
.card:focus-visible { outline: 2px solid var(--_focus); outline-offset: 1px; }
.card .formula { display: grid; place-items: center; overflow: hidden; min-height: 60px; }
.card .formula svg { max-width: 100%; max-height: 120px; width: auto; height: auto; font-size: 15px; }
.card .caption { color: var(--_muted); font-size: 12px; line-height: 1.4; }
.empty { color: var(--_muted); padding: 20px 0; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } .card:hover { transform: none; } }
`;

export class MathraGallery extends FieldClient {
  static observedAttributes = ["locale"];
  private root: ShadowRoot;
  private drawn = new Map<string, string>();
  private query = "";

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${STYLE}</style><div class="top"><label class="search">${icon("search")}<input type="search" id="q" autocomplete="off"></label></div><p class="hint"></p><div class="list"></div>`;
    const input = this.root.querySelector("input")!;
    input.addEventListener("input", () => {
      this.query = input.value;
      this.paintList();
    });
    this.root.querySelector(".list")!.addEventListener("click", (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(".card");
      if (card) this.open(card.dataset.group!, Number(card.dataset.i));
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    mathraReady().then(() => this.paint());
  }

  attributeChangedCallback(): void {
    // the language may come before mathra's WebAssembly is ready
    mathraReady().then(() => this.paint());
  }

  /** The examples the editor can open (those in LaTeX). */
  get examples(): { group: string; i: number; example: GalleryExample }[] {
    return GALLERY.flatMap((g) => g.rows.map((example, i) => ({ group: g.id, i, example }))).filter((e) => e.example.input === "latex");
  }

  /** Puts the search box in focus. */
  focusSearch(): void {
    this.root.querySelector("input")?.focus();
  }

  private paint(): void {
    const l = this.locale;
    const input = this.root.querySelector("input")!;
    input.placeholder = say(UI.gallerySearch, l);
    input.setAttribute("aria-label", say(UI.gallerySearch, l));
    this.root.querySelector(".hint")!.textContent = say(UI.galleryHint, l);
    this.paintList();
  }

  private picture(ex: GalleryExample): string {
    const key = `${ex.locale}\u0000${ex.tex}`;
    let svg = this.drawn.get(key);
    if (svg === undefined) {
      try {
        svg = render(ex.tex, { locale: ex.locale, ...ex.options }).svg.replace("<svg ", '<svg aria-hidden="true" ');
        this.drawn.set(key, svg);
      } catch {
        // not kept: drawn again next time
        svg = "";
      }
    }
    return svg;
  }

  private paintList(): void {
    const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const q = fold(this.query.trim());
    const html_ = GALLERY.map((g) => {
      const cards = g.rows
        .map((ex, i) => ({ ex, i }))
        .filter(({ ex }) => ex.input === "latex" && (!q || fold(`${ex.caption} ${ex.name} ${g.title}`).includes(q)))
        .map(({ ex, i }) => `<button type="button" class="card" part="card" data-group="${html(g.id)}" data-i="${i}" title="${html(ex.caption)}" aria-label="${html(ex.caption)}"><span class="formula">${this.picture(ex)}</span><span class="caption">${html(ex.caption)}</span></button>`)
        .join("");
      return cards ? `<div class="group"><h3>${html(g.title)}</h3><p>${html(g.intro)}</p><div class="cards">${cards}</div></div>` : "";
    }).join("");
    this.root.querySelector(".list")!.innerHTML = html_ || `<div class="empty">${html(say(UI.noResults, this.locale))}</div>`;
  }

  private open(group: string, i: number): void {
    const ex = GALLERY.find((g) => g.id === group)?.rows[i];
    const field = this.field;
    if (!ex || !field) return;
    // the example's options (a maximum width) go with it; others it does not set are left as they were
    if (ex.options.maxWidth !== undefined) field.mathraOptions = { ...field.mathraOptions, maxWidth: ex.options.maxWidth };
    field.value = ex.tex;
    this.dispatchEvent(new CustomEvent("mathra-gallery", { detail: { example: ex }, bubbles: true, composed: true }));
    field.focus();
  }
}

if (typeof customElements !== "undefined" && !customElements.get("mathra-gallery")) customElements.define("mathra-gallery", MathraGallery);
