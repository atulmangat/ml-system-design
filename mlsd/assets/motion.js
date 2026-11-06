/* motion.js - GIF-style autoplay layer for every diagram. Loaded by nav.js after live.js.
   - Reveal: when a figure scrolls into view it "builds itself" (bars grow, funnel stages cascade,
     stacks rise layer by layer, matrix cells ripple, curves draw, ranked lists slide in, graphs assemble).
   - Loops (only while visible, never while you interact): architecture graphs auto-walk their data flow with a
     step caption, embedding spaces glide the query between clusters, curves sweep the crosshair,
     social graphs cycle the neighbour highlight.
   - Per-figure toolbar: Replay and Pause/Play. Global "Live diagrams" switch (top bar) turns everything off.
   Uses the Web Animations API on top of the static SVG, so with JS off or reduced motion the diagrams stay static. */
(function () {
  "use strict";
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (RM || !Element.prototype.animate) return;
  var NS = "http://www.w3.org/2000/svg";
  var EASE = "cubic-bezier(.2,.8,.2,1)";
  function isLive() { return document.documentElement.getAttribute("data-live") !== "off"; }
  function $all(root, sel) { return [].slice.call(root.querySelectorAll(sel)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---- element animation helpers ---- */
  function anim(e, frames, o) {
    o = o || {};
    try {
      return e.animate(frames, { duration: o.d || 450, delay: o.delay || 0, easing: o.ease || EASE, fill: "backwards" });
    } catch (x) { return null; }
  }
  function box(e, origin) { e.style.transformBox = "fill-box"; e.style.transformOrigin = origin || "center"; }
  function pop(e, delay, origin, from) {
    box(e, origin); anim(e, [{ opacity: 0, transform: "scale(" + (from == null ? 0.4 : from) + ")" }, { opacity: 1, transform: "scale(1)" }], { delay: delay, d: 420 });
  }
  function rise(e, delay, dy) { anim(e, [{ opacity: 0, transform: "translateY(" + (dy == null ? 12 : dy) + "px)" }, { opacity: 1, transform: "none" }], { delay: delay, d: 460 }); }
  function fade(e, delay, d) { anim(e, [{ opacity: 0 }, { opacity: 1 }], { delay: delay, d: d || 380 }); }
  function draw(p, delay, dur) {
    var len; try { len = p.getTotalLength(); } catch (x) { return fade(p, delay); }
    if (!len) return;
    var dashed = getComputedStyle(p).strokeDasharray;
    if (dashed && dashed !== "none") return fade(p, delay, 600);
    anim(p, [{ strokeDasharray: len + " " + len, strokeDashoffset: len }, { strokeDasharray: len + " " + len, strokeDashoffset: 0 }], { delay: delay, d: dur || 900, ease: "ease-out" });
  }
  function bb(e) { try { return e.getBBox(); } catch (x) { return { x: 0, y: 0, width: 0, height: 0 }; } }

  /* ---- reveal per diagram type ---- */
  var REVEAL = {
    bars: function (sv) {
      var n = 0;
      $all(sv, "rect.bar").forEach(function (r) {
        var w = +r.getAttribute("width"), h = +r.getAttribute("height");
        if (w === 10 && h === 10) return; /* legend swatch */
        var horiz = h <= 14 && w > h; /* horizontal charts use 14px tall bars */
        box(r, horiz ? "left center" : "center bottom");
        var d = (n++) * 70;
        anim(r, [{ transform: horiz ? "scaleX(0)" : "scaleY(0)" }, { transform: "none" }], { delay: d, d: 700 });
        var t = r.nextElementSibling; if (t && t.tagName === "text") fade(t, d + 500, 300);
      });
    },
    funnel: function (sv) {
      $all(sv, "path.fun").forEach(function (p, i) {
        var d = i * 220; box(p, "center top");
        anim(p, [{ opacity: 0, transform: "scaleY(.2) scaleX(.6)" }, { opacity: 1, transform: "none" }], { delay: d, d: 520 });
        var s = p.nextElementSibling;
        while (s && s.tagName === "text") { fade(s, d + 260, 360); s = s.nextElementSibling; if (s && s.classList.contains("fun")) break; }
      });
    },
    stack: function (sv) {
      var kids = $all(sv, "rect.nd, path.edge, text.nt, text.ns, text.gl"), idx = 0;
      kids.forEach(function (k) {
        var b = bb(k), order = Math.max(0, Math.round((b.y - 40) / 66)), col = Math.round(b.x / 240);
        var d = order * 260 + col * 80;
        if (k.tagName === "path") draw(k, d + 180, 260); else rise(k, d, 14);
        idx++;
      });
    },
    matrix: function (sv) {
      var cells = $all(sv, "rect.cell");
      cells.forEach(function (c) {
        var b = bb(c), d = ((b.x + b.y * 1.4) / 9) | 0;
        pop(c, d, "center", 0.2);
      });
      $all(sv, "rect.cellhl").forEach(function (h) { fade(h, 900, 500); });
    },
    curve: function (sv) {
      $all(sv, "path.ln").forEach(function (p, i) { draw(p, i * 350, 1100); });
      $all(sv, "circle.mark").forEach(function (m) { pop(m, 1500, "center", 0.1); });
    },
    ranklist: function (sv) {
      var all = $all(sv, "rect.nd, text.nt, text.ns, text.gl, rect.bar, path.edge");
      all.forEach(function (k) {
        var b = bb(k), isQuery = b.x < 230, idx = isQuery ? 0 : Math.max(0, Math.round((b.y - 14) / 54)) + 1;
        if (k.tagName === "path") { draw(k, 200, 400); return; }
        if (k.classList.contains("bar")) { box(k, "left center"); anim(k, [{ transform: "scaleX(0)" }, { transform: "none" }], { delay: idx * 180 + 250, d: 600 }); return; }
        anim(k, [{ opacity: 0, transform: "translateX(" + (isQuery ? -14 : 22) + "px)" }, { opacity: 1, transform: "none" }], { delay: idx * 180, d: 480 });
      });
    },
    embed: function (sv) {
      var plot = sv.querySelector("rect.plot"); if (!plot) return;
      var pts = $all(sv, ".pt"), n = 0;
      pts.forEach(function (p) { var b = bb(p); if (b.y > +plot.getAttribute("y") + +plot.getAttribute("height")) return; pop(p, 60 + (n++) * 22, "center", 0); });
      $all(sv, "text.cl").forEach(function (t) { fade(t, 700, 500); });
      var q = sv.querySelector(".qg") || sv.querySelector("path.qry"); if (q) { box(q, "center"); anim(q, [{ opacity: 0, transform: "scale(3)" }, { opacity: 1, transform: "none" }], { delay: 900, d: 600 }); }
    },
    net: function (sv) {
      $all(sv, "line.nedge").forEach(function (l, i) { fade(l, 250 + i * 25, 400); });
      $all(sv, "g.gn, circle.nn").forEach(function (g, i) { var t = g.tagName === "circle" ? g : g; pop(t, i * 55, "center", 0.1); });
    },
    graph: function (sv) {
      $all(sv, "g.gn").forEach(function (g, i) { pop(g, i * 70, "center", 0.82); });
      $all(sv, "path.edge").forEach(function (p, i) { draw(p, 150 + i * 80, 500); });
      $all(sv, "text.elbl").forEach(function (t, i) { fade(t, 500 + i * 60, 400); });
      $all(sv, "rect.group").forEach(function (g) { fade(g, 0, 500); });
    },
    generic: function (sv) {
      $all(sv, "rect, path, circle, text, line, polygon").forEach(function (e, i) { fade(e, Math.min(i * 12, 900), 450); });
    }
  };

  function kindOf(sv) {
    if (sv.hasAttribute("data-sc")) return "curve";
    if (sv.querySelector("path.qry")) return "embed";
    if (sv.querySelector("line.nedge")) return "net";
    if (sv.querySelector("rect.cell")) return "matrix";
    if (sv.querySelector("path.fun")) return "funnel";
    if (sv.querySelector("rect.bar") && !sv.querySelector("path.edge")) return sv.querySelector("rect.nd") ? "ranklist" : "bars";
    if (sv.querySelector("path.edge") && sv.querySelectorAll("rect.nd, path.nd").length > 1 && !sv.querySelector(".gn")) return "stack";
    if (sv.querySelector("path.edge")) return "graph";
    return "generic";
  }

  /* ---- loops (return a stop function) ---- */
  var LOOP = {
    graph: function (fig, sv, ctl) {
      var btn = sv.__walkBtn; if (!btn) return null;
      var alive = true;
      (async function () {
        await sleep(2600);
        while (alive) {
          if (isLive() && !ctl.hold() && !sv.__walkRunning()) {
            btn.click();
            while (alive && sv.__walkRunning() && !ctl.hold()) await sleep(250);
            if (sv.__walkRunning()) btn.click(); /* user hovered mid-walk: hand control back */
          }
          await sleep(4200);
        }
      })();
      return function () { alive = false; if (sv.__walkRunning && sv.__walkRunning()) btn.click(); };
    },
    embed: function (fig, sv, ctl) {
      if (!sv.__moveQ) return null;
      var alive = true, pb = sv.__qPlot, pts = sv.__qPts, home = sv.__qHome;
      /* waypoints: centroid of each cluster, then home */
      var byC = {};
      pts.forEach(function (p) { var m = /c(\d)f/.exec(p.e.getAttribute("class")); var k = m ? m[1] : "0"; (byC[k] = byC[k] || []).push(p); });
      var way = Object.keys(byC).map(function (k) { var a = byC[k]; return [a.reduce(function (s, p) { return s + p.x; }, 0) / a.length, a.reduce(function (s, p) { return s + p.y; }, 0) / a.length]; });
      way.push(home);
      (async function () {
        await sleep(3000);
        var cur = home.slice(), wi = 0;
        while (alive) {
          if (!isLive() || ctl.hold() || sv.__qIsDragging()) { await sleep(400); cur = null; continue; }
          var to = way[wi++ % way.length], from = cur || home, t0 = performance.now(), dur = 1500;
          while (alive && performance.now() - t0 < dur) {
            if (ctl.hold() || sv.__qIsDragging()) break;
            var f = Math.min(1, (performance.now() - t0) / dur), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
            sv.__moveQ(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e);
            await sleep(32);
          }
          cur = to;
          await sleep(1100);
        }
      })();
      return function () { alive = false; };
    },
    curve: function (fig, sv, ctl) {
      if (!sv.__curveAt) return null;
      var alive = true, B = sv.__curveBox;
      (async function () {
        await sleep(3200);
        while (alive) {
          if (isLive() && !ctl.hold()) {
            var t0 = performance.now(), dur = 4200;
            while (alive && !ctl.hold() && performance.now() - t0 < dur) {
              var f = (performance.now() - t0) / dur, e = f * f * (3 - 2 * f);
              sv.__curveAt(B.L + B.pw * (0.04 + 0.92 * e));
              await sleep(40);
            }
            sv.__curveHide();
          }
          await sleep(5000);
        }
      })();
      return function () { alive = false; if (sv.__curveHide) sv.__curveHide(); };
    },
    net: function (fig, sv, ctl) {
      var ns = sv.__netNodes; if (!ns || !ns.length) return null;
      var alive = true;
      function ev(el, type) { try { el.dispatchEvent(new PointerEvent(type, { bubbles: false })); } catch (x) {} }
      (async function () {
        await sleep(3000);
        var i = 0;
        while (alive) {
          if (isLive() && !ctl.hold()) {
            var n = ns[i++ % ns.length]; ev(n, "pointerenter"); await sleep(1100); ev(n, "pointerleave"); await sleep(350);
          } else await sleep(500);
        }
      })();
      return function () { alive = false; ns.forEach(function (n) { ev(n, "pointerleave"); }); };
    }
  };

  /* ---- wire up each figure ---- */
  var figs = $all(document, "main figure").filter(function (f) { return f.querySelector("svg.fig"); });
  var states = [];
  figs.forEach(function (fig) {
    var sv = fig.querySelector("svg.fig"), kind = kindOf(sv), held = false, holdTimer = null, stopLoop = null, paused = false;
    var ctl = { hold: function () { return held || paused; } };
    /* toolbar: gather live.js hint/button into one row, add replay + pause */
    var bar = document.createElement("div"); bar.className = "figtools"; fig.insertBefore(bar, fig.firstChild);
    $all(fig, ".figbtn, .fighint").forEach(function (b) { bar.appendChild(b); });
    var rp = document.createElement("button"); rp.type = "button"; rp.className = "figbtn rp"; rp.textContent = "↻ Replay"; rp.title = "Replay the build-up animation";
    bar.appendChild(rp);
    var looped = !!LOOP[kind];
    var pz = null;
    if (looped) {
      pz = document.createElement("button"); pz.type = "button"; pz.className = "figbtn rp"; pz.textContent = "❚❚ Pause"; pz.title = "Pause / resume the looping demo";
      bar.appendChild(pz);
      pz.addEventListener("click", function () { paused = !paused; pz.textContent = paused ? "▶ Play" : "❚❚ Pause"; });
    }
    function play() { try { (REVEAL[kind] || REVEAL.generic)(sv); } catch (e) { if (window.console) console.warn("motion reveal skipped:", e); } }
    rp.addEventListener("click", play);
    /* interaction suppresses autoplay loops, resumes shortly after the pointer leaves */
    fig.addEventListener("pointerenter", function () { held = true; clearTimeout(holdTimer); });
    fig.addEventListener("pointerleave", function () { clearTimeout(holdTimer); holdTimer = setTimeout(function () { held = false; }, 2500); });
    var st = { fig: fig, sv: sv, play: play, started: false, vis: false, startLoop: function () { if (looped && !stopLoop) stopLoop = LOOP[kind](fig, sv, ctl); }, endLoop: function () { if (stopLoop) { stopLoop(); stopLoop = null; } } };
    states.push(st);
  });

  window.__mlsdMotion = { states: states };
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var st = states.filter(function (s) { return s.fig === e.target; })[0]; if (!st) return;
      st.vis = e.isIntersecting;
      if (e.isIntersecting) {
        if (!st.started) { st.started = true; if (isLive()) st.play(); }
        st.startLoop();
      } else st.endLoop();
    });
  }, { threshold: 0.35 }) : null;
  if (io) states.forEach(function (s) { io.observe(s.fig); });
})();
