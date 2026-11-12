#!/usr/bin/env python3
"""Extracts the formulas of the downloaded sources into target/coverage/formulas.jsonl.

    python3 tools/coverage/extract.py

A document is a folder (an arXiv paper, the Stacks Project, a CTAN manual). Its own macros
(\\newcommand, \\renewcommand, \\providecommand, \\def, \\DeclareMathOperator, \\let) are read from
all its .tex/.sty files and expanded in each formula, because mathra converts a formula, not a
document: a paper's \\R or \\norm{x} is the paper's business, not a missing feature.

What is taken: $…$, $$…$$, \\(…\\), \\[…\\], the math environments (equation, align, gather,
multline, eqnarray, alignat, flalign, displaymath, math and their starred forms), the diagram
environments outside math (tikzcd, xy) and, in text, \\ce{…}, \\pu{…}, \\chemfig{…} and
\\schemestart…\\schemestop. Verbatim blocks are skipped.

Pre-processing, kept to what a document (not a formula) owns: \\label{…} is removed, and a chemfig
structure that calls a submolecule (`!{name}`, `!\\name`) gets the document's \\definesubmol for it (the
nearest one before it in the same file) put in front, as the document defines it for the structure.
Nothing else is rewritten; everything that remains is what mathra receives.

What is not a formula, though it looks like one:
- a $…$ that crosses a blank line: TeX ends math at a paragraph, so it is the text between two
  formulas, read after a stray $ put the pairing out of step. Skipping its opening $ puts the pairing
  back in step. (Displays, $$…$$ and \\[…\\], keep a blank line some authors leave in a matrix);
- anything with a macro parameter (#1): it is inside a definition (a \\tikzset style, say);
- \\schemestart right after or before a | : the manual quoting the command in its text (|\\schemestart|).

A $ inside braces does not close a $…$: it is the inner math of \\text{$x$} or of mhchem's
\\ce{NaOH(aq,$\\infty$)}.

Each line of the output is one distinct formula of one document:
  {"id", "area", "source", "doc", "file", "line", "kind", "display", "tex", "expanded", "count"}
"""

import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "target" / "coverage" / "sources"
OUT = ROOT / "target" / "coverage" / "formulas.jsonl"

AREA_OF_CATEGORY = {"hep-th": "physics", "gr-qc": "physics", "quant-ph": "physics", "physics.chem-ph": "chemistry"}

DISPLAY_INNER = {"equation", "displaymath"}  # the formula is the content
INLINE_INNER = {"math"}
DISPLAY_WHOLE = {"align", "gather", "multline", "eqnarray", "alignat", "flalign", "tikzcd", "xy"}  # given as \begin…\end
VERBATIM = {"verbatim", "lstlisting", "minted", "comment", "Verbatim", "BVerbatim", "LVerbatim", "alltt"}
CHEM_TEXT = ("ce", "pu", "chemfig")
MAX_EXPANSION = 50_000
# what is extracted by name is never expanded: manuals redefine \chemfig to print its logo
PROTECTED = {"ce", "pu", "chemfig", "schemestart", "schemestop", "begin", "end"}


# ---------------------------------------------------------------- reading


# Marks a line a comment emptied: it ends no paragraph, and is removed from each formula.
COMMENTED = "\x1f"


def strip_comments(text: str) -> str:
    out = []
    for line in text.split("\n"):
        i = 0
        while True:
            i = line.find("%", i)
            if i < 0:
                break
            # a % preceded by an odd number of backslashes is a literal percent
            j, slashes = i - 1, 0
            while j >= 0 and line[j] == "\\":
                slashes += 1
                j -= 1
            if slashes % 2 == 0:
                # a % also takes the line break: a line left blank by its comment is no paragraph
                line = line[:i] + (COMMENTED if not line[:i].strip() else "")
                break
            i += 1
        out.append(line)
    return "\n".join(out)  # line count kept, so line numbers stay right


def read_group(s: str, i: int) -> tuple[str, int] | None:
    """The brace group starting at s[i] == '{': (content, index after '}')."""
    if i >= len(s) or s[i] != "{":
        return None
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == "\\":
            j += 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return s[i + 1 : j], j + 1
        j += 1
    return None


def read_bracket(s: str, i: int) -> tuple[str, int] | None:
    if i >= len(s) or s[i] != "[":
        return None
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == "\\":
            j += 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == "]" and depth == 0:
            return s[i + 1 : j], j + 1
        j += 1
    return None


