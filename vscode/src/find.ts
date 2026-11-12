// Where the math of a Markdown or LaTeX document is: `$…$`, `$$…$$`, `\(…\)`, `\[…\]`, the display
// environments of LaTeX and, in Markdown, ```math blocks. No editor API here, only text and offsets.

export type Language = "markdown" | "latex";

/** A piece of math in a text: `start` and `end` take the delimiters in, `tex` is what mathra draws. */
export interface MathSpan {
  start: number;
  end: number;
  tex: string;
  display: boolean;
}

// The environments drawn whole, `\begin` and `\end` included: mathra reads them as LaTeX does.
const ENVIRONMENTS = new Set(
  ["equation", "align", "gather", "multline", "eqnarray", "flalign", "alignat"].flatMap((e) => [e, `${e}*`]),
);

/** Where `close` starts at or after `from`, skipping what a backslash escapes; -1 when it never does. */
function findClose(text: string, from: number, close: string): number {
  for (let i = from; i < text.length; i += text[i] === "\\" ? 2 : 1) {
    if (text.startsWith(close, i)) return i;
  }
  return -1;
}

function between(text: string, start: number, open: string, close: string, display: boolean): MathSpan | undefined {
  const at = findClose(text, start + open.length, close);
  if (at < 0) return undefined;
  const tex = text.slice(start + open.length, at);
  return tex.trim() ? { start, end: at + close.length, tex, display } : undefined;
}

/** The math that starts at `i`, where `text[i]` is `\` or `$`; undefined when nothing does. */
export function spanAt(text: string, i: number, language: Language): MathSpan | undefined {
  if (text.startsWith("\\[", i)) return between(text, i, "\\[", "\\]", true);
  if (text.startsWith("\\(", i)) return between(text, i, "\\(", "\\)", false);
  const env = /^\\begin\{([a-z]+\*?)\}/.exec(text.slice(i, i + 40));
  if (env && ENVIRONMENTS.has(env[1])) {
    const end = `\\end{${env[1]}}`;
    const at = text.indexOf(end, i + env[0].length);
    return at < 0 ? undefined : { start: i, end: at + end.length, tex: text.slice(i, at + end.length), display: true };
  }
  if (text.startsWith("$$", i)) return between(text, i, "$$", "$$", true);
  if (text[i] !== "$") return undefined;
  // `$…$` as Pandoc reads it: no space inside the dollars, no blank line, no digit right after (`$5 and $6`)
  const span = between(text, i, "$", "$", false);
  if (!span) return undefined;
  const after = text[span.end] ?? "";
  if (/^\s|\s$/.test(span.tex) || /\n\s*\n/.test(span.tex) || (language === "markdown" && /\d/.test(after))) return undefined;
  return span;
}

/** Where the line holding `i` ends (its `\n`, or the end of the text). */
function lineEnd(text: string, i: number): number {
  const at = text.indexOf("\n", i);
  return at < 0 ? text.length : at;
}

/** Markdown code at `i`, where a run of backticks starts: a fence (with a ```math block noted) or inline code. Returns where scanning goes on. */
function skipCode(text: string, i: number, spans: MathSpan[]): number {
  const n = /^`+/.exec(text.slice(i))![0].length;
  const lineStart = text.lastIndexOf("\n", i - 1) + 1;
  if (n >= 3 && /^ {0,3}$/.test(text.slice(lineStart, i))) {
    const eol = lineEnd(text, i);
    const info = text.slice(i + n, eol).trim();
    const fence = new RegExp(`^ {0,3}\`{${n},}\\s*$`);
    let at = eol + 1;
    let contentEnd = text.length;
    let end = text.length;
    while (at < text.length) {
      const next = lineEnd(text, at);
      if (fence.test(text.slice(at, next))) {
        contentEnd = at;
        end = next;
        break;
      }
      at = next + 1;
    }
    const tex = text.slice(Math.min(eol + 1, contentEnd), contentEnd);
    if (info === "math" && tex.trim()) spans.push({ start: i, end, tex, display: true });
    return end;
  }
  const close = new RegExp(`(?<!\`)\`{${n}}(?!\`)`, "g");
  close.lastIndex = i + n;
  const m = close.exec(text);
  return m ? m.index + n : i + n;
}

/** Every piece of math of a document, in order. */
export function mathSpans(text: string, language: Language): MathSpan[] {
  const spans: MathSpan[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "`" && language === "markdown") {
      i = skipCode(text, i, spans);
    } else if (c === "%" && language === "latex") {
      i = lineEnd(text, i);
    } else if (c === "\\" || c === "$") {
      const span = spanAt(text, i, language);
      if (span) spans.push(span);
      // a backslash not opening math escapes what follows it (`\$`, `\\`)
      i = span ? span.end : c === "\\" || text.startsWith("$$", i) ? i + 2 : i + 1;
    } else {
      i++;
    }
  }
  return spans;
}

/** The math around `offset` (delimiters included), if any. */
export function mathAt(text: string, offset: number, language: Language): MathSpan | undefined {
  return mathSpans(text, language).find((s) => s.start <= offset && offset <= s.end);
}

/** Where a span's LaTeX is in `text`, without the spaces around it: what an edit replaces. */
export function inner(text: string, span: MathSpan): { tex: string; start: number } {
  const tex = span.tex.trim();
  return { tex, start: span.start + text.slice(span.start, span.end).indexOf(span.tex) + span.tex.indexOf(tex) };
}

/** What a selection means: its one piece of math when it holds just that (delimiters and all), or else the selection itself as display math. `texStart` is where the LaTeX starts in the selection. */
export function mathIn(selection: string, language: Language): { tex: string; display: boolean; texStart: number } | undefined {
  const trimmed = selection.trim();
  if (!trimmed) return undefined;
  const lead = selection.indexOf(trimmed);
  const spans = mathSpans(trimmed, language);
  if (spans.length === 1 && spans[0].start === 0 && spans[0].end === trimmed.length) {
    const { tex, start } = inner(trimmed, spans[0]);
    return { tex, display: spans[0].display, texStart: lead + start };
  }
  return { tex: trimmed, display: true, texStart: lead };
}
