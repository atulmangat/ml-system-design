---
name: ml-design-writer
description: Write an ML system design interview chapter as a polished, self-contained HTML page (clarify, frame, data, model, evaluate, serve, talking points) with rich inline diagrams rendered by the guide's diagram engine. Use when asked to write up, improve, or study an ML system design problem.
---

# ML system design chapter writer

Output: ONE finished HTML page per problem, professional quality: deep content plus top-notch diagrams. Original wording only. Never paste or closely paraphrase text, figures, tables, or worked numbers from a published book or course (including bytebytego.com). Standard techniques, public papers, engineering blogs, and facts are fine; cite them in References.

Files (absolute paths):
- Pages: `ROOT/mlsd/<slug>.html` (ROOT = the scratch workspace folder; see the task prompt for the exact path)
- Shared assets (READ-ONLY for chapter authors): `ROOT/mlsd/assets/{style.css,dg.js,nav.js}`
- Reference of every diagram type and page component with exact markup: `ROOT/mlsd/gallery.html` (read its source first)
- Validator: `python3 -I ROOT/skill/ml-design-writer/validate.py ROOT/mlsd/<slug>.html`  (must print RESULT PASS)

## Hard rules
1. Edit ONLY your own chapter file. Do not touch other pages, assets, or the gallery. If you need a diagram the engine cannot draw, write a custom inline `<svg class="fig" viewBox=...>` inside a `<figure>` using the CSS classes in style.css (`nd n-svc`, `nt`, `ns`, `edge`, ...), and add a `<figcaption><b>Figure N.M</b>Caption</figcaption>` with numbering matching sequence. Prefer the engine.
2. No external scripts, fonts, styles, or images. Everything inline.
3. Use the TinyFish tools for web research (`mcp__tinyfish__search`, `mcp__tinyfish__fetch_content`) as the user's setup prefers them. Do NOT read bytebytego.com course pages.
4. Do not use the Browser pane (other agents share it). Verify only with validate.py and careful reading of your own markup.
5. Numbers must be defensible: label assumptions as assumptions; cite real papers for real figures.
6. Every claim of a metric formula or worked example must be arithmetically correct. Recompute by hand.