def skip_ws(s: str, i: int) -> int:
    while i < len(s) and s[i] in " \t\n":
        i += 1
    return i


def read_arg(s: str, i: int) -> tuple[str, int] | None:
    """One TeX argument: a brace group, a control sequence or one character."""
    i = skip_ws(s, i)
    if i >= len(s):
        return None
    if s[i] == "{":
        return read_group(s, i)
    if s[i] == "\\":
        m = re.match(r"\\([A-Za-z]+|.)", s[i:])
        return (m.group(0), i + len(m.group(0))) if m else None
    return s[i], i + 1


# ---------------------------------------------------------------- macros


class Macro:
    def __init__(self, nargs: int, body: str, default: str | None = None):
        self.nargs, self.body, self.default = nargs, body, default


def read_environments(text: str, envs: dict) -> None:
    """\\newenvironment{name}[n][default]{begin}{end}: name -> (n, default, begin, end)."""
    for m in re.finditer(r"\\(newenvironment|renewenvironment)\*?\s*\{([A-Za-z]+\*?)\}\s*", text):
        i, nargs, default = m.end(), 0, None
        b = read_bracket(text, i)
        if b:
            try:
                nargs = int(b[0].strip())
            except ValueError:
                continue
            i = skip_ws(text, b[1])
            b = read_bracket(text, i)
            if b:
                default, i = b[0], skip_ws(text, b[1])
        g1 = read_group(text, i)
        if not g1:
            continue
        g2 = read_group(text, skip_ws(text, g1[1]))
        if g2 and not internal(g1[0] + g2[0]):
            envs[m.group(2)] = (nargs, default, g1[0], g2[0])


def expand_environments(tex: str, envs: dict) -> str:
    for name, (nargs, default, begin, end) in envs.items():
        pat = re.compile(r"\\begin\s*\{" + re.escape(name) + r"\}")
        while True:
            m = pat.search(tex)
            if not m:
                break
            j, args = m.end(), []
            if default is not None:
                b = read_bracket(tex, skip_ws(tex, j))
                args.append(b[0] if b else default)
                j = b[1] if b else j
            while len(args) < nargs:
                a = read_arg(tex, j)
                if not a:
                    break
                args.append(a[0])
                j = a[1]
            body = substitute(begin, args)
            tex = tex[: m.start()] + body + tex[j:]
        tex = re.sub(r"\\end\s*\{" + re.escape(name) + r"\}", lambda _: end, tex)
    return tex


DEFINITION_RE = re.compile(r"\\(newcommand|renewcommand|providecommand|DeclareRobustCommand|newenvironment|renewenvironment|def|gdef|edef|xdef|DeclareMathOperator)\b")


def blank_definitions(text: str) -> str:
    """Definitions blanked out (newlines kept): a formula inside a macro body is not a formula."""
    out, last = [], 0
    for m in DEFINITION_RE.finditer(text):
        if m.start() < last:
            continue
        i = m.end()
        # skip the name, the [n] and [default], then every brace group that follows
        nm = re.match(r"\s*\*?\s*(\{[^{}]*\}|\\[A-Za-z@]+)?((?:#\d)*)\s*(\[[^\]]*\]\s*)*", text[i:])
        i += nm.end() if nm else 0
        groups = 0
        while groups < 2:
            k = skip_ws(text, i)
            g = read_group(text, k)
            if not g:
                break
            i, groups = g[1], groups + 1
        out.append(text[last : m.start()])
        out.append(re.sub(r"[^\n]", " ", text[m.start() : i]))
        last = i
    out.append(text[last:])
    return "".join(out)


