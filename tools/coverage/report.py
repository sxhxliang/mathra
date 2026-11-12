#!/usr/bin/env python3
"""Reads formulas.jsonl and results.jsonl and writes target/coverage/REPORT.md and summary.json.

    python3 tools/coverage/report.py

Every warning and error becomes a *problem*, with the column taken out so that the same
problem in two formulas has the same name (`unsupported command: \\foo`). For each problem the
report gives how many formulas it hits, in how many documents, and how many formulas it alone
keeps from being clean: fixing that one problem would turn them `ok`. That last number orders
the list of what to do first.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "target" / "coverage"
EXAMPLES = 3
TOP = 40


def problem(text: str) -> str:
    text = re.sub(r"^column \d+: ", "", text)
    text = re.sub(r"; drawn in red$", "", text)
    # one problem per kind of reference, not one per label
    text = re.sub(r"^\\(ref|eqref|cite|autoref|cref|Cref)\{[^}]*\}", r"\\\1{…}", text)
    return text


# commands of the document around a formula, not of the formula: no formula renderer draws them
DOCUMENT = {"ref", "eqref", "cite", "label", "linebreak", "pagebreak", "newline", "vspace", "paragraph",
            "section", "subsection", "caption", "qedhere", "footnote", "par", "noindent", "item", "hyperref",
            "autoref", "cref", "Cref", "url", "href", "index", "nonumber"}


def kind_of(p: str) -> str:
    m = re.search(r"(?:unsupported (?:text )?command: |^')?\\([A-Za-z]+)", p)
    if m and m.group(1) in DOCUMENT:
        return "document command"
    if p.startswith(("unsupported command", "unsupported text command", "'\\")):
        return "command"
    if p.startswith("unsupported environment"):
        return "environment"
    if p.startswith("unsupported"):
        return "other unsupported"
    return "input / parsing"


def main() -> None:
    formulas = {}
    for line in (DIR / "formulas.jsonl").open():
        f = json.loads(line)
        formulas[f["id"]] = f
    results = {}
    for line in (DIR / "results.jsonl").open():
        r = json.loads(line)
        results[r["id"]] = r

    katex = {}
    if (DIR / "katex.jsonl").exists():
        for line in (DIR / "katex.jsonl").open():
            k = json.loads(line)
            katex[k["id"]] = k
    versus = Counter()                 # (mathra clean?, KaTeX ok?) -> formulas
    katex_ok = Counter()               # problem -> formulas of it that KaTeX renders
    ahead = Counter()                  # KaTeX message -> formulas mathra converts clean
    ahead_examples = defaultdict(list)

    by_area = defaultdict(Counter)
    by_source = defaultdict(Counter)
    occ_area = defaultdict(Counter)
    hits = Counter()           # problem -> formulas
    alone = Counter()          # problem -> formulas where it is the only problem
    docs = defaultdict(set)    # problem -> documents
    areas = defaultdict(Counter)
    examples = defaultdict(list)
    errors = Counter()
    error_examples = defaultdict(list)
    crashes = []
    slow = []

    for fid, f in formulas.items():
        r = results.get(fid, {"status": "missing"})
        st = r["status"]
        by_area[f["area"]][st] += 1
        by_area["all"][st] += 1
        by_source[f["source"]][st] += 1
        occ_area[f["area"]][st] += f["count"]
        occ_area["all"][st] += f["count"]
        where = f"{f['source']} {f['doc']} {f['file']}:{f['line']}"
        k = katex.get(fid)
        if k is not None:
            versus[(st == "ok", k["ok"])] += 1
            if st == "ok" and not k["ok"]:
                msg = re.sub(r" at position \d+.*", "", k["message"])
                msg = re.sub(r"^(Undefined control sequence: \\[A-Za-z]+).*", r"\1", msg, flags=re.S)
                msg = re.sub(r"^(No such environment: [A-Za-z*]+).*", r"\1", msg, flags=re.S)
                ahead[msg] += 1
                if len(ahead_examples[msg]) < 2:
                    ahead_examples[msg].append((f["tex"], where))
        if st == "warn":
            probs = sorted({problem(d) for _, d in r["warnings"]})
            for p in probs:
                hits[p] += 1
                if k is not None and k["ok"]:
                    katex_ok[p] += 1
                docs[p].add((f["source"], f["doc"]))
                areas[p][f["area"]] += 1
                if len(examples[p]) < EXAMPLES:
                    examples[p].append((f["tex"], where))
            if len(probs) == 1:
                alone[probs[0]] += 1
        elif st == "error":
            p = problem(r["message"])
            errors[p] += 1
            if len(error_examples[p]) < EXAMPLES:
                error_examples[p].append((f["tex"], where))
        elif st in ("panic", "timeout"):
            crashes.append((st, r.get("message", ""), f["tex"], where))
        if r.get("us", 0) > 50_000 and st not in ("timeout",):
            slow.append((r["us"], f["tex"], where))

    def pct(c: Counter, k: str) -> str:
        n = sum(c.values())
        return f"{100 * c[k] / n:.1f}%" if n else "-"

    md = ["# mathra coverage over real LaTeX", ""]
    md.append("Each distinct formula of each document counts once; `occurrences` weighs them by how often they appear.")
    md.append("")
    md.append("## By area")
    md.append("")
    md.append("| Area | Formulas | ok | warn | error | panic | timeout | ok (occurrences) |")
    md.append("|---|---|---|---|---|---|---|---|")
    for a in ["math", "physics", "chemistry", "all"]:
        c = by_area.get(a)
        if not c:
            continue
        md.append(f"| {a} | {sum(c.values())} | {pct(c,'ok')} | {pct(c,'warn')} | {pct(c,'error')} | {c['panic']} | {c['timeout']} | {pct(occ_area[a],'ok')} |")
    md.append("")
    md.append("## By source")
    md.append("")
    md.append("| Source | Formulas | ok | warn | error | panic | timeout |")
    md.append("|---|---|---|---|---|---|---|")
    for s, c in sorted(by_source.items()):
        md.append(f"| {s} | {sum(c.values())} | {pct(c,'ok')} | {pct(c,'warn')} | {pct(c,'error')} | {c['panic']} | {c['timeout']} |")

    def esc(t: str, n: int = 160) -> str:
        t = " ".join(t.split())
        t = t if len(t) <= n else t[: n - 1] + "…"
        return t.replace("|", "\\|").replace("`", "'")

    if crashes:
        md += ["", f"## Crashes and timeouts ({len(crashes)})", ""]
        for st, msg, tex, where in crashes[:TOP]:
            md.append(f"- **{st}** `{esc(tex)}` — {esc(msg, 120)} ({where})")

    if versus:
        md += ["", "## mathra next to KaTeX", ""]
        md.append("| | KaTeX renders | KaTeX fails |")
        md.append("|---|---|---|")
        md.append(f"| mathra clean | {versus[(True, True)]} | {versus[(True, False)]} |")
        md.append(f"| mathra warns or fails | {versus[(False, True)]} | {versus[(False, False)]} |")
        md.append("")
        md.append("Bottom left is the clearest list of gaps: KaTeX renders them and mathra does not. Top right is mathra ahead (diagrams, chemfig) or mathra accepting what it should question.")

    md += ["", "## What is missing or does not work, by impact", ""]
    md.append("`alone`: formulas this problem alone keeps from being clean (fix it and they become ok). `KaTeX`: of the formulas it hits, how many KaTeX renders.")
    md.append("")
    md.append("| # | Problem | Kind | Formulas | alone | KaTeX | Docs | math / phys / chem | Example |")
    md.append("|---|---|---|---|---|---|---|---|---|")
    ranked = sorted(hits, key=lambda p: (-alone[p], -hits[p]))
    for i, p in enumerate(ranked[:TOP], 1):
        ar = areas[p]
        ex = examples[p][0][0]
        md.append(f"| {i} | `{esc(p, 70)}` | {kind_of(p)} | {hits[p]} | {alone[p]} | {katex_ok[p]} | {len(docs[p])} | {ar['math']} / {ar['physics']} / {ar['chemistry']} | `{esc(ex, 90)}` |")

    for k in ["command", "environment", "other unsupported", "input / parsing", "document command"]:
        items = [p for p in sorted(hits, key=lambda p: -hits[p]) if kind_of(p) == k]
        if not items:
            continue
        md += ["", f"### {k} ({len(items)} distinct)", ""]
        for p in items[:TOP]:
            md.append(f"- `{esc(p, 90)}` — {hits[p]} formulas, {len(docs[p])} docs")
            for tex, where in examples[p][:2]:
                md.append(f"  - `{esc(tex, 140)}` ({where})")

    if errors:
        md += ["", f"## Refused (error), {sum(errors.values())} formulas", ""]
        for p, n in errors.most_common(TOP):
            md.append(f"- `{esc(p, 90)}` — {n}")
            for tex, where in error_examples[p][:2]:
                md.append(f"  - `{esc(tex, 140)}` ({where})")

    if ahead:
        md += ["", f"## mathra clean where KaTeX fails ({sum(ahead.values())} formulas), by KaTeX's message", ""]
        md.append("Either mathra goes further than KaTeX here, or it accepts input it should warn about: worth a look.")
        md.append("")
        for msg, n in ahead.most_common(25):
            md.append(f"- {n} — `{esc(msg, 100)}`")
            for tex, where in ahead_examples[msg][:1]:
                md.append(f"  - `{esc(tex, 140)}` ({where})")

    if slow:
        slow.sort(reverse=True)
        md += ["", f"## Slow (> 50 ms), {len(slow)} formulas", ""]
        for us, tex, where in slow[:15]:
            md.append(f"- {us / 1000:.0f} ms `{esc(tex, 120)}` ({where})")

    (DIR / "REPORT.md").write_text("\n".join(md) + "\n")
    summary = {
        "by_area": {a: dict(c) for a, c in by_area.items()},
        "by_area_occurrences": {a: dict(c) for a, c in occ_area.items()},
        "by_source": {s: dict(c) for s, c in by_source.items()},
        "problems": [
            {"problem": p, "kind": kind_of(p), "formulas": hits[p], "alone": alone[p], "katex": katex_ok[p], "docs": len(docs[p]),
             "areas": dict(areas[p]), "examples": examples[p]}
            for p in ranked[:200]
        ],
        "versus_katex": {f"mathra_{'clean' if a else 'not'}_katex_{'ok' if b else 'fails'}": n for (a, b), n in versus.items()},
        "ahead_of_katex": [{"message": m, "formulas": n, "examples": ahead_examples[m]} for m, n in ahead.most_common(50)],
        "errors": [{"problem": p, "formulas": n, "examples": error_examples[p]} for p, n in errors.most_common(100)],
        "crashes": [{"status": s, "message": m, "tex": t, "where": w} for s, m, t, w in crashes[:200]],
        "slow": [{"us": u, "tex": t, "where": w} for u, t, w in slow[:50]],
    }
    (DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1))
    print("\n".join(md[:40]))
    print(f"\n… full report: {(DIR / 'REPORT.md').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
