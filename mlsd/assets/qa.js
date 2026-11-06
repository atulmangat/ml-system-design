/* qa.js - interactive "Check yourself" layer: level filter, expand/collapse, timed drill mode.
   Also builds the senior-readiness scorecard (radar) on pages that contain [data-scorecard].
   Everything degrades to plain <details> if JS is off. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var LV = { sr: "Senior", st: "Staff", pr: "Principal" };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function $all(r, s) { return [].slice.call(r.querySelectorAll(s)); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* ---------- Check yourself ---------- */
  var bar = document.querySelector("[data-qa]");
  if (bar) {
    var items = $all(document, "details.ans[data-lvl]"), filt = "all", drillQ = null, timer = null;
    items.forEach(function (d, i) {
      var b = el("span", "lvl lvl-" + d.getAttribute("data-lvl"), LV[d.getAttribute("data-lvl")] || "");
      var s = d.querySelector("summary"); s.insertBefore(b, s.firstChild);
    });
    var chips = el("div", "qa-chips"), counts = { all: items.length };
    items.forEach(function (d) { var l = d.getAttribute("data-lvl"); counts[l] = (counts[l] || 0) + 1; });
    var cbtn = {};
    [["all", "All"], ["sr", "Senior"], ["st", "Staff"], ["pr", "Principal"]].forEach(function (p) {
      if (!counts[p[0]]) return;
      var b = el("button", "qa-chip", p[1] + " (" + counts[p[0]] + ")"); b.type = "button"; b.setAttribute("aria-pressed", p[0] === "all" ? "true" : "false");
      b.addEventListener("click", function () { filt = p[0]; apply(); });
      chips.appendChild(b); cbtn[p[0]] = b;
    });
    var tools = el("div", "qa-tools");
    var ex = el("button", "qa-btn", "Expand all"), co = el("button", "qa-btn", "Collapse all"), dr = el("button", "qa-btn qa-drill", "🎯 Drill me");
    [ex, co, dr].forEach(function (b) { b.type = "button"; tools.appendChild(b); });
    var panel = el("div", "qa-panel"); panel.hidden = true;
    bar.appendChild(chips); bar.appendChild(tools); bar.appendChild(panel);
    function visible() { return items.filter(function (d) { return filt === "all" || d.getAttribute("data-lvl") === filt; }); }
    function apply() {
      items.forEach(function (d) { d.hidden = !(filt === "all" || d.getAttribute("data-lvl") === filt); });
      Object.keys(cbtn).forEach(function (k) { cbtn[k].setAttribute("aria-pressed", k === filt ? "true" : "false"); });
    }
    ex.addEventListener("click", function () { visible().forEach(function (d) { d.open = true; }); });
    co.addEventListener("click", function () { items.forEach(function (d) { d.open = false; }); });
    function stopTimer() { clearInterval(timer); timer = null; }
    function drill() {
      var pool = visible(); if (!pool.length) return;
      var pick; do { pick = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && pick === drillQ);
      drillQ = pick; pick.open = false; stopTimer();
      var q = pick.querySelector("summary").cloneNode(true); var bd = q.querySelector(".lvl"); if (bd) q.removeChild(bd);
      panel.hidden = false; panel.innerHTML = "";
      var head = el("div", "qa-ph"); head.appendChild(el("span", "lvl lvl-" + pick.getAttribute("data-lvl"), LV[pick.getAttribute("data-lvl")]));
      var tm = el("span", "qa-time", "2:00"); head.appendChild(tm); panel.appendChild(head);
      var qq = el("p", "qa-q"); qq.innerHTML = q.innerHTML; panel.appendChild(qq);
      panel.appendChild(el("p", "qa-hint", "Answer aloud: state a recommendation first, then trade-offs, then how you would measure it."));
      var row = el("div", "qa-row"), rv = el("button", "qa-btn", "Reveal answer"), nx = el("button", "qa-btn", "Next question"), cl = el("button", "qa-btn", "End drill");
      [rv, nx, cl].forEach(function (b) { b.type = "button"; row.appendChild(b); }); panel.appendChild(row);
      var t0 = Date.now(), total = 120;
      timer = setInterval(function () {
        var left = Math.max(0, total - Math.floor((Date.now() - t0) / 1000));
        tm.textContent = Math.floor(left / 60) + ":" + ("0" + (left % 60)).slice(-2); tm.classList.toggle("late", left === 0);
      }, 250);
      rv.addEventListener("click", function () { pick.open = true; pick.scrollIntoView({ behavior: "smooth", block: "center" }); });
      nx.addEventListener("click", drill);
      cl.addEventListener("click", function () { stopTimer(); panel.hidden = true; drillQ = null; });
    }
    dr.addEventListener("click", drill);
    apply();
  }

  /* ---------- readiness scorecard (radar) ---------- */
  var sc = document.querySelector("[data-scorecard]");
  if (sc) {
    var DIM = [
      ["Framing and metrics", "Turns a vague product ask into an ML objective, offline and online metrics, and guardrails.", ["Names a metric", "Chooses a metric and says why", "Defends metric choice, spots proxy gaps", "Ties metrics to business and long-term outcomes", "Sets org-wide metric standards"]],
      ["Data and labels", "Sources, labeling, bias, delay, sampling, leakage, and feature design.", ["Lists data sources", "Designs labels and features", "Handles bias, delay and imbalance", "Quantifies label noise and leakage, plans audits", "Designs data platforms and contracts"]],
      ["Modeling depth", "Picks architectures and losses with trade-offs; explains why they work and fail.", ["Names a model", "Compares options in a table", "Explains loss, training data and negatives", "Predicts failure modes and ablations", "Sets the multi-year modeling roadmap"]],
      ["Evaluation and experiments", "Offline metrics with worked math, A/B design, interference, long-term effects.", ["Knows AUC and A/B", "Computes metrics, picks by use case", "Designs experiments, handles pitfalls", "Counterfactual and long-term measurement", "Builds the experimentation culture"]],
      ["Systems and scale", "Architecture, latency and cost math, caching, failure and degradation, refresh.", ["Draws boxes", "Does QPS and storage math", "Plans failure modes and fallbacks", "Optimizes cost-quality frontier, rollout, monitoring", "Designs platforms across teams"]],
      ["Leadership signal", "Prioritization, risk, ownership, communication, responsible AI.", ["Follows the framework", "Explains trade-offs clearly", "Prioritizes and manages the clock", "Anticipates org, ops and risk questions", "Makes multi-team decisions, sets direction"]]
    ];
    var saved = []; try { saved = JSON.parse(store("mlsd-score") || "[]"); } catch (e) { saved = []; }
    var vals = DIM.map(function (d, i) { return typeof saved[i] === "number" ? saved[i] : 2; });
    var W = 420, cx = W / 2, cy = 200, R = 140, n = DIM.length;
    function ang(i) { return -Math.PI / 2 + i * 2 * Math.PI / n; }
    function pt(i, v) { var r = R * v / 5; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]; }
    function poly(vs) { return vs.map(function (v, i) { var p = pt(i, v); return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
    var wrap = el("div", "sc-wrap"), svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "-70 0 " + (W + 140) + " 400"); svg.setAttribute("class", "sc-radar"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Radar chart of self-assessed readiness");
    var g = "";
    [1, 2, 3, 4, 5].forEach(function (k) { g += '<polygon class="sc-ring" points="' + poly(DIM.map(function () { return k; })) + '"/>'; });
    DIM.forEach(function (d, i) { var p = pt(i, 5), lp = pt(i, 5.85); g += '<line class="sc-axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '"/><text class="sc-lbl" x="' + lp[0] + '" y="' + lp[1] + '" text-anchor="' + (Math.abs(lp[0] - cx) < 12 ? "middle" : lp[0] > cx ? "start" : "end") + '">' + d[0] + "</text>"; });
    g += '<polygon class="sc-bar sr" points="' + poly(DIM.map(function () { return 3; })) + '"/><polygon class="sc-bar st" points="' + poly(DIM.map(function () { return 4; })) + '"/>';
    g += '<polygon class="sc-me" id="sc-me" points=""/>';
    svg.innerHTML = g; wrap.appendChild(svg);
    var side = el("div", "sc-side"); wrap.appendChild(side);
    var legend = el("p", "sc-legend"); legend.innerHTML = '<span class="k k-me"></span>You <span class="k k-sr"></span>Senior bar (3) <span class="k k-st"></span>Staff bar (4)'; side.appendChild(legend);
    var verdict = el("p", "sc-verdict"); side.appendChild(verdict);
    var rows = [];
    DIM.forEach(function (d, i) {
      var row = el("div", "sc-row"), lab = el("label", null, d[0]), sl = el("input"), out = el("span", "sc-desc");
      sl.type = "range"; sl.min = 1; sl.max = 5; sl.step = 1; sl.value = vals[i]; sl.setAttribute("aria-label", d[0] + " level 1 to 5");
      lab.title = d[1];
      sl.addEventListener("input", function () { vals[i] = +sl.value; draw(); store("mlsd-score", JSON.stringify(vals)); });
      row.appendChild(lab); row.appendChild(sl); row.appendChild(out); side.appendChild(row); rows.push(out);
    });
    function draw() {
      svg.querySelector("#sc-me").setAttribute("points", poly(vals));
      rows.forEach(function (o, i) { o.textContent = vals[i] + " · " + DIM[i][2][vals[i] - 1]; });
      var min = Math.min.apply(null, vals), avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      var weak = DIM.filter(function (d, i) { return vals[i] === min; }).map(function (d) { return d[0]; });
      verdict.textContent = min >= 4 ? "Staff-ready on every axis. Focus on narrating decisions with owners and kill criteria." :
        min >= 3 ? "Senior-ready (average " + avg.toFixed(1) + "). To reach Staff, raise: " + weak.join(", ") + "." :
        "Below the Senior bar on: " + weak.join(", ") + ". Study those sections and the matching Check yourself questions first.";
    }
    sc.appendChild(wrap); draw();
  }
})();
