// <mathra-command-menu>: while a command is typed after `\`, a list of the commands that start with
// what was typed, beside the cursor. Up and down choose, Enter or Tab take it, Escape closes.

import { FieldClient, TOKENS, html, say, UI } from "./shared.ts";
import { commandCatalog, PALETTES, type PaletteItem, type PaletteSet } from "./sets.ts";
import { mathraReady, preview, BUTTON_STYLE } from "./palette.ts";
import { previewLatex } from "./sets.ts";
import type { CommandDetail, MathraField } from "./field.ts";

const STYLE = `
${TOKENS}
:host { position: fixed; z-index: var(--mathra-menu-z, 1000); display: block; }
:host([hidden]) { display: none; }
.menu {
  min-width: 240px; max-width: min(340px, calc(100vw - 16px)); max-height: 280px; overflow-y: auto;
  color: var(--_ink); background: var(--_background); border: 1px solid var(--_border); border-radius: var(--_radius);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.18); font: 13px var(--_font); animation: open 0.14s ease-out;
}
@keyframes open { from { opacity: 0; transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .menu { animation: none; } }
.item { display: grid; grid-template-columns: 48px 1fr; gap: 10px; align-items: center; padding: 6px 10px; cursor: pointer; }
.item[aria-selected="true"] { background: var(--_surface); box-shadow: inset 3px 0 0 var(--_accent); }
.item .face { display: grid; place-items: center; height: 30px; }
.item .face svg { max-height: 28px; max-width: 48px; width: auto; height: auto; font-size: 13px; }
.item .name { font-family: var(--_mono); }
.item .title { color: var(--_muted); font-size: 12px; }
.none { padding: 10px; color: var(--_muted); }
${BUTTON_STYLE}
`;

export class MathraCommandMenu extends FieldClient {
  static observedAttributes = ["locale"];
  /** The commands offered: those the palettes name, unless set. */
  commands: { name: string; item: PaletteItem }[] = commandCatalog();
  private list: HTMLDivElement;
  private shown: { name: string; item: PaletteItem }[] = [];
  private chosen = 0;
  private open = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><div class="menu" part="menu" role="listbox" hidden></div>`;
    this.list = root.querySelector(".menu")!;
    this.hidden = true;
    this.list.addEventListener("pointerdown", (e) => e.preventDefault());
    this.list.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(".item");
      if (el) this.take(Number(el.dataset.i));
    });
  }

  /** Offers the commands of these palettes. */
  set palettes(sets: PaletteSet[]) {
    this.commands = commandCatalog(sets);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    mathraReady();
  }

  protected override attach(field: MathraField): () => void {
    const onCommand = (e: Event) => this.follow((e as CustomEvent<CommandDetail>).detail);
    const onKey = (e: Event) => {
      if (!this.open) return;
      const { key } = (e as CustomEvent<{ key: string }>).detail;
      if (key === "ArrowDown" || key === "ArrowUp") {
        this.choose(this.chosen + (key === "ArrowDown" ? 1 : -1));
        e.preventDefault();
      } else if ((key === "Enter" || key === "Tab") && this.shown.length) {
        this.take(this.chosen);
        e.preventDefault();
      } else if (key === "Escape") {
        this.close();
      }
    };
    field.addEventListener("mathra-command", onCommand);
    field.addEventListener("mathra-key", onKey);
    return () => {
      field.removeEventListener("mathra-command", onCommand);
      field.removeEventListener("mathra-key", onKey);
    };
  }

  private follow(d: CommandDetail): void {
    if (!d.active || !d.rect) return this.close();
    const typed = d.name.toLowerCase();
    // names that start with what was typed first, then those that contain it
    const starts = this.commands.filter((c) => c.name.toLowerCase().startsWith(typed));
    const contains = this.commands.filter((c) => !c.name.toLowerCase().startsWith(typed) && c.name.toLowerCase().includes(typed));
    this.shown = [...starts, ...contains].slice(0, 40);
    this.chosen = 0;
    this.open = true;
    this.hidden = false;
    this.list.hidden = false;
    this.paint();
    this.place(d.rect);
  }

  private paint(): void {
    const locale = this.locale;
    this.list.setAttribute("aria-label", say(UI.commands, locale));
    if (!this.shown.length) {
      this.list.innerHTML = `<div class="none">${html(say(UI.noCommand, locale))}</div>`;
      return;
    }
    this.list.innerHTML = this.shown
      .map(
        (c, i) =>
          `<div class="item" part="item" role="option" data-i="${i}" aria-selected="${i === this.chosen}"><span class="face">${preview(previewLatex(c.item))}</span><span><div class="name">\\${html(c.name)}</div><div class="title">${html(say(c.item.title, locale))}</div></span></div>`,
      )
      .join("");
  }

  private place(rect: DOMRect): void {
    const h = this.list.offsetHeight;
    const below = rect.bottom + 6;
    const top = below + h > window.innerHeight && rect.top - h - 6 > 0 ? rect.top - h - 6 : below;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - this.list.offsetWidth - 8));
    Object.assign(this.style, { top: `${top}px`, left: `${left}px` });
  }

  private choose(i: number): void {
    if (!this.shown.length) return;
    this.chosen = (i + this.shown.length) % this.shown.length;
    for (const el of this.list.querySelectorAll<HTMLElement>(".item")) el.setAttribute("aria-selected", String(Number(el.dataset.i) === this.chosen));
    this.list.querySelector<HTMLElement>(`.item[data-i="${this.chosen}"]`)?.scrollIntoView({ block: "nearest" });
  }

  private take(i: number): void {
    const c = this.shown[i];
    const field = this.field;
    if (!c || !field) return;
    // the command's letters go, then what it inserts
    field.editor.batch(() => {
      field.editor.completeCommand("");
      if (c.item.action) field.run(c.item.action);
      else if (c.item.insert !== undefined) field.run(`latex:${c.item.insert}`);
    });
    // a block inserted inside the batch opens its editor now
    const pending = field.editor.takePendingBlock();
    if (pending) field.openBlock(pending.atom, pending.caret);
    this.close();
    if (!pending) field.focus();
  }

  private close(): void {
    this.open = false;
    this.hidden = true;
    this.list.hidden = true;
  }
}

/** The commands of every palette that comes with the editor (for a menu of your own). */
export const ALL_COMMANDS = () => commandCatalog(PALETTES);

if (typeof customElements !== "undefined" && !customElements.get("mathra-command-menu")) customElements.define("mathra-command-menu", MathraCommandMenu);
