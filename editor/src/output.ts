// <mathra-output>: what mathra makes of the field's formula, in tabs: LaTeX, MathML, SVG, PNG, speech,
// braille and text, each with a button to copy it (and to download the images).

import { FieldClient, TOKENS, html, icon, say, UI } from "./shared.ts";
import type { MathraField } from "./field.ts";

export type Format = "latex" | "mathml" | "svg" | "png" | "speech" | "braille" | "text" | "rules";
const ALL: Format[] = ["latex", "mathml", "svg", "png", "speech", "braille", "text", "rules"];

const STYLE = `
${TOKENS}
:host { display: block; color: var(--_ink); background: var(--_background); border: 1px solid var(--_border); border-radius: var(--_radius); overflow: hidden; }
:host([hidden]) { display: none; }
/* the tabs scroll; copy and download stay in view at the right */
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 6px 0; background: var(--_surface); border-bottom: 1px solid var(--_border); }
.tabs { display: flex; gap: 2px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent); }
.tabs::-webkit-scrollbar { display: none; }
.tabs.end { -webkit-mask-image: none; mask-image: none; }
.acts { flex: none; display: flex; gap: 4px; margin-bottom: 5px; }
.bar .tab { flex: none; font: 600 13px var(--_font); color: var(--_muted); background: none; border: 0; padding: 7px 10px 8px; border-radius: var(--_radius) var(--_radius) 0 0; cursor: pointer; }
.bar .tab[aria-selected="true"] { color: var(--_ink); background: var(--_background); box-shadow: inset 0 -2px 0 var(--_accent); }
.bar .act { flex: none; display: inline-flex; align-items: center; gap: 6px; font: 13px var(--_font); color: var(--_ink); background: var(--_key); border: 1px solid var(--_border); border-radius: var(--_radius); padding: 4px 9px; cursor: pointer; }
.bar .act:hover { border-color: var(--_accent); }
.bar button:focus-visible { outline: 2px solid var(--_focus); outline-offset: 1px; }
.body { padding: 10px 12px; min-height: 3em; }
pre { margin: 0; font: 13px/1.55 var(--_mono); white-space: pre-wrap; word-break: break-word; max-height: var(--mathra-output-height, 220px); overflow: auto; }
.speech, .braille { font-size: 15px; line-height: 1.6; }
.braille { font-size: 22px; letter-spacing: 0.05em; }
.image { display: grid; place-items: center; padding: 8px; }
.image img { max-width: 100%; height: auto; }
.empty { color: var(--_muted); font-size: 13px; }
.rules h4 { margin: 0 0 6px; font: 600 12px var(--_font); letter-spacing: 0.05em; text-transform: uppercase; color: var(--_muted); }
.rules ul { margin: 0 0 14px; padding: 0; list-style: none; display: grid; gap: 6px; }
.rules li { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: baseline; font-size: 13px; line-height: 1.45; }
.rules code { font: 600 11px var(--_mono); padding: 2px 6px; border-radius: 4px; background: var(--_key-active); white-space: nowrap; }
.rules .warn code { background: color-mix(in srgb, #c27c0e 20%, transparent); }
.refused { padding: 10px 12px; border-radius: var(--_radius); background: color-mix(in srgb, #c0392b 12%, transparent); font-size: 13px; line-height: 1.45; }
.refused b { display: block; margin-bottom: 4px; }
`;

export class MathraOutput extends FieldClient {
  static observedAttributes = ["formats", "locale", "png-scale"];
  private current: Format | null = null;
  private bar: HTMLDivElement;
  private body: HTMLDivElement;
  private pngUrl = "";
  private tabList: HTMLDivElement;
  private acts: HTMLDivElement;

