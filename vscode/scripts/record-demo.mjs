// Records media/demo.gif: VS Code itself, with the extension of this folder, driven by a script, with
// captions that say what each step does. node scripts/record-demo.mjs [out.gif]
// Needs VS Code installed (the macOS path below, or VSCODE=<its binary>), ffmpeg, and `pnpm build`.
// It runs a VS Code of its own (its own settings, no other extension); yours is not touched.

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = fileURLToPath(new URL("..", import.meta.url));
const out = process.argv[2] ?? join(here, "media", "demo.gif");
const code = process.env.VSCODE ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
// a short folder: VS Code's socket in --user-data-dir must stay under 103 characters
const tmp = mkdtempSync(join(tmpdir(), "mathra-rec-"));
const work = join(tmp, "notes");
const frames = join(tmp, "frames");
mkdirSync(join(tmp, "user", "User"), { recursive: true });
mkdirSync(work);
mkdirSync(frames);

writeFileSync(
  join(tmp, "user", "User", "settings.json"),
  JSON.stringify({
    "workbench.startupEditor": "none",
    "workbench.tips.enabled": false,
    "workbench.colorTheme": "Default Dark Modern",
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "workbench.layoutControl.enabled": false,
    "workbench.editor.empty.hint": "hidden",
    "window.commandCenter": false,
    "window.restoreWindows": "none",
    "chat.disableAIFeatures": true,
    "editor.minimap.enabled": false,
    "editor.fontSize": 16,
    "editor.lineHeight": 26,
    "[markdown]": { "editor.wordWrap": "off" },
    "editor.hover.delay": 250,
    "editor.stickyScroll.enabled": false,
    "breadcrumbs.enabled": false,
    "markdown.preview.fontSize": 19,
    "update.mode": "none",
    "telemetry.telemetryLevel": "off",
    "extensions.ignoreRecommendations": true,
    "security.workspace.trust.enabled": false,
    "git.enabled": false,
    "mathra.locale": "en",
  }),
);
writeFileSync(
  join(work, "notes.md"),
  `# Lecture notes

The Gaussian integral:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

Euler's identity, $e^{i\\pi} + 1 = 0$, and water:
$\\ce{2H2 + O2 -> 2H2O}$.

The roots of $ax^2 + bx + c = 0$:

`,
);

const vscode = spawn(
  code,
  [
    "--remote-debugging-port=0",
    `--extensionDevelopmentPath=${here}`,
    `--user-data-dir=${join(tmp, "user")}`,
    `--extensions-dir=${join(tmp, "ext")}`,
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
    "--new-window",
    work,
    join(work, "notes.md"),
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const ws = await new Promise((resolve, reject) => {
  let text = "";
  vscode.stderr.on("data", (d) => {
    text += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(text);
    if (m) resolve(m[1]);
  });
  vscode.on("exit", () => reject(new Error(`VS Code exited:\n${text}`)));
});

const browser = await chromium.connectOverCDP(ws);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 100 && !page; i++) {
  page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("workbench"));
  if (!page) await pause(200);
}
await page.waitForSelector(".monaco-editor .view-line", { timeout: 30000 });
const cdp = await page.context().newCDPSession(page);
// the same size on any screen (Electron has no Browser domain to size the window): the page laid out at 1280×800
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
await pause(2500);

