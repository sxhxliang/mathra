"""Reads CHANGELOG.md, for the GitHub release and for the site's page of the project's evolution.

    python3 scripts/changelog.py notes <version>   the release's section (exits 1 if it has no section)
    python3 scripts/changelog.py release <version> the GitHub release's body: the section, pull requests, install
    python3 scripts/changelog.py js                 the site's data: var MATHRA_CHANGELOG = {...};

A release is a section `## <version> - <date>` (or `## Unreleased`): its first paragraph is the
headline, the `- ` lines what changed, and `Equations: `a` `b`` the equations that show it, each a
name from corpus/gallery.json or the LaTeX itself. crates/core/tests/examples.rs checks that each one
converts in strict mode.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADING = re.compile(r"^## (Unreleased|(\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2}))\s*$", re.M)


def sections():
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    heads = list(HEADING.finditer(text))
    for k, h in enumerate(heads):
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        yield h, text[h.end():end].strip()


def gallery():
    """The named rows of the gallery: name -> {tex, locale, input, caption}."""
    groups = json.loads((ROOT / "corpus/gallery.json").read_text(encoding="utf-8"))
    return {r["name"]: r for g in groups for r in g["rows"] if r.get("name")}


def release(h, body, named):
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    headline = paragraphs[0] if paragraphs and not paragraphs[0].startswith(("- ", "**", "Equations:")) else ""
    listed = re.search(r"^Equations:(.*)$", body, re.M)
    equations = []
    for item in re.findall(r"`([^`]+)`", listed.group(1)) if listed else []:
        row = named.get(item)
        if row:
            equations.append({"tex": row["tex"], "locale": row.get("locale", "en"), "input": row.get("input", "latex"), "caption": row["caption"]})
        else:
            equations.append({"tex": item, "locale": "en", "input": "latex", "caption": ""})
    return {
        "version": h.group(2) or "Unreleased",
        "date": h.group(3) or "",
        "headline": headline,
        "items": [line[2:].strip() for line in body.splitlines() if line.startswith("- ")],
        "equations": equations,
    }


def release_body(version):
    """The GitHub release of <version>: its section of CHANGELOG.md, the pull requests since the
    previous release grouped by label (.github/release.yml), and how to install each package.

    The tags must already be on GitHub: the pull requests come from its generate-notes API."""
    import subprocess

    def run(*cmd):
        return subprocess.run(cmd, check=True, capture_output=True, text=True, cwd=ROOT).stdout.strip()

    found = [(h, body) for h, body in sections() if h.group(2)]
    index = next((k for k, (h, _) in enumerate(found) if h.group(2) == version), None)
    if index is None:
        sys.exit(f"CHANGELOG.md has no section for {version}")
    body = found[index][1]
    tags = set(run("git", "tag", "-l").split())
    previous = next((h.group(2) for h, _ in found[index + 1:] if "v" + h.group(2) in tags), None)
    slug = re.sub(r"^.*github\.com[:/](.*?)(\.git)?$", r"\1", run("git", "remote", "get-url", "origin"))
    owner, name = slug.split("/")
    site = f"https://{owner}.github.io/{name}/changelog.html"

    out, listed = [], False
    for block in [b.strip() for b in body.split("\n\n") if b.strip()]:
        if block.startswith("- ") and not listed:
            out.append("## What changed")
            listed = True
        shown = re.match(r"^(Figures|Equations):\s*(.*)$", block, re.S)
        if shown:
            block = f"**{shown.group(1)}**, drawn live on [the project's evolution]({site}): {shown.group(2)}"
        out.append(block)

    args = ["gh", "api", f"repos/{slug}/releases/generate-notes", "-f", f"tag_name=v{version}"]
    if previous:
        args += ["-f", f"previous_tag_name=v{previous}"]
    generated = json.loads(run(*args))["body"]
    full = re.search(r"^\*\*Full Changelog\*\*:.*$", generated, re.M)
    prs = re.sub(r"^\*\*Full Changelog\*\*:.*$", "", generated, flags=re.M)
    prs = re.sub(r"^## What's Changed\s*", "", prs, flags=re.M)
    prs = re.sub(r"^## New Contributors", "### New contributors", prs, flags=re.M).strip()
    if prs:
        out += ["## Pull requests", prs]

    rows = []
    if f"v{version}" in tags:
        rows.append(f"| Rust | [`{name}`](https://crates.io/crates/{name}/{version}) | `cargo add {name}@{version}` |")
        rows.append(f"| CLI | [`{name}-cli`](https://crates.io/crates/{name}-cli/{version}) | `cargo install {name}-cli@{version}` |")
    if f"npm-v{version}" in tags:
        rows.append(f"| npm | [`@mathlabs/{name}`](https://www.npmjs.com/package/@mathlabs/{name}/v/{version}) | `npm install @mathlabs/{name}@{version}` |")
    if f"py-v{version}" in tags:
        rows.append(f"| Python | [`{name}`](https://pypi.org/project/{name}/{version}/) | `pip install {name}=={version}` |")
    if rows:
        out += ["## Install", "| | Package | Command |\n|---|---|---|\n" + "\n".join(rows)]
    if full:
        out.append(full.group(0).replace("Full Changelog", "Full changelog"))
    return "\n\n".join(out) + "\n"


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "notes":
        for h, body in sections():
            if h.group(2) == sys.argv[2]:
                print(body)
                return
        sys.exit(f"CHANGELOG.md has no section for {sys.argv[2]}: add `## {sys.argv[2]} - <date>` with what changed")
    if len(sys.argv) == 3 and sys.argv[1] == "release":
        print(release_body(sys.argv[2]), end="")
        return
    if len(sys.argv) == 2 and sys.argv[1] == "js":
        named = gallery()
        data = {"releases": [release(h, body, named) for h, body in sections()]}
        print("var MATHRA_CHANGELOG = " + json.dumps(data, ensure_ascii=False) + ";")
        return
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
