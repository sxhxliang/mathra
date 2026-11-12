// The Markdown preview's math, drawn by mathra: a markdown-it plugin. `$…$`, `\(…\)` inline; `$$…$$`,
// `\[…\]` and LaTeX's display environments in a paragraph or as blocks of their own; ```math blocks.

import type MarkdownIt from "markdown-it";
import { spanAt } from "./find.ts";

export interface MathOptions {
  /** Whether mathra draws the math of this render; when not, the preview's own rules take it. */
  enabled: () => boolean;
  /** The HTML of an equation. */
  html: (tex: string, display: boolean) => string;
}

/** The line `line` of a block, without its indentation. */
function lineText(state: { src: string; bMarks: number[]; tShift: number[]; eMarks: number[] }, line: number): string {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
}

export function mathPlugin(md: MarkdownIt, options: MathOptions): void {
  md.inline.ruler.before("escape", "mathra", (state, silent) => {
    const c = state.src[state.pos];
    if ((c !== "$" && c !== "\\") || !options.enabled()) return false;
    // never past the end of the text this rule is given (a link's label, inside its paragraph)
    const span = spanAt(state.src.slice(0, state.posMax), state.pos, "markdown");
    if (!span) return false;
    if (!silent) {
      const token = state.push("mathra", "", 0);
      token.content = span.tex;
      token.meta = { display: span.display };
    }
    state.pos = span.end;
    return true;
  });

  // `$$` opening a line, closed by a line ending in `$$`: a block, blank lines and all
  md.block.ruler.before(
    "fence",
    "mathra_block",
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4 || !options.enabled()) return false;
      const first = lineText(state, startLine).trimEnd();
      if (!first.startsWith("$$")) return false;
      let last = startLine;
      let tex: string;
      if (first.length > 4 && first.endsWith("$$") && !first.slice(2, -2).includes("$$")) {
        tex = first.slice(2, -2);
      } else if (first === "$$" || !first.slice(2).includes("$$")) {
        const lines = [first.slice(2)];
        for (last = startLine + 1; last < endLine; last++) {
          const text = lineText(state, last).trimEnd();
          if (text.endsWith("$$")) break;
          lines.push(text);
        }
        if (last >= endLine) return false;
        lines.push(lineText(state, last).trimEnd().slice(0, -2));
        tex = lines.join("\n");
      } else {
        return false;
      }
      if (!tex.trim()) return false;
      if (!silent) {
        const token = state.push("mathra_block", "div", 0);
        token.block = true;
        token.content = tex;
        token.map = [startLine, last + 1];
      }
      state.line = last + 1;
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] },
  );

  md.renderer.rules.mathra = (tokens, idx) => options.html(tokens[idx].content, tokens[idx].meta.display);
  md.renderer.rules.mathra_block = (tokens, idx, _options, _env, self) =>
    `<div class="mathra-block"${self.renderAttrs(tokens[idx])}>${options.html(tokens[idx].content, true)}</div>\n`;

  // ```math: the fence's renderer, unless the block is math and mathra draws it
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() !== "math" || !options.enabled()) return fence(tokens, idx, opts, env, self);
    return `<div class="mathra-block"${self.renderAttrs(token)}>${options.html(token.content, true)}</div>\n`;
  };
}
