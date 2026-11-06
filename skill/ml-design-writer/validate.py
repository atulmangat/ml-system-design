#!/usr/bin/env python3
"""Static validator for a chapter page of the ML System Design guide.
Usage: python3 -I validate.py path/to/chapter.html
Exit code 0 = all hard checks pass. Prints PASS/FAIL/WARN lines."""
import json, re, sys
from html.parser import HTMLParser

REQUIRED_H2 = ["Clarifying Requirements", "Frame the Problem as an ML Task", "Data Preparation",
               "Model Development", "Evaluation", "Serving", "Other Talking Points", "Check yourself", "References"]
KNOWN = {"graph", "embed", "funnel", "matrix", "net", "curve", "bars", "stack", "ranklist", "svg"}
KINDS = {"io", "svc", "model", "store", "data", "img", "vec", "user"}

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.h2 = []; self.cur = None; self.dg = []; self.in_dg = False; self.buf = ""
        self.text = []; self.skip = 0; self.tables = 0; self.details = 0; self.refs = 0; self.in_refs = False
        self.li_after_talk = 0; self.sect = ""; self.talk_items = 0; self.flow = 0; self.dg_caps = []
        self.dlg_turns = 0; self.callouts = 0; self.ext = []; self.in_h2 = False; self.lvls = []
    def handle_starttag(self, tag, a):
        a = dict(a); c = a.get("class", "") or ""
        if tag == "script":
            if a.get("src", "").startswith(("http", "//")): self.ext.append(a["src"])
            if "dg" in c.split(): self.in_dg = True; self.buf = ""; self.dg_caps.append(a.get("data-cap", ""))
            else: self.skip += 1
        if tag == "style": self.skip += 1
        if tag == "link" and a.get("href", "").startswith("http"): self.ext.append(a["href"])
        if tag == "h2": self.in_h2 = True; self.cur = ""
        if tag == "table": self.tables += 1
        if tag == "details":
            self.details += 1
            if a.get("data-lvl"): self.lvls.append(a["data-lvl"])
        if tag == "li" and self.sect.startswith("Other Talking"): self.talk_items += 1
        if tag == "li" and self.sect == "References": self.refs += 1
        if "flow" in c.split(): self.flow += 1
        if "turn" in c.split(): self.dlg_turns += 1
        if "callout" in c.split(): self.callouts += 1
    def handle_endtag(self, tag):
        if tag == "script":
            if self.in_dg: self.dg.append(self.buf); self.in_dg = False
            elif self.skip: self.skip -= 1
        if tag == "style" and self.skip: self.skip -= 1
        if tag == "h2" and self.in_h2:
            self.in_h2 = False; self.h2.append(self.cur.strip()); self.sect = self.cur.strip()
    def handle_data(self, d):
        if self.in_dg: self.buf += d; return
        if self.skip: return
        if self.in_h2: self.cur += d
        self.text.append(d)