  private markEnd(): void {
    const t = this.tabList;
    t.classList.toggle("end", t.scrollLeft + t.clientWidth >= t.scrollWidth - 2);
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><div class="bar" part="bar"><div class="tabs" role="tablist"></div><div class="acts"></div></div><div class="body" part="body" role="tabpanel" aria-live="polite"></div>`;
    this.bar = root.querySelector(".bar")!;
    this.tabList = root.querySelector(".tabs")!;
    this.acts = root.querySelector(".acts")!;
    // no fade at the end once the last tab is in view
    this.tabList.addEventListener("scroll", () => this.markEnd());
    this.body = root.querySelector(".body")!;
    this.bar.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.dataset.format) {
        this.current = b.dataset.format as Format;
        this.paint();
        this.tabList.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else if (b.dataset.act === "copy") this.copy(b);
      else if (b.dataset.act === "download") this.download();
      else if (b.dataset.act === "replay") {
        // inserted again, the SVG writes itself again
        const img = this.body.querySelector(".image");
        if (img) img.innerHTML = img.innerHTML;
      }
    });
  }

  /** The formats shown, in order (`formats="latex mathml speech"`). */
  get formats(): Format[] {
    const names = this.getAttribute("formats")?.split(/[\s,]+/).filter((f): f is Format => ALL.includes(f as Format));
    return names?.length ? names : ALL;
  }

  attributeChangedCallback(): void {
    this.paint();
  }

  protected override attach(field: MathraField): () => void {
    // every drawing: an edit, and also a change of language or font
    const update = () => this.paint();
    field.addEventListener("mathra-render", update);
    queueMicrotask(update);
    return () => field.removeEventListener("mathra-render", update);
  }

  protected override fieldChanged(): void {
    this.paint();
  }

  /** The current format's content, as text (the PNG as a data URL). */
  async text(format: Format = this.format): Promise<string> {
    const out = this.field?.output;
    if (!out) return "";
    switch (format) {
      case "latex":
        return this.field!.latex;
      case "mathml":
        return out.mathml;
      case "svg":
        return out.svg;
      case "png":
        return this.png();
      case "rules":
        return [...out.applied.map((r) => `${r.rule}: ${r.description}`), ...out.warnings.map((r) => `${r.rule}: ${r.description}`)].join("\n");
      default:
        return out[format];
    }
  }

  private get format(): Format {
    const f = this.formats;
    return this.current && f.includes(this.current) ? this.current : f[0];
  }

  private paint(): void {
    const locale = this.locale;
    const format = this.format;
    const image = format === "svg" || format === "png";
    this.tabList.setAttribute("aria-label", say(UI.outputs, locale));
    // redrawn at every change of the formula: the tabs keep where they were scrolled to
    const scrolled = this.tabList.scrollLeft;
    this.tabList.innerHTML = this.formats.map((f) => `<button type="button" class="tab" role="tab" part="tab" data-format="${f}" aria-selected="${f === format}">${html(say(UI[f], locale))}</button>`).join("");
    this.tabList.scrollLeft = scrolled;
    this.markEnd();
    this.acts.innerHTML =
      `<button type="button" class="act" part="action" data-act="copy" title="${html(say(UI.copy, locale))}" aria-label="${html(say(UI.copy, locale))}">${icon("copy")}<span>${html(say(UI.copy, locale))}</span></button>` +
      (format === "svg" && this.field?.options.animate ? `<button type="button" class="act" part="action" data-act="replay" title="${html(say(UI.replay, locale))}" aria-label="${html(say(UI.replay, locale))}">${icon("play")}</button>` : "") +
      (image ? `<button type="button" class="act" part="action" data-act="download" title="${html(say(UI.download, locale))}" aria-label="${html(say(UI.download, locale))}">${icon("download")}</button>` : "");
    const out = this.field?.output;
    const refused = this.field?.error;
    if (refused) {
      this.body.innerHTML = `<div class="refused" role="alert"><b>${html(say(UI.refused, locale))}</b>${html(refused)}</div>`;
      return;
    }
    if (!out) {
      this.body.innerHTML = `<div class="empty">${html(say(UI.empty, locale))}</div>`;
      return;
    }
    if (format === "rules") {
      const list = (rules: { rule: string; description: string }[], cls = "") => `<ul>${rules.map((r) => `<li class="${cls}"><code>${html(r.rule)}</code><span>${html(r.description)}</span></li>`).join("")}</ul>`;
      this.body.innerHTML = out.applied.length || out.warnings.length
        ? `<div class="rules">${out.applied.length ? `<h4>${html(say(UI.applied, locale))}</h4>${list(out.applied)}` : ""}${out.warnings.length ? `<h4>${html(say(UI.warnings, locale))}</h4>${list(out.warnings, "warn")}` : ""}</div>`
        : `<div class="empty">${html(say(UI.noRules, locale))}</div>`;
      return;
    }
    if (format === "svg") this.body.innerHTML = `<div class="image">${out.svg}</div><pre>${html(out.svg.slice(0, 600))}${out.svg.length > 600 ? "…" : ""}</pre>`;
    else if (format === "png") {
      this.body.innerHTML = `<div class="image"></div>`;
      this.png().then((url) => {
        const host = this.body.querySelector(".image");
        if (host && url) host.innerHTML = `<img alt="${html(out.speech)}" src="${url}">`;
      });
    } else {
      const cls = format === "speech" || format === "braille" ? format : "";
      void this.text(format).then((t) => (this.body.innerHTML = `<pre class="${cls}">${html(t)}</pre>`));
    }
  }

  /** The formula as PNG (a data URL), drawn by the browser from mathra's SVG at `png-scale` (default 3) times its size, in the field's ink color. */
  private async png(): Promise<string> {
    const out = this.field?.output;
    if (!out) return "";
    const scale = Number(this.getAttribute("png-scale") ?? 3);
    const color = getComputedStyle(this.field!).color || "#111";
    // the ink color joins the SVG's own style attribute (a second one would make it invalid)
    const svg = out.svg.replace('style="', `style="color:${color}; `);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const em = parseFloat(getComputedStyle(this.field!).fontSize) || 24;
    const w = Math.ceil((img.width || em * 4) * scale);
    const h = Math.ceil((img.height || em) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    this.pngUrl = canvas.toDataURL("image/png");
    return this.pngUrl;
  }

  private async copy(button: HTMLButtonElement): Promise<void> {
    const format = this.format;
    try {
      if (format === "png" && typeof ClipboardItem !== "undefined") {
        const blob = await (await fetch(await this.png())).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      } else await navigator.clipboard.writeText(await this.text(format));
      const label = button.querySelector("span");
      if (label) {
        label.textContent = say(UI.copied, this.locale);
        button.innerHTML = `${icon("check")}${label.outerHTML}`;
        setTimeout(() => this.paint(), 1400);
      }
    } catch {
      // without clipboard access, the text is selected for the user to copy
      const pre = this.body.querySelector("pre");
      if (pre) getSelection()?.selectAllChildren(pre);
    }
  }

  private async download(): Promise<void> {
    const format = this.format;
    const a = document.createElement("a");
    if (format === "png") a.href = await this.png();
    else a.href = URL.createObjectURL(new Blob([await this.text("svg")], { type: "image/svg+xml" }));
    a.download = `formula.${format}`;
    a.click();
  }
}

if (typeof customElements !== "undefined" && !customElements.get("mathra-output")) customElements.define("mathra-output", MathraOutput);
