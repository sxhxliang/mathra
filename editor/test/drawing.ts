// Shared by the tests: what an SVG draws, to compare two drawings.

/** What the SVG draws, ids, metadata and marks left out, positions to a tenth of a font unit (a
 * ten-thousandth of an em: below that, floating point): two equal lists draw the same picture. */
export function drawing(svg: string): string[] {
  return (svg.match(/<(use|rect|line|ellipse)\b[^>]*>/g) ?? []).map((t) =>
    t
      .replace(/#mathra-[0-9a-f]+-/, "#")
      .replace(/\s+data-[a-z-]+="[^"]*"/g, "")
      .replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10)),
  );
}
