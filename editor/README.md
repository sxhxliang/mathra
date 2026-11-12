<p align="center"><img src="https://raw.githubusercontent.com/matheusmota-dev-br/mathra/main/docs/editor-banner.svg" alt="mathra editor: build a formula in a box, drawn by mathra" width="100%"></p>

# @mathlabs/mathra-editor

[![npm](https://img.shields.io/npm/v/@mathlabs/mathra-editor)](https://www.npmjs.com/package/@mathlabs/mathra-editor)

A math editor for the web: build a formula inside a box, with a cursor, empty places to fill, palettes, a command menu, a keyboard on the screen and every output. **[Try it on mathra's site](https://matheusmota-dev-br.github.io/mathra/editor.html)**, and see **[how it works, drawn and live](https://matheusmota-dev-br.github.io/mathra/editor-docs.html)**: every key, chemistry, diagrams, putting it in your page.

What you edit is what [mathra](https://github.com/matheusmota-dev-br/mathra#readme) draws, because mathra draws the box itself at every change (about a millisecond per key in a browser). Web Components: they work in React, Vue, Svelte, Angular or plain HTML. Every piece can be used alone, restyled, or replaced; the editor underneath has no DOM.

- **Typed as on a calculator.** `sqrt`, `pi`, `sum`, `int`, `lim` become what they name; `<=` is ≤, `->` is →; `/` makes a fraction of what is before it; `^` and `_` end on their own: `x^2+1` needs no braces. Or `\` and a command, as in LaTeX.
- **Every structure.** Fractions, roots, large operators, matrices sized on a grid (as a table in a word processor), cases, alignments, accents, physics' derivatives and Dirac notation, each with its places.
- **Chemistry and diagrams as boxes.** Reactions typed as they are written (`2H2 + O2 -> 2H2O`), structures drawn atom by atom and bond by bond, reaction schemes, and commutative diagrams with arrows dragged between cells.
- **Every output.** LaTeX, MathML, SVG, PNG, speech in 16 languages and braille, from the same formula.
- **LaTeX in, LaTeX out.** Paste any formula: what the editor takes apart is edited in place, the rest stays as written, and the LaTeX it writes back draws what it drew.

## Install

```sh
npm install @mathlabs/mathra-editor @mathlabs/mathra
```

`@mathlabs/mathra` (1.12 or later) is a peer dependency: the components load its WebAssembly themselves (`init()`). With a bundler, nothing else is needed; without one, map `@mathlabs/mathra` in an import map, as `demo/index.html` and the [site's page](https://github.com/matheusmota-dev-br/mathra/blob/main/site/editor.html) do.

## Quick start

```html
<script type="module">
  import "@mathlabs/mathra-editor";
</script>

<mathra-editor layout="page" locale="pt-BR" value="x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}">
  <span slot="title">My editor</span>
</mathra-editor>

<script type="module">
  const editor = document.querySelector("mathra-editor");
  editor.addEventListener("input", (e) => console.log(e.detail.latex));
</script>
```

Only a box, for an answer in a form:

```html
<mathra-field id="answer" inline placeholder="Your answer"></mathra-field>
<mathra-toolbar for="answer" palettes="structures greek"></mathra-toolbar>
```

## The components

| Element | What it is |
| --- | --- |
| `<mathra-editor>` | Everything together: a bar (undo, redo, clear, zoom, gallery, mathra's options, language, theme, keyboard, outputs), palettes in tabs with a search, the field, the keyboard (open on touch screens), the command menu and the outputs. `layout="page"` fills the page: the formula takes the room left, the outputs sit beside it (below it on narrow screens). |
| `<mathra-field>` | The box. Typing, clicking, dragging, Shift+arrows, copy and paste of LaTeX, undo. `inline` makes it the size of an answer in a sentence. |
| `<mathra-toolbar for="f">` | Palettes in tabs, and a search over every button (by its name in English or Portuguese, accents ignored, or its command; Enter inserts the first). `palettes="structures calculus greek"` picks and orders them; `nosearch` hides the search; `wrap` shows every tab. |
| `<mathra-palette for="f" set="greek">` | One grid of buttons. |
| `<mathra-command-menu for="f">` | While `\name` is typed, the commands that start with it, beside the cursor. |
| `<mathra-keyboard for="f">` | A keyboard on the screen: numbers, letters, functions and symbols. |
| `<mathra-output for="f">` | LaTeX, MathML, SVG, PNG, speech, braille, text, and the rules mathra applied with its warnings, with copy and download (and "write it again" when the SVG is animated). `formats="latex mathml"` picks them. |
| `<mathra-settings for="f">` | mathra's options, each with a control: the font (the 30 of the [mathfonts](https://matheusmota-dev-br.github.io/mathfonts/) catalog, downloaded only when chosen), display or inline, breaking long formulas at a maximum width, the braille code, the SVG written stroke by stroke, strict mode, and the PNG's size. The box itself stays one line, in the chosen font and style; the rest applies to the outputs. |
| `<mathra-gallery for="f">` | mathra's gallery (110 examples in LaTeX, from `corpus/gallery.json`), drawn by mathra, with a search; choosing one opens it in the field (it can be undone), with its options. |

`for` names a field by its id. In JavaScript, `component.field = fieldElement` does the same (also across shadow roots).

### Attributes of `<mathra-field>` (and `<mathra-editor>`)

| Attribute | |
| --- | --- |
| `value` | The formula, as LaTeX. |
| `locale` | mathra's language: speech, decimal comma, `\sen`; and the components' own words (`en` and `pt-BR`). |
| `placeholder` | Text shown while the field is empty. |
| `readonly` | Shown, not edited. |
| `inline` | Text style, sized for a sentence (field only). |
| `aria-label` | The field's name for screen readers; the formula itself is read through mathra's speech. |
| `palettes`, `outputs`, `keyboard` | (`<mathra-editor>` only) which palettes, which outputs (`none` hides them), and `keyboard="on"`, `"off"` or automatic. |
| `layout`, `controls`, `theme`, `languages` | (`<mathra-editor>` only) `layout="page"`; the bar's controls (`controls="history zoom gallery settings language theme keyboard outputs"`, all of them in a page, history and keyboard otherwise); `theme="auto"`, `"light"` or `"dark"`; the languages the menu offers (`languages="en pt-BR es"`, all 16 that mathra speaks by default, each under its own name). |

### Events

| Event | When | `detail` |
| --- | --- | --- |
| `input` | The formula changed. | `{ latex }` |
| `change` | The field lost the focus with a different formula. | `{ latex }` |
| `mathra-command` | A command is typed after `\` (what the command menu follows). | `{ name, active, rect }` |
| `mathra-render` | The field drew the formula (an edit, a language, a font). | |
| `mathra-options`, `mathra-gallery` | An option was changed in the panel; an example of the gallery was opened. | the options; `{ example }` |
| `mathra-locale`, `mathra-theme` | The language or the theme was chosen in the editor's bar (to remember it, as the demo does). | `{ locale }`, `{ theme }` |

### Typing

| Key | Does |
| --- | --- |
| letters, digits, `+ - * = < > , ;` | a symbol, with TeX's spacing for its class |
| `/` | a fraction; what is before the cursor, back to an operator, becomes the numerator (`(a+b)/` without its parentheses; a function with its argument: `sin(x)/x`; a power whole: `x^2/3`). A denominator, or a root, that is a number or a name ends at an operator, a relation, `(` or a space: `1/2+3/4`, `d/dx(x^n)`, `sqrt2/2`; `2a` stays in it |
| `^`, `_` | an exponent, an index; one that is a number or a name (`2`, `-1`, `n`) ends at the operator, relation, comma, `(`, `/` or space typed after it, and a number also at a letter: `x^2+1`, `x_1+x_2`, `H_2O`, `log_2(8)`. In a large operator's limits, `_` and `^` go to the lower and upper one, and a space or `(…)` ends them: `int_0^1 x dx`, `sum_(k=1)^n`, `lim x->0 sin x`. `{` in an empty exponent, index, root or part of a fraction groups it, as in LaTeX, and `}` leaves it: `x^{n+1}`, `\frac{a}{b}` |
| `(` `[` `{` `\|` | delimiters that grow when what they hold is tall; the closing character leaves them. `(…)` typed alone in an exponent, an index, a root or a denominator is that place, and `)` leaves it: `e^(2x)`, `sqrt(x+1)`, `1/(x+1)` |
| words | `sqrt`, `cbrt`, `nthroot`, `sum`, `prod`, `int`, `lim`, `infinity`, the Greek letters (`pi`, `theta`, `Delta`…) and the functions (`sin`, `cos`, `log`, `ln`, `exp`, `max`…) and `in` (∈) become what they name as their last letter is typed, when the letters typed since the last other character (or space) are that whole word: `point` and `xpi` stay letters, `x pi` is x·π. A word typed on becomes the longer one: `sin` then `h` is `sinh`, `in` then `t` is `int` |
| `<=` `>=` `!=` `->` `=>` `+-` `-+` `...` | ≤ ≥ ≠ → ⇒ ± ∓ … (a space between them keeps them apart: `n! =`) |
| `\` then a name, then space or Enter | a command: `\pm`, `\alpha`, `\le`, `\sin`…, or a structure: `\frac`, `\sqrt`, `\root`, `\sum`, `\int`, `\lim`, `\vec`, `\mathbb`, `\text`, `\pmatrix`… |
| arrows, Home, End | move; up and down between numerator and denominator, exponent and index, the cells of a matrix |
| Shift with arrows, Home, End; drag; double click | select |
| Tab, Shift+Tab | the next (previous) empty place or cell |
| `&`, Enter (in a matrix) | the next cell, the line below (added at the end) |
| Ctrl/⌘+Enter; Shift+Enter or Ctrl/⌘+Shift+Enter | a line, a column in the matrix |
| Backspace, Delete | delete; a structure with something inside is entered first; at the start of parentheses or a root, they go and what they held stays; in an empty denominator, the fraction goes and its numerator stays |
| Ctrl/⌘+A, C, X, V | select all, copy, cut, paste (LaTeX; `$…$`, `\(…\)` and `\[…\]` around it are dropped) |
| Ctrl/⌘+Z, Shift+Ctrl/⌘+Z, Ctrl+Y | undo, redo |
| Escape | leaves a command being typed, a structure, the selection, or an arrow's label (back to the cell it leaves) |
| Alt+arrow | in a diagram's cell, an arrow (Alt+Shift: dashed); on a structure's atom, a bond |

### Chemistry and diagrams, edited as boxes

Reactions, structures, schemes and commutative diagrams are edited piece by piece, like the rest of the formula. mathra draws them and says where each piece is (a mark around a species, an atom or a cell moves nothing); the editor writes the LaTeX back.

- **Reactions** (`\ce`). Type `\ce` and a space, or use the chemistry palette. Species, `+` and arrows build themselves as you type: `2H2(g) + O2(g) ->[spark] 2H2O(l)`. A species is typed as math: `_` and `^` as anywhere (`H_2O`, `SO_4^{2-}`), a number right after an element or a closing is its index (`H2O`, `Ca(OH)2`), and a charge stays whole over it (`SO4^2-`); the coefficient and the state are what they look like (`2`, `(l)`), and the LaTeX is written as mhchem writes it (`SO4^2-`). A space, or `->`, `<=>`, `<->` right after a species, moves on; `[` goes over the arrow and a second `[` under it. With the cursor beside an arrow, its two places show as boxes to click into. While the cursor is in a reaction, each piece is outlined, and a bar switches the arrow (→ ⇌ ⥂ ⥄ ↔ ←), goes over or under it, adds `+`, ↑ or ↓, or removes a piece.
- **Structures** (`\chemfig`). Click an atom or a bond to pick it, then type the atom's label: in the formula, or in the bar's box, which takes any label (`OH`, `CH3`, `NH4^+`, `R'`; the characters that would break chemfig's code are left out), beside buttons for the common elements. A label is typed as chemistry is written, as a species is: a number after an element is its index (`CH3` is written `CH_3`), `^` a charge. Alt+arrow, the bar's eight directions, or a drag from an atom (snapped to 30°) draws a bond to a new atom; the arrows move between atoms. The bar changes a bond's kind (single, double, triple, wedge, hashed) and hangs rings (benzene, six, five); Backspace removes an atom. The palette has skeletons with a substituent `R` (rings, chain, carbonyl, acid, ester, alcohol, ether, amine, amide), and the `R` comes picked, ready to type over. Each edit changes only the spot it touches, so the rest of the chemfig code stays as written. (mathra gives the place of each atom and bond: `span` in its tree.)
- **Schemes** (`\schemestart`). Structures, arrows and `\+`: type a structure, a space, `->`, its conditions in `[…]`, then the next structure. The bar picks chemfig's arrow (→ ⇌ ↔ ← ↛) and adds a structure or a `+`; a click on an arrow shows the boxes over and under it.
- **Diagrams** (`tikzcd`, `CD`, `\xymatrix`). Type in a cell. Alt+arrow (Alt+Shift for dashed), or a drag from one cell to another, draws an arrow, and its label is typed in place; a drag past the cells, in any of eight directions (diagonals too), draws it to a new cell one step that way. Backspace in an empty cell takes away its column (or line) when it is empty and no arrow touches it, and in an arrow's empty label the arrow, with the cell made for it. A diagram from the palette comes with its first object picked, to type over; the grid of the Matrices tab gives the diagram the cursor is in its lines and columns. Click an arrow to pick its style (plain, dashed, dotted, hook, two heads, double, equals, maps to, squiggly), bend it, flip its label to the other side, or remove it. An amscd or xymatrix diagram stays in its own syntax while that syntax can say what was drawn.

Each bar also has **Edit as LaTeX**, an escape hatch that opens the piece in a panel under it. The formula follows as you type, and mathra says whether it reads it without a warning. Ctrl/⌘+Enter or "Done" finishes, Esc takes the edit back, and the whole edit is one step of undo. When done, it is read back into boxes. Whatever the editor cannot take apart stays a LaTeX block, as written: `\pu` and siunitx's `\qty`, a scheme with `\chemmove`, a structure built from submolecules. With the cursor beside such a block, a bar says so and opens it; a double click, or Enter beside it, opens it too. In a scheme, only the piece the editor cannot take apart (an arrow with a name or options, a `\ce`, a coefficient) is a block; the rest is edited in pieces. Over and under an arrow, a command with its arguments (`\text{light}`, `$\alpha$`, `\qty{25}{\celsius}`) is one piece, never split by the cursor. `field.run("block:\\pu{‸}")` inserts a block and opens it (`‸` is where its cursor starts); `field.openBlock(atom)` opens one.

`field.editor.smartTyping = false` (or `new Editor().smartTyping = false`) turns them off: each character is then itself, and a word is typed with `\` (`\sqrt`, `\pi`).

`field.keymap = { "Mod+B": "insert:mathbf", "Mod+R": "latex:\\sqrt{#0}", "Mod+Enter": "" }` adds, changes or turns off keys (`Mod` is Ctrl, or ⌘ on a Mac).

## Customizing

**Colors and sizes.** Set any of these on a component or an ancestor; they reach the components inside `<mathra-editor>` too. The defaults follow the page's `color-scheme` (light and dark).

`--mathra-ink` `--mathra-muted` `--mathra-background` `--mathra-surface` `--mathra-page` `--mathra-border` `--mathra-focus` `--mathra-caret` `--mathra-selection` `--mathra-slot` (the empty places) `--mathra-key` `--mathra-key-active` `--mathra-accent` `--mathra-radius` `--mathra-font` `--mathra-mono`, and `--mathra-padding`, `--mathra-align`, `--mathra-button-size`, `--mathra-key-height`, `--mathra-gap`, `--mathra-output-height`, `--mathra-palette-height`, `--mathra-menu-z`. The formula's size follows `font-size`.

**Parts.** `::part(box)`, `caret`, `selection`, `slot`, `placeholder`, `input` of the field; `tab`, `button`, `grid`, `search` of palettes; `key` of the keyboard; `item` of the command menu; `tab`, `action`, `body` of the outputs; `bar`, `action`, `language`, `theme` of the editor's bar. `<mathra-editor>` re-exports them, and has `slot="title"` and `slot="actions"` in its bar and `slot="start"` and `slot="end"` around it for your own content.

**Your own palettes.** A button inserts a snippet of LaTeX, where `#?` is an empty place (a whole argument) and `#0` where the selection goes, or runs an action. mathra draws the button from the same snippet.

```js
import { STRUCTURES } from "@mathlabs/mathra-editor";

toolbar.palettes = [
  STRUCTURES,
  {
    id: "physics",
    title: { en: "Physics", "pt-BR": "Física" },
    items: [
      { insert: "\\vec{F} = m\\vec{a}", title: "Newton" },
      { insert: "\\frac{d#0}{dt}", preview: "\\frac{d#?}{dt}", title: "d/dt", command: "ddt" },
      { action: "addRow", icon: "rowAdd", title: "Add a line" },
    ],
  },
];
```

Palettes that come with the editor (about 400 buttons): `structures`, `calculus`, `matrices`, `greek`, `operators`, `relations`, `arrows`, `sets`, `functions`, `accents`, `geometry`, `physics`, `chemistry`, `statistics` and `formulas` (ready formulas to start from). Each button is checked by `test/palettes.test.ts`: it draws and inserts without a warning, and draws the same marked as plain. A `command` makes the item reachable from the command menu too. The first button of `matrices` (`picker: "matrix"`) opens a grid, as a table is picked in a word processor: the pointer or the arrows choose the lines and columns, a click or Enter inserts the matrix, and a row of buttons picks its delimiters. With the cursor in a matrix, the grid starts at its size and gives it the size chosen (cells that would lose something are marked); in code, `field.editor.shapeMatrix(rows, cols, env?)`. The keyboard takes layers the same way (`keyboard.layers = [...]`, keys with `type`, `insert`, `action` or `layer`).

**Actions.** `field.run(action)` does what a key or a button does: `moveLeft` `moveRight` `moveUp` `moveDown` `selectLeft` `selectRight` `home` `end` `selectAll` `backspace` `deleteForward` `enter` `tab` `tabBack` `undo` `redo` `clear` `addRow` `addRowAbove` `addColumn` `addColumnLeft` `removeRow` `removeColumn` `sup` `sub`, or `insert:<template>`, `latex:<snippet>`, `type:<text>`, `symbol:<latex>`.

**mathra's options.** `field.mathraOptions = { font: await loadFontFromCatalog("fira-math") }` draws the formula in another font (anything `render` takes, except `locale` and `display`, which the field sets).

**Without a screen.** `@mathlabs/mathra-editor/core` is the editor alone, for an interface of your own:

```js
import { Editor } from "@mathlabs/mathra-editor/core";

const e = new Editor("x = ");
e.insert("frac");
e.typeText("1");
e.moveDown();
e.typeText("2");
e.toLatex(); // "x=\\frac{1}{2}"
```

`toLatex({ marked: true })` is what the field draws: each atom and place marked with `\htmlData{m=<id>}`, so `render(…).boxes` tells where each sits; `caretRect`, `selectionRect` and `cursorAt` turn those boxes into a cursor, a selection and a click.

## How it works

1. The editor keeps a tree of rows and atoms. It reads LaTeX with its own reader. The physics package's matrices (`\pmqty`, `\bmqty`, `\vmqty`, `\mdet`) and `array` (its columns and `\hline` kept) are matrices; commands whose arguments are math (`\pdv`, `\dv`, `\dd`, `\ket`, `\braket`, `\expval`, `\mel`, `\comm`, `\abs`, `\norm`, `\vb`, `\slashed`, `\symbf`, `\xrightarrow[…]{…}`) have each argument as a place, typed with `\` too (`\pdv` makes its two). What it does not take apart (an unknown command with its arguments, an environment it does not know) stays as written, drawn as is, moved and deleted whole.
2. It writes the tree as LaTeX with marks: `\htmlData{m=n7}{b}`, `\mathbin{\htmlData{m=n8}{-}}` (a marked operator keeps its class through `\mathbin`, `\mathrel`…). Where the locale rewrites a number (`3.14` is `3,14` in pt-BR) the number is one mark, and the cursor between its digits is placed by their width.
3. mathra draws that LaTeX and returns, with the SVG, the box of every marked group in the SVG's coordinates.
4. The cursor goes at the edge of the atom beside it; a click goes to the innermost place whose box holds it.

Marking moves nothing: for 48 formulas, in English and in pt-BR, the marked LaTeX draws exactly what the plain one draws, each formula read and written back draws what it drew, and the cursor sits in its row at every place (`test/corpus.test.ts`).

Every example of mathra's gallery (110 in LaTeX) opens in the editor and draws as it did, read and written back and marked (`test/gallery.test.ts`). Getting there: cells of an alignment are not wrapped (`&= …` keeps the relation's spacing) and an empty one is an invisible place; LaTeX kept as written, and commands the editor does not know (`\pdv`, `\vdot`), are marked with the class mathra reads them into (the field asks it); commands that act on the alignment (`\Aboxed`, `\MoveEqLeft`) stay unmarked; a chemfig scheme with its `\chemmove` is one block; every reaction, structure and scheme of the gallery reads into pieces and draws as written (`test/reactions.test.ts`, `test/structures.test.ts`, `test/schemes.test.ts`).

**Limits.** A brace group the reader takes apart loses TeX's grouping (`{x}^2` reads as `x^2`, which may move an exponent by an italic correction). `\color{c}` colors to the end of its group, as mathra draws it. Typing `^` inside an index makes an exponent of the index, as in other editors: the right arrow leaves the index first.

## Develop

```sh
npm/build.sh                       # from the repository root: mathra's package, with `boxes`
cd editor && pnpm install
pnpm test                          # the editor, the corpus, every palette button and the gallery, in Node (22.18+ runs the TypeScript)
node scripts/gallery.mjs           # src/gallery.ts again, after corpus/gallery.json changed
pnpm build                         # dist/
pnpm test:browser                  # the components in Chromium (playwright-core's browser)
pnpm coverage                      # both together, over src/: every line and function must run (CI asks for 100%)
pnpm demo                          # http://127.0.0.1:4520/editor/demo/ (the editor filling the page)
```
