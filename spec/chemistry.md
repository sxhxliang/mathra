# Structural chemistry (L-CHE-2)

With the `chem` feature (on by default), mathra reads chemfig: structures, reaction schemes and mechanism arrows, inside any equation. Why this is inside the boundary is in `boundary.md`; the code is in `crates/core/src/chem`, the tests in `crates/core/tests/chemfig.rs`. A one-line formula (`\ce{H2SO4}`) is still mhchem (L-CHE-1), and a scheme hands its formulas and every label to the rest of mathra.

The whole construction becomes one node of the tree, `chemistry`, holding a scheme: compounds (a structure, or math), plus signs, arrows, and mechanism arrows between hooked atoms. A structure is a graph: atoms with their labels split into pieces, bonds with their kind and chemfig's direction, rings.

## Input

The reader takes, as written: `\chemfig[options]{…}`, `\schemestart … \schemestop`, `\chemname[dim]{…}{name}` (and `\chemname*`), and the `\chemmove{…}` right after any of them.

### chemfig bodies


| Construction | Reading |
|---|---|
| `H_3C`, `NH_3^+`, `O\ominus`, `{CH_3}` | an atom label, split into pieces at each capital letter (`H_3C` → `H_3`, `C`); braces keep a piece whole; a script takes the next character even if it is a bond sign (`^-`), but not a `(` or `)` (a script left empty is E-REC-7; a `)` with no `(` counts nothing) |
| `-` `=` `~` | single, double, triple bond |
| `=^` `=_` | offset double bond: one line on the bond, the other on its left (`=^`) or right (`=_`), going the way it is drawn |
| `>` `<` · `>:` `<:` · `>|` `<|` | wedge, hashed wedge, hollow wedge; `>` is wide at the end, `<` at the start |
| `-[a,len,dep,arr,tikz]` | `a`: `n` × 45°, `:x` absolute, `::x` relative to the previous bond, empty keeps the previous direction; `len` a length factor; `dep`, `arr` the pieces (from 1) the bond leaves from and arrives at; `tikz`: `draw=none` hides the bond, `dash…`/`dotted` dashes it |
| `(…)` | a branch from the current atom; on a ring vertex its first bond points outward |
| `([a,len,dep,arr,tikz]…)` | a branch with defaults of its own (chemfig manual, section 2.6), valid in all of it and in its own branches, as the structure's are; a field left empty keeps the enclosing one's, and `::x` is relative to the bond that reached the atom: `B([:60]-D-E)`, `([::-30,1.5]-X-Y)` |
| `-#(d1,d2)` | chemfig manual, section 2.2, right after the bond sign (also `\#` or `\CFhash`): the space between the bond and the letters at its start and at its end (C-LAY-4); an empty field or a missing `d2` keeps the standard space |
| `*n(…)`, `**n(…)` | a ring of n sides (3 to 40), with a circle for `**`; it may list fewer bonds than sides |
| `**[a1,a2,tikz]n(…)` | chemfig manual, section 3.2: the circle only from `a1` to `a2` degrees, absolute and counterclockwise (0 and 360 by default); dashed or dotted when the TikZ options say so (C-LAY-5) |
| a ring at a ring vertex | fused: it lies outside and shares the parent's next side, coming back along it |
| `[a,len,dep,arr,tikz]` at the start | the structure's defaults (chemfig manual, section 2.6): every bond whose field is empty takes them; with a default angle, an empty angle is that angle (in a branch from a ring vertex, the vertex's outward direction) instead of the previous bond's |
| `?`, `?[name]`, `?[name,link,tikz]` | chemfig manual, section 2.8: the first mark of a name is the hook, each later mark of the name draws a bond to it, with the link it gives (a number 1–9 or the bond's characters in braces, `{=}`, `{>}`) and its TikZ options; a mark belongs to the piece it follows, or at the start of a group to its first piece (`-?[a]B`); a lone mark draws nothing |
| `\lewis{0:2.4|6o,X}` | label X with marks: direction digit 0–7, then `:` pair (default), `.` radical, `|` line, `o` vacancy |
| `\chemabove{X}{c}`, `\chembelow{X}{c}` | X with c above or below |
| `\charge{[params]pos[tikz]=c,…}{X}`, `\Charge` | chemfig manual, section 5.8: X with each c around it (C-LAY-9); `pos` is degrees or a TikZ anchor (`north east`) with an optional `:offset`; c is a Lewis shortcut (`\.` radical, `\:` pair, `\|` line, `\"` vacancy) or LaTeX text (`$\oplus$`), and a ⊕, ⊖, `+` or `-` counts in the formula's charge; of the parameters only `extra sep` and the TikZ `anchor` are kept. Outside `\chemfig`, a structure of one atom |
| `\chemskipalign` | chemfig manual, section 5.4.3: the group's baseline on the bonds' line (C-LAY-8); outside a structure, nothing |
| `@{name}` | before an atom: the hook a mechanism arrow points at |
| `-[@{name,coeff}…]` | chemfig manual, section 5.8.1, at the start of a bond's first field (the angle follows it, with or without a comma): a node on the bond, `coeff` of the way along it (0.5 by default), that a mechanism arrow can point at; the speech reads it as the bond between its two atoms |
| `\definesubmol{name}n[code1]{code2}`, `!{name}`, `!\name`, `!x` | chemfig manual, section 9: the code a submolecule stands for, read in its place wherever it is called, with `#1`…`#n` its arguments (any other `#` is drawn, or is a bond's `#(…)`); with `code1`, that one when the bond reaching it comes from the right (drawn leftward). An unknown name warns (E-REC-1) and is written as it is; one that calls itself stops after 200 expansions |

### Schemes

| Construction | Reading |
|---|---|
| `\schemestart[key=value,…] … \schemestop` | markers, optional. Of the options (chemfig manual, section 6.1), `arrow angle` and `arrow coeff` set the arrows that give no angle or length; the others (`arrow style`, `init anchor`, `compound sep`…) are ignored, as `\chemfig`'s options are |
| `\chemfig[opts]{…}` | a structure; the options are ignored |
| `\ce{…}`, `$…$`, loose text | a formula or math, typeset by mathra (loose text goes through `\ce`) |
| `\+` | a plus sign; its spacing arguments are ignored |
| `\chemname{X}{name}`, `\chemname*`, `\chemname[dim]` | X with its name below |
| `\subscheme{…}` | its items, in place; outside a scheme, a scheme of its own |
| `\chemleft<d>…\chemright<d>`, `\chemup<d>…\chemdown<d>` | chemfig manual, section 6.8: the material between them is one compound, drawn by the LaTeX reader: `\left<d>…\right<d>`, and for `\chemup` the delimiters over and under it (`[` `]` a bracket, `(` `)` a parenthesis, `\{` `\}` a brace, `.` none). A `\chemdown` (or `\chemright`) alone is ignored with a warning (E-REC-9), as chemfig does |
| `\merge>[above][below](n1.a1)(n2)…--(n[style])[c1,c2,c,style]` | chemfig manual, section 6.11: lines from the compounds named to a junction line, and an arrow from it to the next compound (C-SCH-6). The direction is `>` (the default), `<`, `^` or `v`; a compound is named as `\arrow(a--b)` names it or by chemfig's own name `ck` (the k-th compound, what `\+` joins counted as one, section 6.12, and a `\subscheme`'s box taking a number before the compounds in it, section 6.8); an anchor is an angle (`(c1.120)`). A style, a label's rotation (`*{angle.anchor}`), a name no compound has, warn (E-REC-9; refused in strict mode). Outside a scheme, where chemfig does not define it, it is left out with its arguments (E-REC-1) |
| `\arrow(a--b)`, `\arrow(@a--b)`, `\arrow(@a--@b)` | chemfig manual, sections 6.4 to 6.7: names the compound before the arrow `a` and the one after it `b`; `@a` makes the arrow leave from the compound named `a` (a branch), and `@b` makes it end at a compound already placed, straight from border to border. A named anchor (`.mid east`) is left to mathra, whose arrows meet the border facing them; a compound's style (`[fill=red]`, `[yshift=5mm]`) warns (E-REC-9) |
| `\arrow{type[above][below]}[angle,length]` | a reaction arrow; types `->` `<-` `<=>` `<->>` `<<->` `<->` `=>` `-/>` `0`, and `-U>[above][below][shift][radius][half angle]` (C-SCH-5); labels are LaTeX text with `$…$` and `\ce{…}`, or a `\chemfig{…}` drawn |
| `\chemmove[opts]{\draw[opts] (a)..controls +(θ:l) and +(θ:l)..(b); …}` | curved arrows between hooks; also `to[out=θ,in=θ]` and `to[bend left=θ]`; `-left to`, `harpoon`, `half`, `fishhook` make a one-electron arrow; lengths in cm, mm, pt, bp, in, ex, em |

## Reading

A structure is read by its molecular formula (C-FOR-1) and its rings (C-FOR-2), with its charge; a name given with `\chemname` comes first. A scheme is read in order: compounds, "plus", and each arrow by its meaning ("reacts to give", "in equilibrium with", "in resonance with", "is made from", "does not react to give"…) with its conditions in parentheses. A mechanism arrow is read as "curved arrow: an electron pair moves from X to Y", by the hooked atoms' labels. The phrases are `chem.*` in every locale file.

The linear text writes each structure by its formula (`C₆H₆`), the arrows by their sign with the labels in brackets. Braille transcribes the same row: formulas, `+`, arrows with their labels.


## Formula

### C-FOR-1 · Molecular formula from the graph

A vertex without a label is a carbon, with 4 minus the orders of its bonds in hydrogens (a dashed or invisible bond counts 0). A vertex of a ring drawn aromatic (`**n`) shares half of the delocalized bond on each side, so it counts one more. A label counts what it writes: element symbols (the 118 and D, T), subscripts, parentheses with a count (`(CH_2)_3`), charges (`^+`, `^{2-}`, `\oplus`, `\ominus`). Group abbreviations count as what they stand for and take precedence over the element they look like: Me, Et, Pr, iPr, Bu, tBu, Ph, Bn, Ac, Bz, Ts, Ms, Tf, Boc, Cbz, TMS. Anything else (R, R′, X, Nu) is kept as written. The formula is written in Hill order: C, H, then alphabetically; without carbon, all alphabetically.

### C-FOR-2 · Aromatic rings in the speech

A ring is read as aromatic when it is drawn with its circle, or when it is a six-membered ring whose atoms each carry exactly one double bond (a Kekulé drawing), or a five-membered ring like that except for one N, O or S.

## Layout

Everything is drawn at text size, 1000 units per em, with the items every equation uses (strokes, ellipses, glyphs: a curve is sampled into short strokes, a filled wedge is a fan of strokes); the drawing is then centered on the math axis and scaled to the style it sits in. C-FOR-1 is checked against known formulas in `crates/core/tests/chemfig.rs`; the layout rules by the README gallery (`crates/core/tests/examples.rs`).

### C-LAY-1 · Bond length

A standard bond is 2.2 em of the label type. chemfig's default is 3 em, which spreads structures wider than journals do; the ACS style is 1.44 em, which crowds the labels mathra sets at text size.

### C-LAY-2 · Strokes

Strokes are 0.055 em wide with round ends. The second line of a double bond is 0.22 em from the first; the lines of a triple bond, 0.2 em apart. A wedge is 0.22 em wide at its wide end; a hashed wedge has a line every 0.13 em.

### C-LAY-3 · Positions

The first atom is at the origin. Each other atom is placed by the first bond that reaches it: from the piece of the label it leaves from, in the bond's direction, one bond length times the bond's length factor. A bond that reaches an atom already placed (a ring closing, a `?` bond) is drawn between the two.

### C-LAY-4 · Labels

A label is typeset by mathra in upright type, piece by piece, and placed so that the middle of the piece the bond arrives at sits on the atom's position. A bond leaves a label from its last piece going right, its first going left, and its first non-hydrogen piece going vertically; it arrives at the first piece from the left, the last from the right, the first non-hydrogen piece vertically (so `H_3C` above a ring attaches at C). A bond stops 0.09 em from the letters of the piece it touches. A bond's `#(d1,d2)` sets that space at its start and at its end instead.

### C-LAY-5 · Aromatic circle

The circle of an aromatic ring is centered on the ring's atoms, with a radius of 0.6 of its inner radius. With `**[a1,a2,…]`, only the arc from `a1` to `a2` is drawn; a dashed one has dashes of 0.12 em and gaps of 0.09 em, as a dashed bond.

### C-LAY-6 · Double bonds

In a ring, the second line of a double bond goes inside the ring and is shortened at both ends by 16% of the bond (at most 0.4 em). Elsewhere the two lines are centered on the bond. An offset double bond (`=^`, `=_`) keeps one line on the bond and puts the shortened second line on the side it names, in a ring or not: `*6(-=_-=_-=_)` has its double bonds outside the ring, as in chemfig.

### C-LAY-7 · Lewis marks

A Lewis mark sits in its direction (0 to 7, steps of 45°), 0.17 em beyond the letters of the atom's piece (0.08 em more above and below): two dots 0.18 em apart for a pair, one dot for a radical, a 0.3 em line for a pair line, a small square for a vacancy.

### C-LAY-8 · `\chemskipalign`

A label with `\chemskipalign` has its baseline on the atom's position, the line its bonds come in on, instead of the middle of its letters; bonds stop at the letters' own height and depth.

### C-LAY-9 · Charges

A `\charge` is placed as chemfig places it: the box of its piece (its letters' width, height and depth) is grown by `extra sep`, 1.5 pt (0.15 em); the point at the charge's angle on that box's border, moved `offset` further out along the angle, is where the content's center goes, or, with `anchor=α`, the point of the content's border at α (`anchor=180+\chargeangle` sets the content just outside). A Lewis shortcut is the mark of C-LAY-7 centered there; text is typeset by mathra. An empty atom has a box of no size at its vertex.

## Schemes

### C-SCH-1 · Compounds along the arrows

The first compound is centered on the origin. A compound after an arrow is placed in the arrow's direction: the arrow leaves the previous compound's box 0.45 em away, runs its length (2.6 em, or the widest label plus 1 em, times its length factor), and the next compound's box starts 0.45 em beyond. After `+`, the sign follows the previous compound 0.35 em away and the next compound follows it; compounds side by side share their vertical middle.

### C-SCH-2 · Arrows

`->` a shaft and a head; `<-` the head at the start; `<->` a head at each end; `<=>` two harpoons 0.15 em apart, the upper one forward with its barb up, the lower one back with its barb down; `<->>` and `<<->` the same with the weaker direction 22% shorter at each end; `=>` an open double arrow; `-/>` a forward arrow crossed in the middle; `0` nothing. Heads are two curved barbs, 0.3 em long and 0.14 em to each side.

### C-SCH-3 · Arrow labels

The label above an arrow goes on its left side, looking along it, and the label below on its right side, 0.24 em from the shaft, centered on the arrow's middle. For a horizontal arrow, above is above. A structure as a label is drawn at 0.85 of its size.

### C-SCH-5 · The `-U>` arrow

As chemfig's `\definearrow` of `-U>` draws it (manual, sections 6.2 and 6.9): a forward arrow, and a circle of radius `radius` × the arrow's length (0.333 by default; negative, on the other side) touching the arrow at its middle on its left. From that point an arc turns back by the half angle (60° by default) toward the label above, drawn only when that label is given, and another turns forward toward the label below, drawn only when it is given and ending in a head. Each label sits beyond its end of the arc, 0.3 em away, on the arc's side. The arrow is long enough (at least 2.6 em) that the ends of the arc are half the labels' widths plus 0.3 em apart. It is read as a forward arrow with its labels.

### C-SCH-6 · `\merge`

As chemfig's `\CF_merge` draws it (manual, section 6.11). Each compound joined (what `\+` joins together counts as one) has an anchor on its box: the point where the direction, or the angle given, leaves it. The junction line stands across the direction, `c1` × the space between compounds beyond the farthest anchor, and spans the anchors; a line goes from each anchor, 0.45 em out, straight along the direction to it. The arrow leaves the junction line at `c` along it (0 its top end, or its left end for `^` and `v`), runs `c2` × the space between compounds less 0.45 em, and the next compound's box starts 0.45 em beyond. The space between compounds is mathra's: an arrow (2.6 em) and 0.45 em on each side (chemfig's `compound sep` is 5 em with arrows 0.4 em short of each box). `c1`, `c2` and `c` are 0.5 by default. The labels go on the arrow as C-SCH-3 says; it is read as a forward arrow with them.

### C-SCH-4 · Mechanism arrows

A curved arrow goes from one hooked atom to another, as a cubic Bézier: it leaves in its `out` direction (TikZ's first control point, or `out=`), arrives from its `in` direction, and each control point reaches the length given (or 0.45 of the distance between the atoms). Without directions it bends 45° to the left (`bend left`, or the angle given). It starts and ends 0.12 em beyond the atoms' letters; a fishhook has one barb.

## mhchem: words and formulas (L-CHE-1)

`\ce{Hydrogen + Oxygen -> Water}` and `\ce{sodium chloride -> sodium + chlorine}` are text, `\ce{NaOH}` and `\ce{CO}` formulas. The rules come from mhchem's own parser, mhchemParser 4.2.1 (by mhchem's author; MathJax and KaTeX use it), read in its source:

- mhchem has no test that tells a word from a formula. In the `ce` state machine, the pattern `letters` (`[a-zA-Z]` and Greek letters, repeated) takes a whole run of letters into the formula's body, and the `o` machine writes that run with the action `rm`, `\mathrm{…}`: `Hydrogen` and `NaOH` are both upright letters, as written, never split into elements. So the drawing of a word and of a formula is the same, and mathra's only decision is how the tree keeps it.
- Two entities written apart, with no operator or arrow between them, are separated by `entitySkip`, which mhchem writes as `~`, a word space: in the `ce` machine, a space after a formula sets `sb=true` and the next formula's `output` begins with `entitySkip`. A space after an operator or an arrow resets it (`sb=false`), a space after a coefficient is the coefficient's own `\,`, and a state of aggregation is not an entity.
- The pattern `state of aggregation $`: a parenthesis with one to three lowercase letters, followed by `)` or `,`, up to the closing parenthesis, at the end or before a space or `,;)]}`. `(aq,$\infty$)` is one state, drawn upright with its math inside.

mathra reads a token of `\ce` (up to a space) as a word when it is made of two or more letters, either all lowercase (`heat`, `sodium`) or a capital followed by lowercase letters that is not an element symbol (`Water`, `Hydrogen`, `Água`; `Co`, `He` and `Na` are elements). A word is one text node: drawn upright, read as the word it is (not spelled, not read as elements), written as is in the linear text and in braille. Two formulas or words written apart get a word space of 0.333 em (`sodium chloride`, `NaCl solution`, `Iron(III) oxide`); a coefficient keeps its small space, and operators, arrows, bonds and states their own. A run of capitals (`DNA`) is still a formula: mhchem draws it the same, and nothing in it tells an acronym from elements.

More of mhchem, read from its parser and mhchem.sty:

- **The dashed bond and the bonds of more than one kind of line** (#267). mhchem.sty's `\mhchem@bond` table builds them from overlapped lines: `\bond{~}` is its `\tripledash` alone, three dashes on the middle line (it was ∼ before), `\bond{~-}` a dashed line 0.1 em over a line 0.1 em under, `\bond{~=}` and its spelling `\bond{~--}` a dashed line over two, `\bond{-~-}` a dashed line between two (three lines 0.2 em apart), each dashed line its `\tripledash`, three dashes. `\bond{....}` is four `\cdot`. Unicode has no character for these, so they are symbols drawn by composition (`crate::composite`): the lines at the width and thickness of the font's −, the dots the font's ⋅. The speech says what is drawn ("bond of a dashed line over a line"); the linear text writes the closest character (┄, ≃, ≅, ≋, ····); the tree's JSON names each by its `\bond{…}`.
- **An arrow label between braces is text** (#268): `->[{text above}][{text below}]` puts the words over and under the arrow as written, spaces and all, with any `$…$` in them as math. Without braces, the label is read as `\ce`.
- **`$…$` in a subscript or a superscript is math** (#269), mhchem's escape to math as anywhere else in `\ce`: `Fe(CN)_{$\frac{6}{2}$}`, `X^{$n+$}`.
- **`&` and `\\` belong to the alignment around `\ce`** (#270), as mhchem passes them on: `\ce{A &<=> B \\ B &<=> C}` in `align` is two rows, each cell a `\ce` of its own. An `&` outside braces and `$…$` counts; `\&` is a character.

## Not yet

- SMILES input, with automatic 2D coordinates (rings first, then chains), so structures can come from databases
- schemes on several rows, and the box of a `\subscheme` as a compound of its own (its name stands for no compound, and an arrow leaves from the compound before it)
- the bond attachment and the charge placement chemists tune by hand (`\chemabove` is read, chemfig's `[,,,,]` atom choice too, but labels like `HO^-` with Lewis marks put the charge where mathra puts a superscript)
