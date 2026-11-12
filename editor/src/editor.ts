// <mathra-editor>: everything together. `layout="page"` fills the page as an application: a bar with
// undo, zoom, language and theme on top, the palettes with their search, the formula in all the room
// left, the outputs beside it (below it on narrow screens), and the keyboard on the screen when wanted.

import { init, locales } from "@mathlabs/mathra";
import { TOKENS, html, icon, keepFocus, say, UI } from "./shared.ts";
import type { MathraField } from "./field.ts";
import type { MathraToolbar } from "./palette.ts";
import type { MathraKeyboard } from "./keyboard.ts";
import type { MathraOutput } from "./output.ts";
import type { MathraCommandMenu } from "./command-menu.ts";
import type { MathraSettings } from "./settings.ts";
import type { MathraGallery } from "./gallery-view.ts";
import "./field.ts";
import "./palette.ts";
import "./keyboard.ts";
import "./output.ts";
import "./command-menu.ts";
import "./settings.ts";
import "./gallery-view.ts";

/** The controls the bar can show (`controls="history zoom language theme keyboard outputs"`). */
export type Control = "history" | "zoom" | "gallery" | "settings" | "language" | "theme" | "keyboard" | "outputs";
const ALL_CONTROLS: Control[] = ["history", "zoom", "gallery", "settings", "language", "theme", "keyboard", "outputs"];
const ZOOMS = [0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

const STYLE = `
${TOKENS}
:host { display: block; color: var(--_ink); }
:host([hidden]) { display: none; }
:host([theme="light"]) { color-scheme: light; }
:host([theme="dark"]) { color-scheme: dark; }
:host(:not([theme])), :host([theme="auto"]) { color-scheme: light dark; }
.wrap { display: grid; gap: var(--mathra-gap, 10px); }
mathra-field { font-size: calc(var(--zoom, 1) * 1.5em); }

/* the bar */
.bar { position: relative; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.bar .group { display: flex; align-items: center; gap: 2px; }
.bar .spacer { flex: 1; }
.bar .sep { width: 1px; height: 22px; background: var(--_border); margin: 0 4px; }
.icon-button { display: inline-grid; place-items: center; width: 34px; height: 34px; color: var(--_muted); background: none; border: 1px solid transparent; border-radius: var(--_radius); cursor: pointer; transition: color 0.12s, background 0.12s, border-color 0.12s; }
.icon-button:hover:not(:disabled) { color: var(--_ink); background: var(--_key-active); }
.icon-button:disabled { opacity: 0.35; cursor: default; }
.icon-button[aria-pressed="true"] { color: var(--_accent); background: color-mix(in srgb, var(--_accent) 12%, transparent); }
button:focus-visible { outline: 2px solid var(--_focus); outline-offset: 1px; }
.zoom-value { min-width: 3.2em; text-align: center; font: 12px var(--_font); color: var(--_muted); font-variant-numeric: tabular-nums; }

/* theme: three icons in one control */
.segmented { display: inline-flex; padding: 2px; gap: 2px; background: var(--_key-active); border-radius: calc(var(--_radius) + 2px); }
.segmented button { display: inline-grid; place-items: center; width: 30px; height: 28px; color: var(--_muted); background: none; border: 0; border-radius: var(--_radius); cursor: pointer; transition: color 0.12s, background 0.15s, box-shadow 0.15s; }
.segmented button:hover { color: var(--_ink); }
.segmented button[aria-checked="true"] { color: var(--_ink); background: var(--_background); box-shadow: 0 1px 2px rgb(0 0 0 / 0.15); }

/* language: a button and its menu */
.language { position: relative; }
.language > button { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 8px 0 10px; color: var(--_ink); background: none; border: 1px solid var(--_border); border-radius: var(--_radius); font: 13px var(--_font); cursor: pointer; transition: border-color 0.12s, background 0.12s; }
.language > button:hover { background: var(--_key-active); }
.language > button .short { display: none; }
.language > button svg:last-child { width: 14px; height: 14px; transition: transform 0.15s; }
.language > button[aria-expanded="true"] svg:last-child { transform: rotate(180deg); }
.menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 230px; max-height: min(60vh, 420px); overflow-y: auto; padding: 4px; background: var(--_background); border: 1px solid var(--_border); border-radius: calc(var(--_radius) + 2px); box-shadow: 0 12px 32px rgb(0 0 0 / 0.18); animation: drop 0.14s ease-out; }
@keyframes drop { from { opacity: 0; transform: translateY(-4px); } }
.menu [role="option"] { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 10px; border-radius: var(--_radius); font: 14px var(--_font); cursor: pointer; }
.menu [role="option"] .code { color: var(--_muted); font-size: 12px; font-family: var(--_mono); }
.menu [role="option"][aria-selected="true"] { color: var(--_accent); font-weight: 600; }
.menu [role="option"].active, .menu [role="option"]:hover { background: var(--_key-active); }

mathra-keyboard { animation: rise 0.2s ease-out; }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { mathra-keyboard, .menu { animation: none; } .icon-button, .segmented button, .language > button svg { transition: none; } }

/* the page */
:host([layout="page"]) { height: 100%; min-height: 100%; background: var(--_page); }
:host([layout="page"]) .wrap {
  height: 100%; gap: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas: "bar bar" "tools side" "stage side" "keys side";
}
:host([layout="page"]) mathra-field { font-size: calc(var(--zoom, 1) * 2.4em); }
:host([layout="page"]) .bar { grid-area: bar; padding: 8px max(16px, env(safe-area-inset-left, 0px)); background: var(--_surface); border-bottom: 1px solid var(--_border); }
:host([layout="page"]) mathra-toolbar { grid-area: tools; margin: 12px 12px 0 16px; }
:host([layout="page"]) .stage { grid-area: stage; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); padding: 12px 12px 12px 16px; min-height: 0; }
:host([layout="page"]) .stage mathra-field { height: 100%; min-width: 0; min-height: 0; }
:host([layout="page"]) mathra-keyboard { grid-area: keys; margin: 0 12px 12px 16px; }
:host([layout="page"]) .side { grid-area: side; width: 380px; margin: 12px 16px 12px 0; grid-template-rows: minmax(0, auto) minmax(160px, 1fr); }
:host([layout="page"]) .side:has(.settings-panel[hidden]) { grid-template-rows: minmax(0, 1fr); }
.side:has(.settings-panel[hidden]):has(mathra-output[hidden]) { display: none; }
:host([layout="page"]) .settings-panel { max-height: 62vh; }
:host([layout="page"]) mathra-output { overflow: auto; --mathra-output-height: none; }
@media (max-width: 1000px) {
  :host([layout="page"]) .wrap { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(220px, 1fr) auto auto; grid-template-areas: "bar" "tools" "stage" "keys" "side"; height: auto; min-height: 100%; }
  :host([layout="page"]) .side { width: auto; margin: 0 12px 12px 16px; }
  :host([layout="page"]) mathra-toolbar { --mathra-palette-height: 30vh; }
}
@media (max-width: 640px) {
  :host([layout="page"]) mathra-field { font-size: calc(var(--zoom, 1) * 1.6em); }
  :host([layout="page"]) .bar { gap: 2px; }
  .bar .zoom, .bar .sep { display: none; }
  .language > button .name { display: none; }
  .language > button .short { display: inline; }
  .menu { right: auto; left: 0; }
}
::slotted([slot="title"]) { font: 600 15px var(--_font); margin-right: 8px; }

/* the gallery: a large window; the options: a panel at the right that leaves the formula in view */
.text-button { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; color: var(--_ink); background: none; border: 1px solid transparent; border-radius: var(--_radius); font: 13px var(--_font); cursor: pointer; transition: background 0.12s, border-color 0.12s; }
.text-button:hover { background: var(--_key-active); }
.text-button[aria-expanded="true"] { border-color: var(--_border); background: var(--_key-active); }
dialog { color: var(--_ink); background: var(--_background); border: 1px solid var(--_border); padding: 0; box-shadow: 0 24px 60px rgb(0 0 0 / 0.28); }
dialog .head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: var(--_background); border-bottom: 1px solid var(--_border); }
dialog .head h2 { margin: 0; font: 600 16px var(--_font); }
dialog .content { padding: 16px 18px 20px; }
dialog.gallery { width: min(1100px, calc(100vw - 32px)); height: min(820px, calc(100vh - 48px)); border-radius: calc(var(--_radius) + 4px); overflow: auto; }
dialog.gallery::backdrop { background: rgb(0 0 0 / 0.35); }
dialog.gallery[open] { animation: pop 0.18s ease-out; }
@keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.99); } }
.side { display: grid; gap: var(--mathra-gap, 10px); min-height: 0; }
.settings-panel { display: flex; flex-direction: column; min-height: 0; color: var(--_ink); background: var(--_background); border: 1px solid var(--_border); border-radius: var(--_radius); overflow: hidden; animation: slide 0.2s ease-out; }
.settings-panel[hidden] { display: none; }
.settings-panel .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--_border); }
.settings-panel .head h2 { margin: 0; font: 600 15px var(--_font); }
.settings-panel .content { padding: 14px 16px 16px; overflow-y: auto; min-height: 0; }
@keyframes slide { from { transform: translateY(-6px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { dialog[open] { animation: none; } }
@media (max-width: 640px) { .text-button span { display: none; } }
`;

export class MathraEditor extends HTMLElement {
  static observedAttributes = ["value", "locale", "palettes", "outputs", "keyboard", "readonly", "placeholder", "aria-label", "controls", "layout", "theme", "languages"];

  readonly field: MathraField;
  readonly toolbar: MathraToolbar;
  readonly keyboard: MathraKeyboard;
  readonly outputPanel: MathraOutput;
  readonly commandMenu: MathraCommandMenu;
  readonly gallery: MathraGallery;
  readonly settings: MathraSettings;
  private galleryDialog: HTMLDialogElement;
  private settingsDialog: HTMLElement;
  private bar: HTMLDivElement;
  private zoom = 1;
  private menuOpen = false;
  private activeOption = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><div class="wrap" part="wrap"><div class="bar" part="bar"></div><slot name="start"></slot><mathra-toolbar part="toolbar" exportparts="tab, button, grid, search"></mathra-toolbar><div class="stage" part="stage"><mathra-field part="field" exportparts="box, caret, selection, slot, placeholder"></mathra-field></div><mathra-keyboard part="keyboard" exportparts="key" hidden></mathra-keyboard><div class="side" part="side"><section class="settings-panel" part="settings" aria-labelledby="settings-title" hidden><div class="head"><h2 id="settings-title"></h2><button type="button" class="icon-button" data-close="settings"></button></div><div class="content"><mathra-settings></mathra-settings></div></section><mathra-output part="output" exportparts="tab: output-tab, action: output-action"></mathra-output></div><slot name="end"></slot></div><mathra-command-menu></mathra-command-menu><dialog class="gallery" part="gallery" aria-labelledby="gallery-title"><div class="head"><h2 id="gallery-title"></h2><button type="button" class="icon-button" data-close="gallery"></button></div><div class="content"><mathra-gallery></mathra-gallery></div></dialog>`;
    this.field = root.querySelector("mathra-field")!;
    this.toolbar = root.querySelector("mathra-toolbar")!;
    this.keyboard = root.querySelector("mathra-keyboard")!;
    this.outputPanel = root.querySelector("mathra-output")!;
    this.commandMenu = root.querySelector("mathra-command-menu")!;
    this.bar = root.querySelector(".bar")!;
    this.gallery = root.querySelector("mathra-gallery")!;
    this.settings = root.querySelector("mathra-settings")!;
    this.galleryDialog = root.querySelector("dialog.gallery")!;
    this.settingsDialog = root.querySelector(".settings-panel")!;
    for (const c of [this.toolbar, this.keyboard, this.outputPanel, this.commandMenu, this.gallery, this.settings]) c.field = this.field;
    this.settings.output = this.outputPanel;
    for (const d of [this.galleryDialog, this.settingsDialog]) {
      d.addEventListener("click", (e) => {
        const close = (e.target as HTMLElement).closest("[data-close]");
        // a click on the gallery's backdrop closes it too
        if (close || e.target === this.galleryDialog) this.closePanel(d);
      });
    }
    this.galleryDialog.addEventListener("close", () => this.paintBar());
    this.settingsDialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closePanel(this.settingsDialog);
    });
    // an example chosen: the gallery closes on the formula
    this.gallery.addEventListener("mathra-gallery", () => this.closePanel(this.galleryDialog));
    this.bar.addEventListener("pointerdown", (e) => {
      // buttons keep the focus in the field; the language menu takes it
      if ((e.target as HTMLElement).closest(".icon-button, .segmented button")) e.preventDefault();
    });
    this.bar.addEventListener("click", (e) => this.clicked(e));
    this.bar.addEventListener("keydown", (e) => this.menuKey(e));
    this.field.addEventListener("input", () => this.paintBar());
    document.addEventListener("pointerdown", (e) => {
      if (this.menuOpen && !e.composedPath().includes(this.bar.querySelector(".language")!)) this.closeMenu();
    });
  }

  connectedCallback(): void {
    this.sync();
    // on a touch screen the keyboard on the screen starts open, unless keyboard="off"
    const mode = this.getAttribute("keyboard");
    this.keyboard.hidden = mode === "on" ? false : mode === "off" ? true : !matchMedia("(pointer: coarse)").matches;
    init().then(() => this.paintBar());
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.sync();
  }

  /** The formula as plain LaTeX. */
  get value(): string {
    return this.field.value;
  }

  set value(latex: string) {
    this.field.value = latex;
  }

  /** The editor without a screen. */
  get editor() {
    return this.field.editor;
  }

  override focus(options?: FocusOptions): void {
    this.field.focus(options);
  }

  private get controls(): Control[] {
    const v = this.getAttribute("controls");
    if (v !== null) return v.split(/[\s,]+/).filter((c): c is Control => ALL_CONTROLS.includes(c as Control));
    return this.getAttribute("layout") === "page" ? ALL_CONTROLS : ["history", "keyboard"];
  }

  private get locale(): string {
    return this.getAttribute("locale") ?? "en";
  }

  private sync(): void {
    const pass = (el: HTMLElement, name: string) => {
      const v = this.getAttribute(name);
      if (v === null) el.removeAttribute(name);
      else el.setAttribute(name, v);
    };
    for (const name of ["value", "locale", "readonly", "placeholder", "aria-label"]) pass(this.field, name);
    for (const el of [this.toolbar, this.keyboard, this.outputPanel, this.commandMenu, this.gallery, this.settings]) pass(el, "locale");
    pass(this.toolbar, "palettes");
    this.toolbar.toggleAttribute("wrap", this.getAttribute("layout") === "page");
    const outputs = this.getAttribute("outputs");
    this.outputPanel.hidden = outputs === "none";
    if (outputs && outputs !== "none") this.outputPanel.setAttribute("formats", outputs);
    this.toolbar.hidden = this.hasAttribute("readonly") || this.getAttribute("palettes") === "none";
    this.paintBar();
  }

  /** The languages offered: `languages="en pt-BR es"`, or all mathra speaks. */
  private languages(): { code: string; name: string }[] {
    let all: { code: string; name: string }[] = [];
    try {
      all = locales();
    } catch {
      all = [{ code: this.locale, name: this.locale }];
    }
    const pick = this.getAttribute("languages")?.split(/[\s,]+/).filter(Boolean);
    return pick ? pick.map((c) => all.find((l) => l.code === c) ?? { code: c, name: c }) : all;
  }

  private paintBar(): void {
    const locale = this.locale;
    const c = this.controls;
    const e = this.field.editor;
    const readonly = this.hasAttribute("readonly");
    const button = (act: string, name: string, words: (typeof UI)[keyof typeof UI], extra = "") => {
      const label = html(say(words, locale));
      return `<button type="button" class="icon-button" part="action" data-act="${act}" title="${label}" aria-label="${label}"${extra}>${icon(name)}</button>`;
    };
    const parts: string[] = ['<slot name="title"></slot>'];
    if (c.includes("history") && !readonly)
      parts.push(`<div class="group">${button("undo", "undo", UI.undo, e.canUndo() ? "" : " disabled")}${button("redo", "redo", UI.redo, e.canRedo() ? "" : " disabled")}${button("clear", "clear", UI.clear, e.isEmpty() ? " disabled" : "")}</div>`);
    if (c.includes("zoom")) parts.push(`<div class="group zoom">${button("zoomOut", "zoomOut", UI.zoomOut, this.zoom <= ZOOMS[0] ? " disabled" : "")}<span class="zoom-value" aria-live="polite">${Math.round(this.zoom * 100)}%</span>${button("zoomIn", "zoomIn", UI.zoomIn, this.zoom >= ZOOMS[ZOOMS.length - 1] ? " disabled" : "")}</div>`);
    parts.push('<span class="spacer"></span>');
    const textButton = (act: string, name: string, words: (typeof UI)[keyof typeof UI], open: boolean) => {
      const label = html(say(words, locale));
      return `<button type="button" class="text-button" part="action" data-act="${act}" title="${label}" aria-label="${label}" aria-haspopup="dialog" aria-expanded="${open}">${icon(name)}<span>${label}</span></button>`;
    };
    if (c.includes("gallery")) parts.push(textButton("gallery", "gallery", UI.galleryTitle, this.galleryDialog.open));
    if (c.includes("settings")) parts.push(textButton("settings", "options", UI.settingsTitle, !this.settingsDialog.hidden));
    if (c.includes("language")) {
      const langs = this.languages();
      const current = langs.find((l) => l.code === locale) ?? { code: locale, name: locale };
      const label = html(say(UI.language, locale));
      parts.push(
        `<div class="language"><button type="button" part="language" data-act="language" aria-haspopup="listbox" aria-expanded="${this.menuOpen}" title="${label}" aria-label="${label}: ${html(current.name)}">${icon("globe")}<span class="name">${html(current.name)}</span><span class="short">${html(current.code)}</span>${icon("chevron")}</button>` +
          (this.menuOpen
            ? `<div class="menu" role="listbox" aria-label="${label}" tabindex="-1">${langs.map((l, i) => `<div role="option" id="lang-${i}" data-code="${html(l.code)}" aria-selected="${l.code === locale}" class="${i === this.activeOption ? "active" : ""}"><span>${html(l.name)}</span><span class="code">${html(l.code)}</span></div>`).join("")}</div>`
            : "") +
          "</div>",
      );
    }
    if (c.includes("theme")) {
      const theme = this.getAttribute("theme") ?? "auto";
      const option = (value: string, name: string, words: (typeof UI)[keyof typeof UI]) => {
        const label = html(say(words, locale));
        return `<button type="button" role="radio" part="theme" data-theme="${value}" aria-checked="${theme === value}" title="${label}" aria-label="${label}">${icon(name)}</button>`;
      };
      parts.push(`<div class="segmented" role="radiogroup" aria-label="${html(say(UI.theme, locale))}">${option("auto", "monitor", UI.themeAuto)}${option("light", "sun", UI.themeLight)}${option("dark", "moon", UI.themeDark)}</div>`);
    }
    if (c.includes("keyboard") || c.includes("outputs")) {
      parts.push('<span class="sep"></span><div class="group">');
      if (c.includes("keyboard") && this.getAttribute("keyboard") !== "off") parts.push(button("keyboard", "keyboard", UI.keyboard, ` aria-pressed="${!this.keyboard.hidden}"`));
      if (c.includes("outputs") && this.getAttribute("outputs") !== "none") parts.push(button("outputs", "panel", UI.showOutputs, ` aria-pressed="${!this.outputPanel.hidden}"`));
      parts.push("</div>");
    }
    parts.push('<slot name="actions"></slot>');
    const hadFocus = this.shadowRoot!.activeElement?.closest?.(".language") ? true : false;
    this.bar.innerHTML = parts.join("");
    this.style.setProperty("--zoom", String(this.zoom));
    if (this.menuOpen) {
      const menu = this.bar.querySelector<HTMLElement>(".menu");
      menu?.focus();
      menu?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
    } else if (hadFocus) this.bar.querySelector<HTMLElement>(".language > button")?.focus();
  }

  private clicked(e: Event): void {
    const t = e.target as HTMLElement;
    const option = t.closest<HTMLElement>("[role=option]");
    if (option) return this.chooseLanguage(option.dataset.code!);
    const theme = t.closest<HTMLElement>("[data-theme]");
    if (theme) {
      this.setAttribute("theme", theme.dataset.theme!);
      this.dispatchEvent(new CustomEvent("mathra-theme", { detail: { theme: theme.dataset.theme }, bubbles: true, composed: true }));
      this.field.focus();
      return;
    }
    const b = t.closest<HTMLButtonElement>("button[data-act]");
    if (!b) return;
    const act = b.dataset.act!;
    if (act === "language") {
      if (this.menuOpen) this.closeMenu();
      else this.openMenu();
      return;
    }
    if (act === "gallery") return this.openPanel(this.galleryDialog);
    if (act === "settings") return this.settingsDialog.hidden ? this.openPanel(this.settingsDialog) : this.closePanel(this.settingsDialog);
    if (act === "keyboard") this.keyboard.hidden = !this.keyboard.hidden;
    else if (act === "outputs") this.outputPanel.hidden = !this.outputPanel.hidden;
    else if (act === "zoomIn" || act === "zoomOut") {
      const i = ZOOMS.indexOf(this.zoom) + (act === "zoomIn" ? 1 : -1);
      this.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i))];
    } else this.field.run(act);
    this.paintBar();
    this.field.focus();
  }

  private openPanel(d: HTMLElement): void {
    const locale = this.locale;
    const gallery = d === this.galleryDialog;
    d.querySelector("h2")!.textContent = say(gallery ? UI.galleryTitle : UI.settingsTitle, locale);
    const close = d.querySelector<HTMLElement>("[data-close]")!;
    close.innerHTML = icon("close");
    close.title = say(UI.close, locale);
    close.setAttribute("aria-label", say(UI.close, locale));
    if (gallery) {
      (d as HTMLDialogElement).showModal();
      this.gallery.focusSearch();
    } else {
      // above the outputs, beside the formula: both change in view as the options do
      d.hidden = false;
      this.outputPanel.hidden = false;
      this.settings.loadCatalog();
      close.focus();
    }
    this.paintBar();
  }

  private closePanel(d: HTMLElement): void {
    if (d instanceof HTMLDialogElement) {
      if (d.open) d.close();
    } else d.hidden = true;
    this.paintBar();
    this.field.focus();
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.activeOption = Math.max(0, this.languages().findIndex((l) => l.code === this.locale));
    this.paintBar();
  }

  private closeMenu(focusButton = false): void {
    this.menuOpen = false;
    // only the menu goes: redrawing the bar here would lose a click on another of its buttons
    this.bar.querySelector(".language .menu")?.remove();
    this.bar.querySelector(".language > button")?.setAttribute("aria-expanded", "false");
    if (focusButton) this.bar.querySelector<HTMLElement>(".language > button")?.focus();
  }

  private chooseLanguage(code: string): void {
    this.menuOpen = false;
    this.setAttribute("locale", code);
    this.dispatchEvent(new CustomEvent("mathra-locale", { detail: { locale: code }, bubbles: true, composed: true }));
    this.paintBar();
    this.field.focus();
  }

  private menuKey(e: KeyboardEvent): void {
    if (!this.menuOpen) {
      if ((e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") && (e.target as HTMLElement).closest(".language > button")) {
        e.preventDefault();
        this.openMenu();
      }
      return;
    }
    const n = this.languages().length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      this.activeOption = (this.activeOption + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      this.paintBar();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.chooseLanguage(this.languages()[this.activeOption].code);
    } else if (e.key === "Escape" || e.key === "Tab") {
      this.closeMenu(e.key === "Escape");
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("mathra-editor")) customElements.define("mathra-editor", MathraEditor);
