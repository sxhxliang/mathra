// @mathlabs/mathra-editor: importing it defines every element (<mathra-field>, <mathra-palette>,
// <mathra-toolbar>, <mathra-command-menu>, <mathra-keyboard>, <mathra-output>, <mathra-editor>).
// `@mathlabs/mathra-editor/core` is the editor without a screen.

export { Editor, TEMPLATES, childRows, classOfTree, numberRun } from "./model.ts";
export { GALLERY } from "./gallery.ts";
export type { GalleryExample, GalleryGroup } from "./gallery.ts";
export type { Atom, AtomClass, AtomSpec, ChangeKind, ChangeListener, Cursor, LatexOptions, Row, Selection } from "./model.ts";
export { readLatex } from "./latex.ts";
export { atomRect, boxesById, caretRect, cursorAt, rowRect, selectionRect } from "./geometry.ts";
export type { Box, Rect } from "./geometry.ts";
export { MathraField, DEFAULT_KEYMAP } from "./field.ts";
export type { CommandDetail, InputDetail, Keymap, Timing } from "./field.ts";
export { MathraPalette, MathraToolbar, preview } from "./palette.ts";
export { MathraCommandMenu } from "./command-menu.ts";
export { MathraKeyboard, NUMBERS, LETTERS, FUNCTIONS as FUNCTION_KEYS } from "./keyboard.ts";
export type { Key, KeyboardLayer } from "./keyboard.ts";
export { MathraOutput } from "./output.ts";
export type { Format } from "./output.ts";
export { MathraEditor } from "./editor.ts";
export { MathraSettings } from "./settings.ts";
export { MathraGallery } from "./gallery-view.ts";
export { DIAGRAMS, PALETTES, STRUCTURES, CALCULUS, MATRICES, GREEK_LETTERS, OPERATORS, RELATIONS, ARROWS, SETS, FUNCTIONS, ACCENTS, commandCatalog, previewLatex } from "./sets.ts";
export type { PaletteItem, PaletteSet } from "./sets.ts";
export { FieldClient, TOKENS, UI, icon, say } from "./shared.ts";
export type { Words } from "./shared.ts";