def read_macros(text: str, macros: dict) -> None:
    for m in re.finditer(r"\\(newcommand|renewcommand|providecommand|DeclareRobustCommand)\*?\s*", text):
        i = m.end()
        if i < len(text) and text[i] == "{":
            g = read_group(text, i)
            if not g:
                continue
            name, i = g[0].strip(), g[1]
        else:
            nm = re.match(r"\\[A-Za-z]+", text[i:])
            if not nm:
                continue
            name, i = nm.group(0), i + nm.end()
        if not re.fullmatch(r"\\[A-Za-z]+", name):
            continue
        nargs, default = 0, None
        i = skip_ws(text, i)
        b = read_bracket(text, i)
        if b:
            try:
                nargs = int(b[0].strip())
            except ValueError:
                continue
            i = skip_ws(text, b[1])
            b = read_bracket(text, i)
            if b:
                default, i = b[0], skip_ws(text, b[1])
        g = read_group(text, i)
        if g:
            if m.group(1) == "providecommand" and name[1:] in macros:
                continue
            if name[1:] in PROTECTED or internal(g[0]):
                continue
            macros[name[1:]] = Macro(nargs, g[0], default)

    for m in re.finditer(r"\\def\s*\\([A-Za-z]+)((?:#\d)*)\s*\{", text):
        g = read_group(text, m.end() - 1)
        if g and m.group(1) not in PROTECTED and not internal(g[0]):
            macros[m.group(1)] = Macro(len(m.group(2)) // 2, g[0])

    for m in re.finditer(r"\\DeclareMathOperator(\*?)\s*\{?\s*\\([A-Za-z]+)\s*\}?\s*", text):
        g = read_group(text, m.end())
        if g:
            star = "*" if m.group(1) else ""
            macros[m.group(2)] = Macro(0, f"\\operatorname{star}{{{g[0]}}}")

    for m in re.finditer(r"\\let\s*\\([A-Za-z]+)\s*=?\s*\\([A-Za-z]+)", text):
        if m.group(2) in macros:
            macros[m.group(1)] = macros[m.group(2)]
        # \let to a primitive: nothing to do, the name is then mathra's to read


def substitute(body: str, args: list) -> str:
    """#1…#9 replaced by the arguments, with a space where a control word would glue onto a
    letter: \\lvert#1 with x gives \\lvert x, not \\lvertx."""
    def one(m):
        n = int(m.group(1))
        a = args[n - 1] if n - 1 < len(args) else ""
        before = body[: m.start()]
        if a[:1].isalpha() and re.search(r"\\[A-Za-z]+$", before):
            a = " " + a
        after = body[m.end() :]
        if after[:1].isalpha() and re.search(r"\\[A-Za-z]+$", a):
            a = a + " "
        return a
    return re.sub(r"#(\d)", one, body)


def internal(body: str) -> bool:
    """A body with @ names is package programming (\\Let@, \\@startsection), not notation."""
    return re.search(r"\\[A-Za-z]*@", body) is not None


def expand(tex: str, macros: dict) -> tuple[str, bool]:
    if not macros:
        return tex, False
    changed = False
    for _ in range(20):
        out, i, did = [], 0, False
        while i < len(tex):
            m = re.compile(r"\\([A-Za-z]+)").search(tex, i)
            if not m:
                out.append(tex[i:])
                break
            out.append(tex[i : m.start()])
            name, j = m.group(1), m.end()
            mac = macros.get(name)
            if mac is None:
                out.append(m.group(0))
                i = j
                continue
            args, ok = [], True
            first = 0
            if mac.default is not None:
                k = skip_ws(tex, j)
                b = read_bracket(tex, k)
                if b:
                    args.append(b[0])
                    j = b[1]
                else:
                    args.append(mac.default)
                first = 1
            for _ in range(first, mac.nargs):
                a = read_arg(tex, j)
                if a is None:
                    ok = False
                    break
                args.append(a[0])
                j = a[1]
            if not ok:
                out.append(m.group(0))
                i = m.end()
                continue
            body = substitute(mac.body, args)
            # a control word must not glue onto a letter: \pi\N -> \pi N, not \piN
            if re.search(r"\\[A-Za-z]+$", body) and j < len(tex) and tex[j].isalpha():
                body += " "
            if body[:1].isalpha() and re.search(r"\\[A-Za-z]+$", "".join(out[-2:])):
                body = " " + body
            out.append(body)
            i, did = j, True
        tex = "".join(out)
        if not did:
            break
        changed = True
        if len(tex) > MAX_EXPANSION:
            break
    return tex, changed


# ---------------------------------------------------------------- formulas

ENV_RE = re.compile(r"\\begin\s*\{([A-Za-z]+\*?)\}")


def find_end(s: str, i: int, env: str) -> int | None:
    """Index of the matching \\end{env} for a \\begin{env} that ended right before i."""
    depth, pat = 1, re.compile(r"\\(begin|end)\s*\{" + re.escape(env) + r"\}")
    for m in pat.finditer(s, i):
        depth += 1 if m.group(1) == "begin" else -1
        if depth == 0:
            return m.start()
    return None


def formulas(text: str):
    """Yields (offset, kind, display, tex) for each formula of a document body."""
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == "\\" and i + 1 < n:
            nxt = text[i + 1]
            if nxt in "[(":
                close = "\\]" if nxt == "[" else "\\)"
                j = text.find(close, i + 2)
                if j < 0:
                    i += 2
                    continue
                yield i, "\\[ \\]" if nxt == "[" else "\\( \\)", nxt == "[", text[i + 2 : j]
                i = j + 2
                continue
            m = ENV_RE.match(text, i)
            if m:
                env = m.group(1)
                base = env.rstrip("*")
                if base in VERBATIM:
                    e = find_end(text, m.end(), env)
                    i = e + 1 if e is not None else m.end()
                    continue
                if base in DISPLAY_INNER | INLINE_INNER | DISPLAY_WHOLE:
                    e = find_end(text, m.end(), env)
                    if e is None:
                        i = m.end()
                        continue
                    end_tag = re.match(r"\\end\s*\{[^}]*\}", text[e:]).group(0)
                    if base in DISPLAY_WHOLE:
                        yield i, env, True, text[i : e + len(end_tag)]
                    else:
                        yield i, env, base in DISPLAY_INNER, text[m.end() : e]
                    i = e + len(end_tag)
                    continue
                i = m.end()
                continue
            if text.startswith("\\schemestart", i):
                j = text.find("\\schemestop", i)
                quoted = text[i - 1 : i] == "|" or text[i + len("\\schemestart") : i + len("\\schemestart") + 1] == "|"
                if quoted:
                    i += len("\\schemestart")
                    continue
                if j > 0:
                    yield i, "schemestart", True, text[i : j + len("\\schemestop")]
                    i = j + len("\\schemestop")
                    continue
            cm = re.match(r"\\(ce|pu|chemfig)\b\s*", text[i:])
            if cm:
                g = read_group(text, i + cm.end())
                if g:
                    yield i, cm.group(1), False, text[i : g[1]]
                    i = g[1]
                    continue
            if nxt == "v" and text.startswith("\\verb", i) and i + 5 < n and not text[i + 5].isalpha():
                d = text[i + 5] if text[i + 5] != "*" else text[i + 6]
                start = i + 6 if text[i + 5] != "*" else i + 7
                j = text.find(d, start)
                i = j + 1 if j > 0 else start
                continue
            i += 2  # an escaped character, \$ among them
            continue
        if c == "$":
            if text.startswith("$$", i):
                j = text.find("$$", i + 2)
                if j < 0:
                    i += 2
                    continue
                yield i, "$$ $$", True, text[i + 2 : j]
                i = j + 2
                continue
            # a $ inside braces belongs to them (\\text{$x$}, mhchem's \\ce{NaOH(aq,$\\infty$)}): it does
            # not close the formula
            j, depth = i + 1, 0
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == "{":
                    depth += 1
                elif text[j] == "}":
                    depth = max(depth - 1, 0)
                elif text[j] == "$" and depth == 0:
                    break
                j += 1
            if j >= n or crosses_paragraph(text[i + 1 : j]):
                i += 1
                continue
            yield i, "$ $", False, text[i + 1 : j]
            i = j + 1
            continue
        i += 1


def crosses_paragraph(tex: str) -> bool:
    """Whether math text holds a blank line: TeX ends math at a paragraph."""
    return re.search(r"\n[ \t\r]*\n", tex) is not None


SUBMOL_RE = re.compile(r"\\(?:re)?definesubmol\s*(\{[^{}]*\}|\\[A-Za-z]+|.)")
CALL_RE = re.compile(r"!(\{[^{}]*\}|\\[A-Za-z]+|[^\s{\\])")


def submol_name(raw: str) -> str:
    return raw[1:-1].strip() if raw.startswith("{") else raw


def read_submols(text: str) -> list:
    """Each \\definesubmol of a text, whole: (offset, name, its source)."""
    out = []
    for m in SUBMOL_RE.finditer(text):
        i = skip_ws(text, m.end())
        if i < len(text) and text[i].isdigit():
            i += 1
        b = read_bracket(text, skip_ws(text, i))
        if b:
            i = b[1]
        g = read_group(text, skip_ws(text, i))
        if g:
            out.append((m.start(), submol_name(m.group(1)), text[m.start() : g[1]]))
    return out


def with_submols(tex: str, at: int, here: list, elsewhere: list) -> str:
    """A chemfig structure with the definitions of the submolecules it calls in front: for each name,
    the nearest definition before it in its file, or else the last one in the document; the
    definitions those call come along."""
    if "chemfig" not in tex or "!" not in tex:
        return tex
    wanted, chosen, todo = set(), [], [submol_name(c) for c in CALL_RE.findall(tex)]
    while todo:
        name = todo.pop()
        if name in wanted:
            continue
        before = [d for d in here if d[1] == name and d[0] < at]
        found = before[-1] if before else next((d for d in reversed(elsewhere) if d[1] == name), None)
        if found:
            wanted.add(name)
            chosen.append(found[2])
            todo.extend(submol_name(c) for c in CALL_RE.findall(found[2]))
    return " ".join(reversed(chosen)) + " " + tex if chosen else tex


def body_of(text: str) -> tuple[str, int]:
    m = re.search(r"\\begin\s*\{document\}", text)
    if not m:
        return text, 0
    return text[m.end() :], m.end()


# ---------------------------------------------------------------- documents


def documents():
    """(source, area, doc name, folder) for each document downloaded."""
    if (SRC / "stacks").exists():
        yield "stacks", "math", "stacks-project", SRC / "stacks"
    for cat_dir in sorted((SRC / "arxiv").glob("*")) if (SRC / "arxiv").exists() else []:
        area = AREA_OF_CATEGORY.get(cat_dir.name, "math" if cat_dir.name.startswith("math") else "physics")
        for paper in sorted(cat_dir.iterdir()):
            yield f"arxiv:{cat_dir.name}", area, paper.name, paper
    for pkg in sorted((SRC / "ctan").glob("*")) if (SRC / "ctan").exists() else []:
        yield f"ctan:{pkg.name}", "chemistry", pkg.name, pkg


def read_text(p: Path) -> str:
    raw = p.read_bytes()
    for enc in ("utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", "replace")


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    total_occ = total = 0
    with OUT.open("w") as out:
        for source, area, doc, folder in documents():
            files = sorted(p for p in folder.rglob("*") if p.suffix.lower() in (".tex", ".sty", ".ltx", ".def") and p.is_file())
            texts = {p: strip_comments(read_text(p)) for p in files}
            macros: dict = {}
            envs: dict = {}
            for p, t in texts.items():  # .sty first would be more TeX-like; collisions are rare
                read_macros(t, macros)
                read_environments(t, envs)
            submols = {p: read_submols(t) for p, t in texts.items()}
            every_submol = [d for p in texts for d in submols[p]]
            seen: "OrderedDict[str, dict]" = OrderedDict()
            for p, t in texts.items():
                if p.suffix.lower() != ".tex":
                    continue
                body, offset = body_of(blank_definitions(t))
                for pos, kind, display, tex in formulas(body):
                    tex = tex.replace(COMMENTED, "")
                    tex = re.sub(r"\\label\s*\{[^{}]*\}", "", tex).lstrip()
                    tex = tex if tex.endswith("\\ ") else tex.rstrip()
                    if not tex or tex in ("\\begin{" + kind + "}\\end{" + kind + "}",):
                        continue
                    if re.search(r"#\d", tex):
                        continue  # a macro parameter: the formula is inside a definition
                    with_defs = with_submols(tex, offset + pos, submols[p], every_submol)
                    expanded, changed = expand(expand_environments(with_defs, envs) if envs else with_defs, macros)
                    expanded = expanded.replace(COMMENTED, "")
                    changed = changed or with_defs != tex
                    key = expanded
                    if key in seen:
                        seen[key]["count"] += 1
                        continue
                    line = t.count("\n", 0, offset + pos) + 1
                    seen[key] = {
                        "area": area, "source": source, "doc": doc,
                        "file": str(p.relative_to(folder)), "line": line, "kind": kind,
                        "display": display, "tex": expanded, "original": tex if changed else None,
                        "count": 1,
                    }
            for rec in seen.values():
                total += 1
                total_occ += rec["count"]
                rec["id"] = total
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            print(f"{source:24} {doc:28} {len(seen):6} formulas  {len(macros):4} macros", file=sys.stderr)
    print(f"{total} distinct formulas ({total_occ} occurrences) -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
