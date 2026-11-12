#!/usr/bin/env python3
"""Downloads the LaTeX sources of the coverage run into target/coverage/sources/.

Nothing downloaded here is committed: the sources keep their own licenses and the
repository keeps only this script, the list of arXiv ids and the report.

    python3 tools/coverage/fetch.py            # everything
    python3 tools/coverage/fetch.py stacks     # one source

Sources:
  stacks   The Stacks Project (algebraic geometry, GFDL), shallow git clone.
  arxiv    arXiv papers listed in tools/coverage/arxiv-ids.txt (category per line).
           With no list, the newest papers of each category in ARXIV_CATEGORIES are
           picked and the list is written, so later runs use the same papers.
  ctan     The manuals of mhchem and chemfig (chemistry examples), from CTAN.
"""

import gzip
import io
import re
import subprocess
import sys
import tarfile
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "target" / "coverage" / "sources"
IDS = Path(__file__).resolve().parent / "arxiv-ids.txt"

# category -> how many papers; the area in the report comes from the category
ARXIV_CATEGORIES = {
    "hep-th": 25,
    "gr-qc": 15,
    "quant-ph": 10,
    "physics.chem-ph": 25,
    "math.AP": 10,
    "math.CO": 10,
}
# package -> (zip, the manual files kept): the zips also hold the package's own code, whose
# macros are TeX programming, not chemistry written by a person
CTAN = {
    "mhchem": ("https://mirrors.ctan.org/macros/latex/contrib/mhchem.zip", {"mhchem.tex"}),
    "chemfig": ("https://mirrors.ctan.org/macros/generic/chemfig.zip", {"chemfig-fr.tex"}),
}
AGENT = "mathra-coverage/0.1 (research script; one request every 3 s)"
ARXIV_DELAY = 3.0


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def fetch_stacks() -> None:
    dest = OUT / "stacks"
    if dest.exists():
        print("stacks: already there")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "clone", "--depth", "1", "https://github.com/stacks/stacks-project", str(dest)], check=True)


def pick_arxiv_ids() -> list[tuple[str, str]]:
    picked = []
    for cat, n in ARXIV_CATEGORIES.items():
        url = f"https://export.arxiv.org/api/query?search_query=cat:{cat}&sortBy=submittedDate&sortOrder=descending&max_results={n * 2}"
        feed = ET.fromstring(get(url))
        ns = {"a": "http://www.w3.org/2005/Atom", "x": "http://arxiv.org/schemas/atom"}
        count = 0
        for entry in feed.findall("a:entry", ns):
            primary = entry.find("x:primary_category", ns)
            if primary is None or primary.get("term") != cat:
                continue  # cross-lists would blur the area
            aid = entry.find("a:id", ns).text.rsplit("/abs/", 1)[1]
            aid = re.sub(r"v\d+$", "", aid)
            picked.append((cat, aid))
            count += 1
            if count == n:
                break
        time.sleep(ARXIV_DELAY)
    IDS.write_text("".join(f"{c} {a}\n" for c, a in picked))
    print(f"arxiv: picked {len(picked)} papers, list written to {IDS.relative_to(ROOT)}")
    return picked


def unpack_arxiv(data: bytes, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    try:
        with tarfile.open(fileobj=io.BytesIO(data)) as tar:
            for m in tar.getmembers():
                if m.isfile() and m.name.lower().endswith((".tex", ".sty", ".def", ".ltx")) and ".." not in m.name and not m.name.startswith("/"):
                    target = dest / m.name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(tar.extractfile(m).read())
        return
    except tarfile.ReadError:
        pass
    try:
        data = gzip.decompress(data)  # a single gzipped .tex
    except OSError:
        pass
    if data[:4] == b"%PDF":
        (dest / "PDF_ONLY").write_text("")  # no source offered
    else:
        (dest / "main.tex").write_bytes(data)


def fetch_arxiv() -> None:
    papers = []
    if IDS.exists():
        papers = [tuple(l.split()) for l in IDS.read_text().splitlines() if l.strip() and not l.startswith("#")]
    else:
        papers = pick_arxiv_ids()
    for cat, aid in papers:
        dest = OUT / "arxiv" / cat / aid.replace("/", "_")
        if dest.exists():
            continue
        try:
            unpack_arxiv(get(f"https://export.arxiv.org/e-print/{aid}"), dest)
            print(f"arxiv: {cat} {aid}")
        except Exception as e:  # one paper failing must not stop the rest
            print(f"arxiv: {cat} {aid} FAILED: {e}", file=sys.stderr)
        time.sleep(ARXIV_DELAY)


def fetch_ctan() -> None:
    for name, (url, manuals) in CTAN.items():
        dest = OUT / "ctan" / name
        if dest.exists():
            print(f"ctan: {name} already there")
            continue
        dest.mkdir(parents=True)
        with zipfile.ZipFile(io.BytesIO(get(url))) as z:
            for n in z.namelist():
                if Path(n).name in manuals:
                    (dest / Path(n).name).write_bytes(z.read(n))
        print(f"ctan: {name}: {len(list(dest.iterdir()))} .tex files")


SOURCES = {"stacks": fetch_stacks, "arxiv": fetch_arxiv, "ctan": fetch_ctan}

if __name__ == "__main__":
    for name in sys.argv[1:] or list(SOURCES):
        SOURCES[name]()