## Page skeleton (copy exactly, replace placeholders)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CHAPTER TITLE</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body data-slug="SLUG">
<div class="topbar"><a href="index.html">&larr; ML System Design Study Guide</a><span style="color:var(--muted)">Chapter N of 11</span></div>
<div class="layout"><aside class="toc" id="toc"></aside>
<main>
<div class="kicker">Chapter N</div>
<h1>CHAPTER TITLE</h1>
<p class="lead">Two or three sentences: what the product is, why it is hard, the core idea.</p>
<h2>Clarifying Requirements</h2> ...
<h2>Frame the Problem as an ML Task</h2> ...
<h2>Data Preparation</h2> ...
<h2>Model Development</h2> ...
<h2>Evaluation</h2> ...
<h2>Serving</h2> ...
<h2>Other Talking Points</h2> ...
<h2 class="nonum">Check yourself</h2> ...
<h2 class="nonum">References</h2> <ol class="refs">...</ol>
</main></div>
<script src="assets/dg.js"></script>
<script src="assets/nav.js"></script>
</body>
</html>
```
The pager and credit footer are added automatically by nav.js. Do not write them. The h2 titles above are mandatory and must appear in this order (validator enforces it). You may add extra h2 sections between them only if essential (e.g. "Challenges"); put them before "Other Talking Points".

## Section requirements (the bar)
Targets: 3,800-5,500 words of prose and tables, 16-22 diagrams, 5+ tables, 8+ callouts total, 10-14 references.

1. **Clarifying Requirements.** `<div class="dlg">` with 8-10 candidate/interviewer exchanges (turn markup in gallery). Cover scope, input types, scale, latency, personalization, labels and feedback signals, cold start, constraints, out of scope. End with `<div class="summary"><p>...</p></div>` (no label text; CSS adds it). Add one diagram: the product as a black box (input, output) or a UI-flow graph.
2. **Frame the Problem as an ML Task.** h3s: ML objective (when several objectives plausible, a table of options with pros and cons, then a decision callout), Input and output (diagram), ML category (compare model families in a table; diagram of the chosen formulation, e.g. embedding space, funnel, or graph).
3. **Data Preparation.** h3s: Data engineering (realistic sample tables, 2-3 rows each; state sizes and logging), Feature engineering (features by entity in a table with encoding choices; diagram of the feature pipeline or input representation), Labels (3 sources compared in a table; decision; handling imbalance, noise, delay, bias).
4. **Model Development.** Options table with trade-offs, decision; architecture diagram(s) (stack/graph); training data construction diagram (positives, negatives); loss function with a plain-language explanation and, where useful, a tiny numeric example in a `callout math`; a chart where it helps (loss/threshold/PR curve).
5. **Evaluation.** Offline metrics: for EACH candidate metric give definition, formula in words, a hand-checked mini example, its flaw, and a use/don't-use decision (table + worked-example callouts + at least one chart or matrix). Online metrics (business + engagement) and guardrail metrics in a table; a note on A/B test design pitfalls.
6. **Serving.** Full architecture graph(s) with online path and offline path (groups), named services, data stores, caches; latency and scale math (QPS, storage, memory) with explicit assumptions; failure modes and degradation; model refresh cadence; monitoring (drift, calibration, freshness); a challenges table (cold start, speed, diversity, fairness, privacy).
7. **Other Talking Points.** 8-10 bullets, each one concrete sentence with the "why it matters".
8. **Check yourself.** Target FAANG senior-and-above loops. 9-10 `<details class="ans" data-lvl="sr|st|pr">` questions (`sr` Senior fundamentals and numeric checks, `st` Staff trade-offs/operations/experimentation, `pr` Principal org/platform/strategy). Put `<p class="qa-intro">` and `<div class="qa-bar" data-qa></div>` after the h2 (assets/qa.js adds level badges, filter chips, expand/collapse and a timed Drill mode; load `<script src="assets/qa.js">` after nav.js). Staff/Principal answers: recommendation first, then trade-offs, then how to measure; end with `<p class="probe"><b>Likely follow-ups:</b> ...</p>` and `<p class="signal"><b>What makes this Staff-level:</b> ...</p>`. At least 3 Staff/Principal questions, at least 1 Principal. Cover: cost/latency frontier, rollout and rollback, experiment interference, fairness/privacy/safety with metrics, build-vs-buy or org ownership.
9. **References.** 10-14 numbered, real, linked sources (papers on arXiv/ACM, engineering blogs). No book/course pages.

Callouts: `<div class="callout tip|warn|key|math"><p>...</p></div>` (CSS adds the label). Use them for interview tips, pitfalls, the key idea of the chapter, and worked examples. At least 2 tips, 1 pitfall, 1 key, 2 math.

## Diagram standards
- 16-22 diagrams per chapter, one idea each, readable at 760px wide and on mobile. Every diagram has `data-cap` (a sentence that explains the takeaway, not just a title).
- Use a variety: `graph` (architecture, pipelines, data flow, model blocks, UI flows), `stack` (towers/layers), `embed` (embedding spaces), `funnel`, `matrix` (similarity, interaction, confusion), `net` (graphs), `curve` (PR/ROC, loss, threshold trade-offs), `bars` (metric comparisons, memory/latency math, ablations), `ranklist` (query to results).
- Graph rules: <= 5 columns, <= 12 nodes, titles <= 28 chars, subtitles <= 40 chars, edge labels <= 14 chars, use `groups` to separate online/offline or stages, use `k` kinds consistently: `io` inputs/outputs, `svc` services, `model` ML models, `store` databases/indexes, `data` documents/logs, `img`/`vec`/`user` illustrative. Highlight the chapter's key component with kind `model` or an edge `hl`.
- Illustrative data in `embed`/`curve`/`bars` must be plausible and consistent with the text. State "illustrative" in the caption when numbers are made up.
- Do not repeat the same diagram type back-to-back unless the content requires it.

## Voice
Interview coaching tone: "A candidate may...", "In an interview, discuss...". Always options, then trade-offs, then a decision with reasons. Short paragraphs, tables for comparisons, define each metric once in plain words. No filler, no marketing. No emojis.

## Workflow
1. Read this file, `gallery.html` source, `assets/style.css` and `assets/dg.js` (skim), and your existing draft `<slug>.html`.
2. Research with TinyFish: the real system's public paper/blog, 2-3 other public write-ups. Take notes on architecture, scale, metrics, pitfalls.
3. Plan the 16-22 figures first (list type + takeaway), then write the page in full, replacing the old draft.
4. Run validate.py until RESULT PASS; fix every WARN you reasonably can.
5. Re-read the file once for arithmetic and consistency (numbers in text vs. diagrams), broken HTML, and unescaped `<`/`&` in text.
6. Final reply: 5 lines max: figures count, words, any WARNs left, sources used, any engine gaps you noticed.

## Engine options added after the first chapters (all in gallery.html "More options")
- `fmt` strings for bars/matrix: "pct", "pct1", "int", "k", or "{v} ms"; matrix `t` per-cell text; curve `xticks`/`yticks`/`xlog`; embed `legend`; ranklist `vmax`/`sc`.
- Custom drawings: `<template id="t-x">` + `{"type":"svg","tpl":"t-x"}` (keeps figure numbering). Do NOT override MLDG functions in the page.
- nav.js runs a fit pass (shrinks overflowing node text, keeps labels inside the viewBox). Keep titles short regardless.
- Check the chapter in a browser after writing: no "Diagram error" notes, no text outside boxes.
- Reference links: arXiv IDs must match the cited title (verify by opening the arXiv page); prefer links you fetched.

## Live diagrams (automatic, no authoring cost)
- assets/live.js makes diagrams interactive: flowing packets and a "Walk through" button on graphs (edge order = data-flow order, so list edges in the order data moves), hover trace, draggable query in `embed` (name the clusters), crosshair readouts on `curve` (name the series), tooltips on bars/matrix/funnel/ranklist.
- Do not wrap, rename, or restyle the classes the engine emits (`edge`, `nd`, `pt`, `qry`, `nedge`, `ln`, `ov`); live.js finds diagrams by them.
- Custom `{"type":"svg"}` templates are not enhanced; prefer engine types when interactivity helps.
- assets/motion.js adds GIF-style autoplay on top: every figure builds itself on scroll-into-view (Replay button), and graphs auto-walk with a step caption, embed queries glide between clusters, curves sweep a crosshair, net graphs cycle highlights, all paused on hover. Edge order = data-flow order; name clusters and series so the readouts and captions make sense.
