/* live.js - makes the rendered diagrams interactive.
   - architecture graphs: flowing data packets, hover to trace connections, "Walk through" step-by-step
   - embedding spaces: drag the query diamond; nearest neighbours and cluster vote update live
   - charts: crosshair with exact readouts
   - bars / matrix cells / funnel stages / ranked results: hover tooltips
   Everything is progressive enhancement over the static SVG; a "Live diagrams" switch in the top bar
   turns the motion off. Honors prefers-reduced-motion. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var svgs = [];

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function nums(d) { return (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number); }
  function svgPoint(sv, ev) {
    var p = sv.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
    return p.matrixTransform(sv.getScreenCTM().inverse());
  }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }

  /* ---------- global live switch ---------- */
  var liveOn = store("mlsd-live") !== "off" && !RM;
  var btn;
  function applyLive() {
    document.documentElement.setAttribute("data-live", liveOn ? "on" : "off");
    svgs.forEach(function (sv) {
      sv.classList.toggle("nolive", !liveOn);
      try { if (liveOn && sv.__vis) sv.unpauseAnimations(); else sv.pauseAnimations(); } catch (e) {}
    });
    if (btn) { btn.setAttribute("aria-pressed", liveOn ? "true" : "false"); btn.innerHTML = '<span class="lt-full">Live diagrams: </span><span class="lt-short">Live: </span>' + (liveOn ? "on" : "off"); }
  }
  var tb = document.querySelector(".topbar");
  if (tb) {
    btn = document.createElement("button");
    btn.className = "livebtn"; btn.type = "button";
    btn.title = RM ? "Your system asks for reduced motion" : "Toggle animated data flow in diagrams";
    btn.addEventListener("click", function () { liveOn = !liveOn && !RM; store("mlsd-live", liveOn ? "on" : "off"); applyLive(); });
    tb.appendChild(btn);
  }

  /* ---------- tooltip for [data-tip] ---------- */
  var tip = document.createElement("div"); tip.id = "tip"; document.body.appendChild(tip);
  document.addEventListener("pointermove", function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest("[data-tip]") : null;
    if (!t) { tip.style.display = "none"; return; }
    tip.textContent = t.getAttribute("data-tip"); tip.style.display = "block";
    var x = ev.clientX + 14, y = ev.clientY + 16, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 12;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - 12;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }, { passive: true });
  window.addEventListener("scroll", function () { tip.style.display = "none"; }, { passive: true });

  function addHint(fig, text) {
    var h = document.createElement("span"); h.className = "fighint"; h.textContent = text; fig.appendChild(h); return h;
  }

  /* ---------- architecture graphs ---------- */
  function isPart(k) {
    var c = k.classList;
    if (!c) return false;
    if (c.contains("nd-line") || c.contains("ico") || c.contains("ico-f") || c.contains("vc")) return true;
    return k.tagName === "text" && (c.contains("nt") || c.contains("ns"));
  }
  function enhGraph(fig, sv) {
    var edges = [].slice.call(sv.querySelectorAll("path.edge"));
    var shapes = [].slice.call(sv.querySelectorAll(".nd")).filter(function (e) { return e.tagName === "rect" || e.tagName === "path"; });
    if (edges.length < 2 || shapes.length < 2) return;
    /* wrap each node's parts into <g class="gn"> */
    var cur = null, nodes = [];
    [].slice.call(sv.children).forEach(function (k) {
      var c = k.classList, shape = c && c.contains("nd") && (k.tagName === "rect" || k.tagName === "path");
      if (shape) { cur = el("g", { "class": "gn" }); sv.insertBefore(cur, k); nodes.push({ g: cur, shape: k }); }
      if (cur && (shape || isPart(k))) cur.appendChild(k); else if (!shape) cur = null;
    });
    nodes.forEach(function (n) { try { n.bb = n.shape.getBBox(); } catch (e) { n.bb = { x: 0, y: 0, width: 0, height: 0 }; } });
    function hit(x, y) {
      var best = null, ba = 1e12;
      nodes.forEach(function (n) {
        var b = n.bb;
        if (x >= b.x - 5 && x <= b.x + b.width + 5 && y >= b.y - 5 && y <= b.y + b.height + 5) { var a = b.width * b.height; if (a < ba) { ba = a; best = n; } }
      });
      return best;
    }
    edges.forEach(function (e) {
      var n = nums(e.getAttribute("d") || "");
      e.__a = n.length >= 2 ? hit(n[0], n[1]) : null;
      e.__b = n.length >= 4 ? hit(n[n.length - 2], n[n.length - 1]) : null;
    });
    /* hover: trace connections */
    nodes.forEach(function (n) {
      n.g.addEventListener("pointerenter", function () {
        if (sv.classList.contains("walk")) return;
        sv.classList.add("hov"); n.g.classList.add("on");
        edges.forEach(function (e) {
          if (e.__a === n || e.__b === n) { e.classList.add("on"); if (e.__a) e.__a.g.classList.add("on"); if (e.__b) e.__b.g.classList.add("on"); }
        });
      });
      n.g.addEventListener("pointerleave", function () {
        sv.classList.remove("hov");
        [].forEach.call(sv.querySelectorAll(".on"), function (x) { x.classList.remove("on"); });
      });
    });
    /* flowing packets along every edge */
    var first = nodes[0].g, i = 0;
    edges.forEach(function (e) {
      var len; try { len = e.getTotalLength(); } catch (x) { return; }
      var dur = Math.max(1.4, len / 75), c = el("circle", { r: "3.6", "class": "pkt" });
      el("animateMotion", { path: e.getAttribute("d"), dur: dur.toFixed(2) + "s", repeatCount: "indefinite", begin: "-" + ((i++ * 0.53) % dur).toFixed(2) + "s" }, c);
      sv.insertBefore(c, first);
    });
    /* walk through */
    var b = document.createElement("button"); b.type = "button"; b.className = "figbtn"; b.textContent = "▶ Walk through";
    fig.appendChild(b);
    var timer = null, running = false;
    function clearAll() {
      sv.classList.remove("walk");
      [].forEach.call(sv.querySelectorAll(".act,.done"), function (x) { x.classList.remove("act"); x.classList.remove("done"); });
    }
    var cap = document.createElement("div"); cap.className = "walkcap"; cap.setAttribute("aria-live", "polite");
    var fc = fig.querySelector("figcaption"); if (fc) fig.insertBefore(cap, fc); else fig.appendChild(cap);
    function nm(n) { var t = n && n.g.querySelector(".nt"); return t ? t.textContent : "?"; }
    function stop() { clearTimeout(timer); running = false; b.textContent = "▶ Walk through"; clearAll(); cap.classList.remove("on"); sv.__walking = false; }
    sv.__walkBtn = b; sv.__walkRunning = function () { return running; };
    b.addEventListener("click", function () {
      if (running) { stop(); return; }
      running = true; sv.__walking = true; b.textContent = "■ Stop"; clearAll(); sv.classList.remove("hov"); sv.classList.add("walk"); cap.classList.add("on");
      var step = 0, prev = null, prevNode = null;
      if (edges[0] && edges[0].__a) edges[0].__a.g.classList.add("act");
      (function next() {
        if (prev) { prev.classList.remove("act"); prev.classList.add("done"); }
        if (prevNode) { prevNode.classList.remove("act"); prevNode.classList.add("done"); }
        if (step === 0 && edges[0] && edges[0].__a) { edges[0].__a.g.classList.remove("act"); edges[0].__a.g.classList.add("done"); }
        if (step >= edges.length) { timer = setTimeout(stop, 1400); return; }
        var e = edges[step++];
        cap.innerHTML = "<b>Step " + step + " of " + edges.length + "</b> " + nm(e.__a) + " &rarr; " + nm(e.__b);
        var fsc = sv.parentNode;
        if (e.__b && fsc && fsc.classList && fsc.classList.contains("figscroll") && fsc.scrollWidth > fsc.clientWidth + 4) {
          var nr = e.__b.g.getBoundingClientRect(), cr = fsc.getBoundingClientRect();
          fsc.scrollTo({ left: fsc.scrollLeft + (nr.left + nr.width / 2) - (cr.left + cr.width / 2), behavior: "smooth" });
        }
        e.classList.add("act"); prev = e;
        if (e.__b) { e.__b.g.classList.add("act"); prevNode = e.__b.g; } else prevNode = null;
        timer = setTimeout(next, 800);
      })();
    });
  }

  /* ---------- social graphs (net): hover trace ---------- */
  function enhNet(fig, sv) {
    var lines = [].slice.call(sv.querySelectorAll("line.nedge")), circles = [].slice.call(sv.querySelectorAll("circle.nn"));
    if (!circles.length) return;
    var nodes = circles.map(function (c) {
      var g = el("g", { "class": "gn" }); sv.insertBefore(g, c); g.appendChild(c);
      var t = g.nextSibling; if (t && t.tagName === "text") g.appendChild(t);
      return { g: g, x: +c.getAttribute("cx"), y: +c.getAttribute("cy") };
    });
    function at(x, y) { return nodes.filter(function (n) { return Math.hypot(n.x - x, n.y - y) < 3; })[0]; }
    lines.forEach(function (l) { l.__a = at(+l.getAttribute("x1"), +l.getAttribute("y1")); l.__b = at(+l.getAttribute("x2"), +l.getAttribute("y2")); });
    nodes.forEach(function (n) {
      n.g.addEventListener("pointerenter", function () {
        sv.classList.add("hov"); n.g.classList.add("on");
        lines.forEach(function (l) { if (l.__a === n || l.__b === n) { l.classList.add("on"); if (l.__a) l.__a.g.classList.add("on"); if (l.__b) l.__b.g.classList.add("on"); } });
      });
      n.g.addEventListener("pointerleave", function () { sv.classList.remove("hov"); [].forEach.call(sv.querySelectorAll(".on"), function (x) { x.classList.remove("on"); }); });
    });
    sv.__netNodes = nodes.map(function (n) { return n.g; });
    addHint(fig, "hover a node");
  }

  /* ---------- embedding space: drag the query ---------- */
  function enhEmbed(fig, sv) {
    var q = sv.querySelector("path.qry"), plot = sv.querySelector("rect.plot");
    if (!q || !plot) return;
    var pb = { x: +plot.getAttribute("x"), y: +plot.getAttribute("y"), w: +plot.getAttribute("width"), h: +plot.getAttribute("height") };
    var pts = [].slice.call(sv.querySelectorAll(".pt")).map(function (p) {
      var b = p.getBBox(); return { e: p, x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }).filter(function (p) { return p.x >= pb.x && p.x <= pb.x + pb.w && p.y >= pb.y && p.y <= pb.y + pb.h; });
    if (!pts.length) return;
    var names = {};
    [].forEach.call(sv.querySelectorAll("text.cl"), function (t) { var m = /c(\d)t/.exec(t.getAttribute("class")); if (m) names[m[1]] = t.textContent; });
    pts.forEach(function (p) { var m = /c(\d)f/.exec(p.e.getAttribute("class")); p.n = names[m ? m[1] : ""] || ("cluster " + (m ? m[1] : "?")); });
    var K = sv.querySelectorAll("line.nnl").length || 3;
    var lab = q.nextElementSibling; if (lab && !(lab.tagName === "text" && lab.classList.contains("nt"))) lab = null;
    var g = el("g", { "class": "qg" }); sv.insertBefore(g, q); g.appendChild(q); if (lab) g.appendChild(lab);
    var qb = q.getBBox(), qx0 = qb.x + qb.width / 2, qy0 = qb.y + qb.height / 2, qx = qx0, qy = qy0;
    var ro = el("text", { "class": "ro", x: pb.x + 12, y: pb.y + 18 }, sv);
    function update() {
      pts.forEach(function (p) { p.d = Math.hypot(p.x - qx, p.y - qy); });
      var order = pts.slice().sort(function (a, b) { return a.d - b.d; }), nn = order.slice(0, K);
      [].forEach.call(sv.querySelectorAll("line.nnl"), function (l) { l.parentNode.removeChild(l); });
      nn.forEach(function (p) { sv.insertBefore(el("line", { "class": "nnl", x1: qx, y1: qy, x2: p.x, y2: p.y }), pts[0].e); });
      pts.forEach(function (p) { p.e.classList.remove("hit"); });
      nn.forEach(function (p) { p.e.classList.add("hit"); });
      var tally = {}, ord = [];
      nn.forEach(function (p) { if (!tally[p.n]) { tally[p.n] = 0; ord.push(p.n); } tally[p.n]++; });
      ro.textContent = K + " nearest: " + ord.map(function (n) { return n + " ×" + tally[n]; }).join(", ");
      g.setAttribute("transform", "translate(" + (qx - qx0) + " " + (qy - qy0) + ")");
    }
    var dragging = false;
    g.addEventListener("pointerdown", function (ev) { dragging = true; g.classList.add("drag"); try { g.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault(); });
    g.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      var p = svgPoint(sv, ev);
      qx = Math.max(pb.x + 8, Math.min(pb.x + pb.w - 8, p.x)); qy = Math.max(pb.y + 8, Math.min(pb.y + pb.h - 8, p.y));
      update();
    });
    function end() { dragging = false; g.classList.remove("drag"); }
    g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
    update();
    /* hooks used by motion.js for the autoplay demo */
    sv.__moveQ = function (x, y) {
      qx = Math.max(pb.x + 8, Math.min(pb.x + pb.w - 8, x)); qy = Math.max(pb.y + 8, Math.min(pb.y + pb.h - 8, y)); update();
    };
    sv.__qHome = [qx0, qy0]; sv.__qPlot = pb; sv.__qPts = pts; sv.__qIsDragging = function () { return dragging; };
    addHint(fig, "drag the ◆ query");
  }

  /* ---------- charts: crosshair ---------- */
  function enhCurve(fig, sv) {
    var sc = sv.getAttribute("data-sc"); if (!sc) return;
    var a = sc.split(",").map(Number), L = a[0], T = a[1], pw = a[2], ph = a[3], xmin = a[4], xmax = a[5], ymin = a[6], ymax = a[7], xlog = a[8] === 1;
    var lg = function (v) { return xlog ? Math.log(v) / Math.LN10 : v; };
    var X = function (v) { return L + (lg(v) - lg(xmin)) / (lg(xmax) - lg(xmin)) * pw; };
    var Y = function (v) { return T + ph - (v - ymin) / (ymax - ymin) * ph; };
    var inv = function (px) { var f = (px - L) / pw, l = lg(xmin) + f * (lg(xmax) - lg(xmin)); return xlog ? Math.pow(10, l) : l; };
    var series = [].slice.call(sv.querySelectorAll("path.ln[data-pts]")).map(function (p) {
      var cm = /c(\d)s/.exec(p.getAttribute("class"));
      return { name: p.getAttribute("data-n"), c: cm ? cm[1] : "0", pts: p.getAttribute("data-pts").split(";").map(function (s) { var q = s.split(","); return [+q[0], +q[1]]; }) };
    });
    if (!series.length) return;
    function at(se, x) {
      var P = se.pts; if (x <= P[0][0]) return P[0][1]; if (x >= P[P.length - 1][0]) return P[P.length - 1][1];
      for (var i = 1; i < P.length; i++) if (x <= P[i][0]) { var t = (lg(x) - lg(P[i - 1][0])) / ((lg(P[i][0]) - lg(P[i - 1][0])) || 1); return P[i - 1][1] + t * (P[i][1] - P[i - 1][1]); }
      return P[P.length - 1][1];
    }
    var fmt = function (v) { return String(+v.toFixed(Math.abs(v) < 10 ? 3 : 1)); };
    var ov = el("rect", { "class": "ov", x: L, y: T, width: pw, height: ph }, sv);
    var line = el("line", { "class": "xh", x1: 0, x2: 0, y1: T, y2: T + ph, style: "display:none" }, sv);
    var dots = series.map(function (se) { return el("circle", { "class": "xd c" + se.c + "f", r: 5, style: "display:none" }, sv); });
    var box = el("g", { style: "display:none" }, sv), bg = el("rect", { "class": "xr-bg", rx: 6 }, box), txt = el("text", { "class": "xr-t" }, box);
    function show(ev) { showAt(svgPoint(sv, ev).x); }
    function showAt(rawX) {
      var px = Math.max(L, Math.min(L + pw, rawX)), x = inv(px);
      line.setAttribute("x1", px); line.setAttribute("x2", px); line.style.display = "";
      var rows = ["x = " + fmt(x)];
      series.forEach(function (se, i) { var y = at(se, x); dots[i].setAttribute("cx", px); dots[i].setAttribute("cy", Y(y)); dots[i].style.display = ""; rows.push((se.name ? se.name + ": " : "y = ") + fmt(y)); });
      while (txt.firstChild) txt.removeChild(txt.firstChild);
      var w = 0;
      rows.forEach(function (r, i) { var ts = el("tspan", { x: 0, dy: i ? 15 : 0 }, txt); ts.textContent = r; w = Math.max(w, r.length * 6.6); });
      var bw = w + 18, bh = rows.length * 15 + 12, bx = px + 14, by = T + 8;
      if (bx + bw > L + pw) bx = px - bw - 14;
      bg.setAttribute("width", bw); bg.setAttribute("height", bh); bg.setAttribute("x", 0); bg.setAttribute("y", 0);
      txt.setAttribute("x", 9); txt.setAttribute("y", 19);
      [].forEach.call(txt.children, function (ts) { ts.setAttribute("x", 9); });
      box.setAttribute("transform", "translate(" + bx + " " + by + ")"); box.style.display = "";
    }
    function hide() { line.style.display = "none"; box.style.display = "none"; dots.forEach(function (d) { d.style.display = "none"; }); }
    ov.addEventListener("pointermove", show); ov.addEventListener("pointerdown", show); ov.addEventListener("pointerleave", hide);
    sv.__curveAt = showAt; sv.__curveHide = hide; sv.__curveBox = { L: L, pw: pw };
    addHint(fig, "hover to read values");
  }

  /* ---------- init ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var sv = e.target.querySelector("svg.fig"); if (!sv) return;
      sv.__vis = e.isIntersecting;
      try { if (liveOn && sv.__vis) sv.unpauseAnimations(); else sv.pauseAnimations(); } catch (x) {}
    });
  }, { rootMargin: "120px" }) : null;

  [].slice.call(document.querySelectorAll("main figure")).forEach(function (fig) {
    var sv = fig.querySelector("svg.fig"); if (!sv) return;
    try {
      if (sv.hasAttribute("data-sc")) enhCurve(fig, sv);
      else if (sv.querySelector("path.qry")) enhEmbed(fig, sv);
      else if (sv.querySelector("line.nedge")) enhNet(fig, sv);
      else if (sv.querySelector("path.edge")) enhGraph(fig, sv);
    } catch (err) { if (window.console) console.warn("live diagram skipped:", err); }
    svgs.push(sv); sv.__vis = !io;
    if (io) io.observe(fig);
  });
  applyLive();
})();
