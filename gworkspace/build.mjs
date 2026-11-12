// dist/: what clasp pushes to Apps Script (.clasp.json's rootDir). Apps Script serves one HTML file per
// page, so the sidebar's script goes inside it; Code.js and the manifest as they are. node build.mjs

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const at = (path) => new URL(path, import.meta.url);
rmSync(at("dist"), { recursive: true, force: true });
mkdirSync(at("dist"));
const script = readFileSync(at("src/sidebar.js"), "utf8");
const page = readFileSync(at("src/Sidebar.html"), "utf8");
const tag = '<script type="module" src="sidebar.js"></script>';
if (!page.includes(tag)) throw new Error(`src/Sidebar.html has no ${tag}`);
writeFileSync(at("dist/Sidebar.html"), page.replace(tag, () => `<script type="module">\n${script}</script>`));
for (const f of ["Code.js", "appsscript.json"]) copyFileSync(at(`src/${f}`), at(`dist/${f}`));
console.log("dist/: Sidebar.html, Code.js, appsscript.json");