// the explorer closed: the document and what the extension shows
if (await page.locator(".part.sidebar").isVisible()) await page.keyboard.press("Meta+B");
await page.evaluate(() => {
  // the captions and a pointer drawn in the page (a recording shows no system pointer). VS Code's
  // Trusted Types refuse innerHTML: plain DOM
  const caption = document.createElement("div");
  caption.id = "rec-caption";
  Object.assign(caption.style, {
    position: "fixed", left: "50%", top: "14px", transform: "translateX(-50%)", zIndex: "2147483647",
    maxWidth: "86%", padding: "10px 20px", borderRadius: "12px", background: "rgba(124, 58, 237, 0.96)",
    color: "#fff", font: "600 19px -apple-system, system-ui, sans-serif", textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,.45)", pointerEvents: "none", opacity: "0", transition: "opacity .25s",
  });
  document.body.append(caption);
  const ns = "http://www.w3.org/2000/svg";
  const pointer = document.createElementNS(ns, "svg");
  pointer.setAttribute("viewBox", "0 0 24 24");
  Object.assign(pointer.style, { position: "fixed", left: "0", top: "0", width: "26px", height: "26px", zIndex: "2147483647", pointerEvents: "none", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" });
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M3 2 L3 19 L7.5 14.8 L10.6 21.5 L13.4 20.3 L10.4 13.8 L16.5 13.6 Z");
  path.setAttribute("fill", "#fff");
  path.setAttribute("stroke", "#111");
  path.setAttribute("stroke-width", "1.3");
  pointer.append(path);
  document.body.append(pointer);
  window.recCaption = (text) => {
    caption.style.opacity = text ? "1" : "0";
    if (text) caption.textContent = text;
  };
  window.recPointer = (x, y, down) => {
    pointer.style.transform = `translate(${x - 3}px, ${y - 2}px) scale(${down ? 0.85 : 1})`;
  };
});

// the recording: the page's frames as they change, with their times
const shots = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  shots.push({ data, at: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });

let mouse = { x: 900, y: 620 };
await page.evaluate(({ x, y }) => window.recPointer(x, y), mouse);
const caption = async (text, ms = 0) => {
  await page.evaluate((t) => window.recCaption(t), text);
  await pause(ms);
};
async function moveTo(x, y, ms = 700) {
  const from = { ...mouse };
  const steps = Math.max(6, Math.round(ms / 20));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    mouse = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
    await page.mouse.move(mouse.x, mouse.y);
    await page.evaluate(({ x, y }) => window.recPointer(x, y), mouse);
  }
}
async function click(x, y) {
  await moveTo(x, y);
  await page.evaluate(({ x, y }) => window.recPointer(x, y, true), mouse);
  await page.mouse.click(x, y);
  await pause(120);
  await page.evaluate(({ x, y }) => window.recPointer(x, y), mouse);
}
async function clickOn(locator) {
  const b = await locator.boundingBox();
  await click(b.x + b.width / 2, b.y + b.height / 2);
}
/** Where `text` is drawn in the text editor (its `nth` occurrence), in the page. */
const textAt = (text, nth = 0) =>
  page.evaluate(
    ({ text, nth }) => {
      let seen = 0;
      for (const line of document.querySelectorAll(".editor-group-container .monaco-editor .view-line")) {
        const content = line.textContent.replace(/ /g, " ");
        let i = content.indexOf(text);
        while (i >= 0 && seen < nth) {
          seen++;
          i = content.indexOf(text, i + 1);
        }
        if (i < 0) continue;
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let at = 0;
        let started = false;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const len = n.textContent.length;
          if (!started && i < at + len) {
            range.setStart(n, i - at);
            started = true;
          }
          if (started && i + text.length <= at + len) {
            range.setEnd(n, i + text.length - at);
            const r = range.getBoundingClientRect();
            return { x: r.left, y: r.top, width: r.width, height: r.height };
          }
          at += len;
        }
      }
      return null;
    },
    { text, nth },
  ).then(async (r) => {
    if (r) return r;
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    const lines = await page.locator(".editor-group-container .monaco-editor .view-line").allTextContents();
    throw new Error(`"${text}" is not in the editor:\n${lines.join("\n")}`);
  });
async function hoverText(text, nth = 0) {
  const r = await textAt(text, nth);
  await moveTo(r.x + r.width / 2, r.y + r.height / 2);
  await page.locator(".monaco-hover").first().waitFor({ state: "visible", timeout: 5000 });
}
async function command(name) {
  await page.keyboard.press("Meta+Shift+P");
  await pause(300);
  await page.keyboard.type(name, { delay: 45 });
  await pause(500);
  await page.keyboard.press("Enter");
}
/** The webview frame that holds the visual editor. */
async function editorFrame() {
  for (let i = 0; i < 100; i++) {
    for (const f of page.frames()) {
      if (await f.locator("mathra-editor").count().catch(() => 0)) return f;
    }
    await pause(200);
  }
  throw new Error("the visual editor did not open");
}