def main(path):
    html = open(path, encoding="utf-8").read(); p = P(); p.feed(html)
    ok = True
    def fail(m):
        nonlocal ok; ok = False; print("FAIL", m)
    def warn(m): print("WARN", m)
    words = len(re.findall(r"\w+", " ".join(p.text)))
    print(f"INFO words={words} figures={len(p.dg)} tables={p.tables} details={p.details} refs={p.refs} talking={p.talk_items} dialogue_turns={p.dlg_turns} callouts={p.callouts}")
    # structure
    pos = -1
    for h in REQUIRED_H2:
        if h not in p.h2: fail(f"missing <h2>{h}</h2>")
        else:
            i = p.h2.index(h)
            if i < pos: fail(f"<h2>{h}</h2> out of order")
            pos = max(pos, i)
    if p.flow: fail("legacy class=flow diagrams present; convert to script.dg")
    if p.ext: fail(f"external resources not allowed: {p.ext}")
    if 'data-slug=' not in html: fail("body needs data-slug")
    if 'assets/dg.js' not in html or 'assets/nav.js' not in html or html.index('assets/dg.js') > html.index('assets/nav.js'): fail("include <script src=assets/dg.js> before <script src=assets/nav.js> at end of body")
    if 'class="dlg"' not in html: fail("clarifying requirements must use the <div class=dlg> dialogue markup")
    if 'class="summary"' not in html: fail("missing <div class=summary> problem summary")
    # thresholds
    if words < 3200: fail(f"too short: {words} words (min 3200, target 3800-5500)")
    if len(p.dg) < 14: fail(f"too few diagrams: {len(p.dg)} (min 14, target 16-22)")
    if p.tables < 4: fail(f"too few tables: {p.tables} (min 4)")
    if p.details < 4: fail(f"too few check-yourself questions: {p.details} (min 4)")
    if p.refs < 10: fail(f"too few references: {p.refs} (min 10)")
    if p.talk_items < 7: fail(f"too few talking points: {p.talk_items} (min 7)")
    if p.dlg_turns < 14: fail(f"clarifying dialogue too short: {p.dlg_turns} turns (min 14)")
    if p.details >= 4 and len(p.lvls) < p.details: warn(f"{p.details - len(p.lvls)} check-yourself questions lack data-lvl (sr|st|pr)")
    if p.lvls and (p.lvls.count("st") + p.lvls.count("pr") < 3 or "pr" not in p.lvls): warn("senior bar: want >=3 Staff/Principal questions and at least 1 Principal")
    if p.callouts < 4: warn(f"few callouts ({p.callouts}); add tip/warn/key/math callouts")
    kinds_used = set()
    # diagrams
    for n, raw in enumerate(p.dg, 1):
        tag = f"Figure {n}"
        try: s = json.loads(raw)
        except Exception as e: fail(f"{tag}: invalid JSON: {e}"); continue
        t = s.get("type"); kinds_used.add(t)
        if t not in KNOWN: fail(f"{tag}: unknown type {t}"); continue
        if not p.dg_caps[n - 1].strip(): fail(f"{tag}: missing data-cap caption")
        if t == "graph":
            cols = s.get("cols"); nodes = s.get("nodes", []); ids = {x.get("id") for x in nodes}
            if not cols or not nodes: fail(f"{tag}: graph needs cols and nodes"); continue
            occ = {}
            for x in nodes:
                for k in ("id", "t", "c", "r"):
                    if k not in x: fail(f"{tag}: node missing {k}: {x}")
                if x.get("k") and x["k"] not in KINDS: fail(f"{tag}: bad node kind {x['k']}")
                span = x.get("cs", 1)
                if x.get("c", 0) + span > cols: fail(f"{tag}: node {x.get('id')} exceeds cols={cols}")
                for cc in range(x.get("c", 0), x.get("c", 0) + span):
                    key = (cc, x.get("r"))
                    if key in occ: fail(f"{tag}: nodes {occ[key]} and {x.get('id')} overlap at col {cc} row {x.get('r')}")
                    occ[key] = x.get("id")
                if len(x.get("t", "")) > 34: warn(f"{tag}: long node title '{x['t']}'")
            for e in s.get("edges", []):
                if len(e) < 2 or e[0] not in ids or e[1] not in ids: fail(f"{tag}: edge references unknown node: {e}")
                if len(e) > 2 and isinstance(e[2], str) and len(e[2]) > 16: warn(f"{tag}: long edge label '{e[2]}' (<=16 chars; make label shorter or widen gapX)")
            if cols > 6: warn(f"{tag}: cols={cols} makes nodes narrow; prefer <= 5")
            if len(nodes) > 14: warn(f"{tag}: {len(nodes)} nodes is busy; split the diagram")
        if t == "stack" and not s.get("cols"): fail(f"{tag}: stack needs cols")
        if t == "matrix" and not (s.get("rows") and s.get("cols") and s.get("v")): fail(f"{tag}: matrix needs rows, cols, v")
        if t == "net" and not s.get("nodes"): fail(f"{tag}: net needs nodes")
        if t == "curve" and not s.get("series"): fail(f"{tag}: curve needs series")
        if t == "bars" and not (s.get("labels") and s.get("series")): fail(f"{tag}: bars needs labels and series")
        if t == "funnel" and not s.get("stages"): fail(f"{tag}: funnel needs stages")
        if t == "embed" and not s.get("clusters"): fail(f"{tag}: embed needs clusters")
    if len(kinds_used) < 4: warn(f"only {len(kinds_used)} diagram types used ({sorted(kinds_used)}); vary them where it clarifies")
    print("RESULT", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)

main(sys.argv[1])
