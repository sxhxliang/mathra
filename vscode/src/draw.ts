// mathra's outputs as the editor shows them: HTML for the Markdown preview, Markdown for a hover, and
// the locale a setting names. No editor API here.

import { locales, render, type Result } from "@mathlabs/mathra";

/** The locale mathra writes in: the setting's, or with "auto" the closest to the editor's language (`pt-br` → `pt-BR`), English if none is close. */
export function resolveLocale(setting: string, uiLanguage: string): string {
  const wanted = (setting === "auto" ? uiLanguage : setting).toLowerCase();
  const base = wanted.split("-")[0];
  const codes = locales().map((l) => l.code);
  return (
    codes.find((c) => c.toLowerCase() === wanted) ??
    codes.find((c) => c.toLowerCase() === base) ??
    codes.find((c) => c.toLowerCase().split("-")[0] === base) ??
    "en"
  );
}

/** Every output of mathra for an equation, or the reason it could not read it. */
export function draw(tex: string, display: boolean, locale: string): Result | Error {
  try {
    return render(tex, { locale, display });
  } catch (e) {
    // the package throws an Error with what it could not read
    return e as Error;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** The equation in the preview: its SVG, in the color of the text around it; what mathra cannot read stays as written, marked. */
export function toHtml(tex: string, display: boolean, locale: string): string {
  const drawn = draw(tex, display, locale);
  const kind = display ? "display" : "inline";
  if (drawn instanceof Error) {
    return `<code class="mathra-error" title="${escapeHtml(`mathra: ${drawn.message}`)}">${escapeHtml(tex)}</code>`;
  }
  const style = display ? ' style="display:block;text-align:center;margin:1em 0;overflow-x:auto"' : "";
  return `<span class="mathra mathra-${kind}"${style}>${drawn.svg}</span>`;
}

/** The SVG as an image of its own, drawn in `color` (an image does not take the color of the page) at `px` pixels to the em. */
export function asImage(svg: string, color: string, px: number): string {
  const root = svg.slice(0, svg.indexOf(">"));
  const at = root.indexOf(' style="');
  // the inline style of the root wins over the `svg:root { color }` the SVG carries
  return at < 0
    ? svg.replace("<svg ", `<svg style="color:${color};font-size:${px}px" `)
    : `${svg.slice(0, at + 8)}color:${color};font-size:${px}px;${svg.slice(at + 8)}`;
}

export function dataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeMarkdown(s: string): string {
  return s.replace(/[\\`*_{}[\]()<>#+\-.!|~]/g, "\\$&");
}

/** The LaTeX as a code block, fenced past any backticks it holds. */
function latexBlock(tex: string): string {
  const longest = Math.max(0, ...(tex.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}latex\n${tex}\n${fence}`;
}

/**
 * The hover's first part: the equation drawn, over its LaTeX. VS Code's copy button on a hover part
 * copies the part's visible text, and here the only text is the LaTeX: the button copies the source.
 */
export function hoverEquation(tex: string, display: boolean, locale: string, color: string): string {
  const drawn = draw(tex, display, locale);
  const head = drawn instanceof Error ? `**mathra:** ${escapeMarkdown(drawn.message)}` : `![${escapeMarkdown(drawn.speech)}](${dataUri(asImage(drawn.svg, color, 20))})`;
  return `${head}\n\n${latexBlock(tex.trim())}`;
}

/** The hover's second part: what a screen reader says, what mathra worked around, and `links`; nothing when mathra cannot read the equation. */
export function hoverDetails(tex: string, display: boolean, locale: string, links: string): string | undefined {
  const drawn = draw(tex, display, locale);
  if (drawn instanceof Error) return undefined;
  const lines = [`$(unmute) *${escapeMarkdown(drawn.speech)}*`];
  for (const w of drawn.warnings) lines.push("", `$(warning) \`${w.rule}\` ${escapeMarkdown(w.description)}`);
  lines.push("", links);
  return lines.join("\n");
}

/** What mathra did with an equation, as `mathra --explain` writes it: the outputs, the tree, the rules that acted and the warnings. */
export function explain(tex: string, locale: string, r: Result): string {
  const rules = (list: Result["applied"]) => list.map((a) => `  ${a.rule.padEnd(9)} ${a.description}\n`).join("");
  let s = `input    ${tex}\nlocale   ${locale}\ntext     ${r.text}\nspeech   ${r.speech}\nbraille  ${r.braille} (${r.braille_code})\ntree     ${JSON.stringify(r.tree)}\n`;
  s += r.applied.length ? `rules\n${rules(r.applied)}` : "rules    no rule changed the result\n";
  if (r.warnings.length) s += `warnings\n${rules(r.warnings)}`;
  return s;
}