// on a failure, what the window showed
process.on("unhandledRejection", async (e) => {
  console.error(e);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT }).catch(() => {});
  vscode.kill();
  process.exit(1);
});

// 1. the hover
await caption("Hover over any equation in Markdown or LaTeX: mathra draws it", 1200);
await hoverText("\\int_{-\\infty}");
await pause(2600);
await caption("…with what a screen reader says, and links to edit or copy it", 3200);
await moveTo(mouse.x + 380, mouse.y + 260, 500);
await page.keyboard.press("Escape");

// 2. copying, said in full
await caption("Copy it as LaTeX, SVG, MathML, speech or braille: each shown as it will be pasted", 600);
/** A click in `text`, then the pointer off it, so no hover covers what comes next. */
async function clickText(text) {
  const r = await textAt(text);
  await click(r.x + 10, r.y + r.height / 2);
  await moveTo(r.x + 40, r.y + 420, 350);
}
await clickText("e^{i\\pi}");
await command("mathra: Copy Equation As");
await pause(3600);
await page.keyboard.type("Speech", { delay: 70 });
await pause(700);
await page.keyboard.press("Enter");
await pause(1800);

// 3. the visual editor, at a bare cursor: a new formula
// the empty line under the last one: a new formula there
const last = await textAt("The roots");
await click(last.x + 4, last.y + last.height / 2);
await page.keyboard.press("Meta+ArrowDown");
await caption("Or build a formula in mathra's visual editor (⌘⌥M), typed as on a calculator", 400);
await page.keyboard.press("Meta+Alt+M");
const frame = await editorFrame();
await frame.locator("mathra-field").first().waitFor({ state: "visible" });
await pause(1500);
await clickOn(frame.locator("mathra-editor mathra-field").first());
await pause(400);
await page.keyboard.type("x=(-b+-sqrt(b^2-4ac))/2a", { delay: 120 });
await pause(1600);
await caption("Palettes, matrices, chemistry and diagrams too; then it goes into the document", 1400);
await clickOn(frame.locator('button[slot="actions"]'));
await pause(2200);

// 4. the new equation, hovered in the document
await caption("Back in the document, as LaTeX between $", 300);
await hoverText("\\frac");
await pause(3000);
await moveTo(mouse.x - 300, mouse.y + 200, 400);
await page.keyboard.press("Escape");

// 5. the preview
await caption("The Markdown preview draws every equation with mathra, chemistry included", 300);
await clickText("e^{i\\pi}");
await page.keyboard.press("Meta+K");
await page.keyboard.press("V");
await pause(4500);

// 6. explain
await caption("Explain Equation: the tree, the speech, the braille and every rule mathra applied", 300);
await clickText("e^{i\\pi}");
await command("mathra: Explain Equation");
await pause(4500);
await caption("mathra · accessible math in VS Code, in 16 languages", 2500);

await cdp.send("Page.stopScreencast");
await browser.close().catch(() => {});
vscode.kill();

// the frames, each as long as it stayed on the screen, made into a GIF
const list = [];
shots.forEach((s, i) => {
  const file = join(frames, `${String(i).padStart(5, "0")}.png`);
  writeFileSync(file, Buffer.from(s.data, "base64"));
  const next = shots[i + 1]?.at ?? s.at + 1;
  list.push(`file '${file}'`, `duration ${Math.max(0.02, next - s.at).toFixed(3)}`);
});
list.push(`file '${join(frames, `${String(shots.length - 1).padStart(5, "0")}.png`)}'`);
writeFileSync(join(tmp, "frames.txt"), list.join("\n"));
const ff = spawnSync(
  "ffmpeg",
  [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(tmp, "frames.txt"),
    "-vf", "fps=12,scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
    out,
  ],
  { stdio: "inherit" },
);
rmSync(tmp, { recursive: true, force: true });
if (ff.status !== 0) process.exit(1);
console.log(`${out}: ${shots.length} frames`);
