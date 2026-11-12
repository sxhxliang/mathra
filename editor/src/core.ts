// @mathlabs/mathra-editor/core: the editor without a screen (no DOM, no mathra).
export { Editor, TEMPLATES, childRows, classOfTree, numberRun } from "./model.ts";
export type { Atom, AtomClass, AtomSpec, ChangeKind, ChangeListener, Cursor, LatexOptions, Row, Selection } from "./model.ts";
export { readLatex } from "./latex.ts";
export { atomRect, boxesById, caretRect, cursorAt, rowRect, selectionRect } from "./geometry.ts";
export type { Box, Rect } from "./geometry.ts";
