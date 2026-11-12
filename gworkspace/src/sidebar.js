// The sidebar's script: mathra's components wired together, the alt text that follows the formula, the
// equation as PNG, and the calls to Code.js (insertEquation, getContext). build.mjs puts it inside
// Sidebar.html; the preview and the tests serve it as it is.

import { init, locales } from "@mathlabs/mathra";
import "@mathlabs/mathra-editor";

const $ = (id) => document.getElementById(id);
const field = $("field");
const output = $("output");
const speech = $("speech");
const select = $("locale");
const insert = $("insert");
const status = $("status");
const settings = document.querySelector("mathra-settings");
const gallery = document.querySelector("mathra-gallery");
// the options panel sets the PNG's size on the outputs, as in the editor
settings.output = output;

// the words of the sidebar: Portuguese for pt-BR, English otherwise; mathra's components follow `locale`
const WORDS = {
  en: { alt: "Alt text (what a screen reader says)", lang: "Language", insert: "Insert", update: "Update", clear: "New", empty: "Type an equation above", inserted: "Inserted", updated: "Updated", working: "Inserting…", undo: "Undo", redo: "Redo", gallery: "Gallery", settings: "Options", keyboard: "Keyboard", output: "Outputs", close: "Close" },
  "pt-BR": { alt: "Texto alternativo (o que o leitor de tela diz)", lang: "Idioma", insert: "Inserir", update: "Atualizar", clear: "Nova", empty: "Digite uma equação acima", inserted: "Inserida", updated: "Atualizada", working: "Inserindo…", undo: "Desfazer", redo: "Refazer", gallery: "Galeria", settings: "Opções", keyboard: "Teclado", output: "Saídas", close: "Fechar" },
};
let words = WORDS.en;
// the equation selected in the document, while the sidebar edits it
let editing = "";

/** Calls a function of Code.js and resolves with what it returns. */
const server = (name, ...args) =>
  new Promise((resolve, reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args));

function setLocale(code) {
  words = WORDS[code] ?? WORDS.en;
  for (const el of document.querySelectorAll("mathra-toolbar, mathra-field, mathra-keyboard, mathra-output, mathra-settings, mathra-gallery")) el.setAttribute("locale", code);
  $("alt-label").textContent = words.alt;
  $("lang-label").textContent = words.lang;
  $("clear").textContent = words.clear;
  $("gallery-title").textContent = words.gallery;
  $("settings-title").textContent = words.settings;
  for (const b of document.querySelectorAll(".bar .icon")) b.title = words[b.dataset.run ?? b.dataset.open ?? b.dataset.toggle];
  for (const b of document.querySelectorAll("[data-close]")) b.title = words.close;
  speech.dataset.empty = words.empty;
  insert.textContent = editing ? words.update : words.insert;
  refresh();
}

/** The alt text and the buttons follow the formula as it is typed, in the options chosen. */
function refresh() {
  const latex = field.value.trim();
  insert.disabled = !latex;
  speech.textContent = latex ? field.output?.speech ?? "" : "";
}

/** The equation as PNG, at the scale the options set (three times its size by default): it stays sharp zoomed in or printed. */
async function picture(svg) {
  const scale = Number(output.getAttribute("png-scale") ?? 3);
  const em = (name) => Number(new RegExp(`${name}="([\\d.]+)em"`).exec(svg)[1]);
  const px = 16;
  const [w, h] = [em("width") * px, em("height") * px];
  const sized = svg.replace(/width="[\d.]+em"/, `width="${w}"`).replace(/height="[\d.]+em"/, `height="${h}"`);
  const image = new Image();
  image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(sized)))}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return { png: canvas.toDataURL("image/png").split(",")[1], em: { width: em("width"), height: em("height") } };
}

insert.addEventListener("click", async () => {
  const latex = field.value.trim();
  // what the field draws: with the font, the style and every option chosen
  const result = field.output;
  if (!result) return;
  const { png, em } = await picture(result.svg);
  insert.disabled = true;
  status.className = "";
  status.textContent = words.working;
  try {
    await server("insertEquation", { png, em, alt: result.speech, latex, replace: !!editing });
    status.textContent = editing ? words.updated : words.inserted;
    // the document's selection moved off the old equation: the next one is a new equation
    editing = "";
    insert.textContent = words.insert;
  } catch (e) {
    status.className = "error";
    status.textContent = e.message;
  } finally {
    insert.disabled = false;
  }
});

$("clear").addEventListener("click", () => {
  editing = "";
  field.value = "";
  insert.textContent = words.insert;
  status.textContent = "";
  field.focus();
});

// the bar: undo and redo, the gallery and the options over the sidebar, the keyboard and the outputs under the field
document.querySelector(".bar").addEventListener("pointerdown", (e) => {
  // the buttons leave the focus in the formula
  if (e.target.closest(".icon")) e.preventDefault();
});
document.querySelector(".bar").addEventListener("click", (e) => {
  const b = e.target.closest(".icon");
  if (!b) return;
  if (b.dataset.run) field.run(b.dataset.run);
  if (b.dataset.open) {
    $(b.dataset.open).hidden = false;
    if (b.dataset.open === "settings") settings.loadCatalog?.();
    if (b.dataset.open === "gallery") gallery.focusSearch?.();
  }
  if (b.dataset.toggle) {
    const el = $(b.dataset.toggle);
    el.hidden = !el.hidden;
    b.setAttribute("aria-pressed", String(!el.hidden));
  }
});
for (const panel of document.querySelectorAll(".panel")) {
  const close = () => {
    panel.hidden = true;
    field.focus();
  };
  panel.querySelector("[data-close]").addEventListener("click", close);
  panel.addEventListener("keydown", (e) => e.key === "Escape" && close());
}
// an example chosen: the gallery closes on the formula
gallery.addEventListener("mathra-gallery", () => {
  $("gallery").hidden = true;
  field.focus();
});

field.addEventListener("input", refresh);
// the options and the fonts change the drawing, and the speech with the language
field.addEventListener("mathra-render", refresh);
select.addEventListener("change", () => setLocale(select.value));

// an equation clicked in the document comes into the field, to be updated in place
async function follow() {
  try {
    const { latex } = await server("getContext");
    if (latex && latex !== editing) {
      editing = latex;
      field.value = latex;
      insert.textContent = words.update;
      status.textContent = "";
      refresh();
    } else if (!latex && editing) {
      // the equation is no longer selected: what is in the field goes in as a new one
      editing = "";
      insert.textContent = words.insert;
    }
  } catch {}
  setTimeout(follow, 1500);
}

await init();
const { locale, latex } = await server("getContext");
for (const l of locales()) select.add(new Option(l.name, l.code));
// the account's language, as close as mathra has it (pt_BR → pt-BR)
const wanted = (locale || "en").replace("_", "-").toLowerCase();
select.value = locales().find((l) => l.code.toLowerCase() === wanted)?.code ?? locales().find((l) => l.code.toLowerCase().split("-")[0] === wanted.split("-")[0])?.code ?? "en";
editing = latex;
field.value = latex;
setLocale(select.value);
field.focus();
follow();
