/* dg.js - declarative diagram engine for the ML System Design guide.
   Usage in a page:
     <script type="application/json" class="dg" data-cap="Caption text">{ "type": "graph", ... }</script>
   Types: graph, embed, funnel, matrix, net, curve, bars, stack, ranklist.
   Each renderer returns {svg: "<svg ...>", } as a string. */
(function () {
  "use strict";
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function ta(s) { return esc(s).replace(/"/g, "&quot;"); }
  function wrap(text, maxPx, fs) {
    var cw = fs * 0.57, max = Math.max(4, Math.floor(maxPx / cw)), out = [];
    String(text).split("\n").forEach(function (para) {
      var cur = "";
      para.split(/\s+/).forEach(function (w) {
        if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
      });
      out.push(cur);
    });
    return out;
  }
  /* number formatters usable from JSON: "pct", "pct1", "int", "k", or a template like "{v} ms" */
  function mkfmt(f) {
    if (typeof f === "function") return f;
    var group = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };
    if (f === "pct") return function (v) { return Math.round(v * 100) + "%"; };
    if (f === "pct1") return function (v) { return (v * 100).toFixed(1) + "%"; };
    if (f === "int") return function (v) { return group(Math.round(v)); };
    if (f === "k") return function (v) { return v >= 1000 ? (v / (v >= 1e6 ? 1e6 : 1000)).toFixed(v >= 1e7 || (v < 1e6 && v >= 1e4) ? 0 : 1).replace(/\.0$/, "") + (v >= 1e6 ? "M" : "k") : String(+v.toFixed(2)); };
    if (typeof f === "string" && f.indexOf("{v}") >= 0) return function (v) { return f.replace("{v}", group(+v.toFixed(2))); };
    return function (v) { return String(+(+v).toFixed(2)); };
  }
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function svgOpen(W, H, cap) { return '<svg class="fig" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(cap || "diagram").replace(/"/g, "") + '">'; }

  /* geometry helpers for collision-free labels */
  function distPtSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function distBoxSeg(bx0, by0, bx1, by1, x1, y1, x2, y2) {
    var m = 9999, k;
    for (k = 0; k <= 8; k++) {
      var sx = x1 + (x2 - x1) * k / 8, sy = y1 + (y2 - y1) * k / 8;
      var cx = Math.max(bx0, Math.min(bx1, sx)), cy = Math.max(by0, Math.min(by1, sy));
      m = Math.min(m, Math.hypot(sx - cx, sy - cy));
    }
    return m;
  }
  function boxesOverlap(a, b, pad) {
    var p = pad || 0;
    return !(a[2] + p < b[0] || b[2] + p < a[0] || a[3] + p < b[1] || b[3] + p < a[1]);
  }

  /* ---------------- graph ---------------- */
  var EXTRA = { img: 30, user: 26, vec: 20 };
  function pt(n, sd) {
    if (sd === "r") return [n.x + n.w, n.y + n.h / 2];
    if (sd === "l") return [n.x, n.y + n.h / 2];
    if (sd === "t") return [n.x + n.w / 2, n.y];
    return [n.x + n.w / 2, n.y + n.h];
  }
  function autoSides(a, b) {
    var acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = a.y + a.h / 2, bcy = b.y + b.h / 2;
    if (Math.abs(acy - bcy) < 2) return acx < bcx ? ["r", "l"] : ["l", "r"];
    if (Math.abs(acx - bcx) < 2) return acy < bcy ? ["b", "t"] : ["t", "b"];
    if (bcx > acx + 4) return ["r", "l"];
    if (bcx < acx - 4) return ["l", "r"];
    return acy < bcy ? ["b", "t"] : ["t", "b"];
  }
  function route(p, sa, q, sb, corrY) {
    var Hs = function (s) { return s === "r" || s === "l"; };
    if (Hs(sa) && Hs(sb)) { if (Math.abs(p[1] - q[1]) < 1) return [p, q]; var mx = (p[0] + q[0]) / 2; return [p, [mx, p[1]], [mx, q[1]], q]; }
    if (!Hs(sa) && !Hs(sb)) { if (Math.abs(p[0] - q[0]) < 1) return [p, q]; var my = corrY != null ? corrY : (p[1] + q[1]) / 2; return [p, [p[0], my], [q[0], my], q]; }
    if (Hs(sa)) return [p, [q[0], p[1]], q];
    return [p, [p[0], q[1]], q];
  }
  function drawNode(n) {
    var k = n.k || "svc", cls = "nd n-" + k, o = [], cx = n.x + n.w / 2;
    if (k === "store") {
      var ry = 8, rx = n.w / 2;
      o.push('<path class="' + cls + '" d="M' + n.x + " " + (n.y + ry) + "a" + rx + " " + ry + " 0 0 1 " + n.w + " 0v" + (n.h - 2 * ry) + "a" + rx + " " + ry + " 0 0 1 -" + n.w + ' 0z"/>');
      o.push('<path class="nd-line" d="M' + n.x + " " + (n.y + ry) + "a" + rx + " " + ry + " 0 0 0 " + n.w + ' 0"/>');
    } else if (k === "data") {
      o.push('<path class="' + cls + '" d="M' + n.x + " " + n.y + "H" + (n.x + n.w - 12) + "L" + (n.x + n.w) + " " + (n.y + 12) + "V" + (n.y + n.h) + "H" + n.x + 'Z"/>');
      o.push('<path class="nd-line" d="M' + (n.x + n.w - 12) + " " + n.y + "V" + (n.y + 12) + "H" + (n.x + n.w) + '"/>');
    } else {
      var rr = k === "io" ? Math.min(n.h / 2, 24) : (k === "model" ? 12 : 10);
      o.push('<rect class="' + cls + '" x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + rr + '"/>');
    }
    var extra = EXTRA[k] || 0;
    if (k === "img") {
      var ix = cx - 16, iy = n.y + 9;
      o.push('<rect class="ico" x="' + ix + '" y="' + iy + '" width="32" height="22" rx="3"/><circle class="ico-f" cx="' + (ix + 9) + '" cy="' + (iy + 7) + '" r="3"/><path class="ico-f" d="M' + (ix + 2) + " " + (iy + 20) + "l8-8 5 5 6-8 9 11z\"/>");
    } else if (k === "user") {
      var uy = n.y + 8;
      o.push('<circle class="ico-f" cx="' + cx + '" cy="' + (uy + 6) + '" r="5.5"/><path class="ico-f" d="M' + (cx - 11) + " " + (uy + 22) + "a11 10 0 0 1 22 0z\"/>");
    }
    var tl = n.tl, sl = n.sl, th = tl.length * 16 + (sl.length ? 4 + sl.length * 13 : 0);
    var topExtra = (k === "img" || k === "user") ? extra : (k === "store" ? 8 : 0);
    var y0 = n.y + (n.h - th - extra - (k === "store" ? 8 : 0)) / 2 + topExtra + 12;
    tl.forEach(function (ln, i) { o.push('<text class="nt" x="' + cx + '" y="' + (y0 + i * 16) + '" text-anchor="middle">' + esc(ln) + "</text>"); });
    sl.forEach(function (ln, i) { o.push('<text class="ns" x="' + cx + '" y="' + (y0 + tl.length * 16 + 4 + i * 13) + '" text-anchor="middle">' + esc(ln) + "</text>"); });
    if (k === "vec") {
      var vals = n.vec || [0.25, 0.8, 0.5, 0.95, 0.35, 0.65], cw = 12, g = 3, tw = vals.length * cw + (vals.length - 1) * g, vx = cx - tw / 2, vy = n.y + n.h - 17;
      vals.forEach(function (v, i) { o.push('<rect class="vc" style="opacity:' + (0.15 + 0.85 * v).toFixed(2) + '" x="' + (vx + i * (cw + g)) + '" y="' + vy + '" width="' + cw + '" height="10" rx="2"/>'); });
    }
    return o.join("");
  }
  function unpackEdge(e) {
    var hasLbl = typeof e[2] === "string" || typeof e[2] === "number";
    return { from: e[0], to: e[1], lbl: hasLbl ? String(e[2]) : "", opt: (hasLbl ? e[3] : e[2]) || {} };
  }
  function graph(s) {
    var W = s.w || 760, pad = 18, cols = s.cols, grps = s.groups || [];
    var hasRowGrps = grps.some(function (g) { return g.r0 > 0; });
    var gapY = Math.max(s.gapY || 44, hasRowGrps ? 54 : 44);
    var byId = {}, rowH = {}, rowEx = {}, rowHasGrp = {};
    grps.forEach(function (g) { rowEx[g.r0] = 26; for (var r = g.r0; r <= g.r1; r++) rowHasGrp[r] = true; });
    s.nodes.forEach(function (n) { byId[n.id] = n; });

    /* Per-column adaptive gaps so horizontal edge labels never touch node or group borders */
    var baseGap = cols >= 5 ? 36 : 46;
    var gaps = [];
    for (var c = 0; c < cols - 1; c++) {
      var gpad = 0;
      grps.forEach(function (g) { if (g.c1 === c) gpad += 12; if (g.c0 === c + 1) gpad += 12; });
      gaps.push(baseGap + gpad);
    }
    (s.edges || []).forEach(function (rawE) {
      var e = unpackEdge(rawE), a = byId[e.from], b = byId[e.to];
      if (!a || !b || !e.lbl) return;
      if (a.r === b.r && Math.abs(a.c - b.c) === 1) {
        var cm = Math.min(a.c, b.c), gpad2 = 0;
        grps.forEach(function (g) { if (g.c1 === cm && g.r0 <= a.r && g.r1 >= a.r) gpad2 += 12; if (g.c0 === cm + 1 && g.r0 <= a.r && g.r1 >= a.r) gpad2 += 12; });
        var need = Math.round(e.lbl.length * 6.5 + 22) + gpad2;
        if (need > gaps[cm]) gaps[cm] = need;
      }
    });
    var totalGaps = gaps.reduce(function (acc, v) { return acc + v; }, 0);
    var nodeW = (W - 2 * pad - totalGaps) / cols;
    var colX = [pad];
    for (var ci = 1; ci < cols; ci++) colX.push(colX[ci - 1] + nodeW + gaps[ci - 1]);

    s.nodes.forEach(function (n) {
      var span = n.cs || 1;
      n.w = n.w || ((colX[n.c + span - 1] + nodeW) - colX[n.c]);
      n.tl = wrap(n.t, n.w - 14, 13);
      n.sl = n.s ? wrap(n.s, n.w - 14, 11) : [];
      var minH = n.k === "store" ? 70 : 48;
      n.h = n.h || Math.max(minH, 22 + n.tl.length * 16 + (n.sl.length ? 4 + n.sl.length * 13 : 0) + (EXTRA[n.k] || 0) + (n.k === "store" ? 8 : 0));
      rowH[n.r] = Math.max(rowH[n.r] || 0, n.h);
    });
    var maxR = 0; s.nodes.forEach(function (n) { maxR = Math.max(maxR, n.r); });
    var rowY = {}, y = 14;
    for (var r = 0; r <= maxR; r++) { y += rowEx[r] || 0; rowY[r] = y; y += (rowH[r] || 0) + gapY; }
    var H = y - gapY + 18;
    s.nodes.forEach(function (n) {
      n.x = colX[n.c] + (n.dx || 0);
      var cy = rowY[n.r] + rowH[n.r] / 2 + (n.dy || 0);
      n.y = cy - n.h / 2;
    });

    function corridorMidY(r1, r2) {
      var rTop = Math.min(r1, r2), rBot = Math.max(r1, r2);
      if (rBot - rTop !== 1) return null;
      var topEdge = rowY[rTop] + rowH[rTop] + (rowHasGrp[rTop] ? 12 : 0);
      var botEdge = rowY[rBot] - (rowEx[rBot] || 0);
      return (topEdge + botEdge) / 2;
    }

    /* Precompute edge polylines so group headers and edge labels can avoid collisions */
    var edgeInfos = [], allSegs = [];
    (s.edges || []).forEach(function (rawE) {
      var e = unpackEdge(rawE), a = byId[e.from], b = byId[e.to], opt = e.opt;
      if (!a || !b) return;
      var sd = autoSides(a, b), sa = opt.sa || sd[0], sb = opt.sb || sd[1];
      var corrY = corridorMidY(a.r, b.r);
      var P = route(pt(a, sa), sa, pt(b, sb), sb, corrY);
      for (var j = 1; j < P.length; j++) allSegs.push([P[j - 1][0], P[j - 1][1], P[j][0], P[j][1], e]);
      edgeInfos.push({ e: e, a: a, b: b, opt: opt, P: P, corrY: corrY });
    });

    var o = [svgOpen(W, H, s.cap)], lbls = [];
    grps.forEach(function (g) {
      var ns = s.nodes.filter(function (n) { return n.c >= g.c0 && n.c <= g.c1 && n.r >= g.r0 && n.r <= g.r1; });
      if (!ns.length) return;
      var x0 = Math.min.apply(null, ns.map(function (n) { return n.x; })) - 12, x1 = Math.max.apply(null, ns.map(function (n) { return n.x + n.w; })) + 12;
      var y0 = Math.min.apply(null, ns.map(function (n) { return n.y; })) - 26, y1 = Math.max.apply(null, ns.map(function (n) { return n.y + n.h; })) + 12;
      o.push('<rect class="group" x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="12"/>');
      var gw = g.t.length * 7.1, gx = x0 + 12, anchor = "start", styleAttr = "";
      if (gw > (x1 - x0) - 16) {
        gx = (x0 + x1) / 2; anchor = "middle";
        var shrink = Math.max(8.5, Math.min(11, ((x1 - x0) - 12) / Math.max(1, g.t.length * 0.65)));
        styleAttr = ' style="font-size:' + shrink.toFixed(1) + 'px"';
      } else {
        /* Find vertical edge segments crossing the group header band [y0 - 4, y0 + 22] */
        var cuts = [];
        allSegs.forEach(function (sg) {
          var sx0 = Math.min(sg[0], sg[2]), sx1 = Math.max(sg[0], sg[2]), sy0 = Math.min(sg[1], sg[3]), sy1 = Math.max(sg[1], sg[3]);
          if (sy1 >= y0 - 4 && sy0 <= y0 + 22 && sx1 - sx0 < 2 && sx0 >= x0 && sx0 <= x1) cuts.push(sx0);
        });
        cuts.sort(function (a, b) { return a - b; });
        var ptsX = [x0 + 12].concat(cuts).concat([x1 - 12]);
        for (var k = 0; k < ptsX.length - 1; k++) {
          var left = k === 0 ? ptsX[0] : ptsX[k] + 14;
          var right = k === ptsX.length - 2 ? ptsX[k + 1] : ptsX[k + 1] - 12;
          if (right - left >= gw) { gx = left; break; }
        }
      }
      o.push('<text class="gl" x="' + gx + '" y="' + (y0 + 17) + '" text-anchor="' + anchor + '"' + styleAttr + ">" + esc(g.t) + "</text>");
    });

    edgeInfos.forEach(function (info) {
      var e = info.e, opt = info.opt, P = info.P, d = "M" + P[0][0] + " " + P[0][1];
      for (var i = 1; i < P.length; i++) d += "L" + P[i][0] + " " + P[i][1];
      o.push('<path class="edge' + (opt.d ? " dash" : "") + (opt.hl ? " hl" : "") + '" d="' + d + '" marker-end="url(#arr)"/>');
      if (e.lbl) {
        var best = 0, bi = 1;
        for (var j = 1; j < P.length; j++) { var L = Math.abs(P[j][0] - P[j - 1][0]) + Math.abs(P[j][1] - P[j - 1][1]); if (L > best) { best = L; bi = j; } }
        var mx = (P[bi][0] + P[bi - 1][0]) / 2, my = (P[bi][1] + P[bi - 1][1]) / 2, horiz = Math.abs(P[bi][1] - P[bi - 1][1]) < 1;
        if (!horiz && P.length === 2 && info.corrY != null) my = info.corrY;
        if (horiz) {
          lbls.push('<text class="elbl" x="' + mx + '" y="' + (my - 6) + '" text-anchor="middle">' + esc(e.lbl) + "</text>");
        } else {
          var lw = e.lbl.length * 6.5;
          /* Check if another horizontal segment passes right through my near mx */
          var hHit = allSegs.some(function (sg) {
            return sg[4] !== e && Math.abs(sg[1] - sg[3]) < 1 && Math.abs(sg[1] - my) < 10 && Math.min(sg[0], sg[2]) <= mx + lw + 12 && Math.max(sg[0], sg[2]) >= mx - 4;
          });
          if (hHit) my -= 13;
          /* Check if placing label on the right [mx+8, mx+8+lw] hits another vertical segment or node */
          var rHit = allSegs.some(function (sg) {
            return sg[4] !== e && Math.abs(sg[0] - sg[2]) < 1 && sg[0] > mx + 2 && sg[0] < mx + lw + 14 && Math.min(sg[1], sg[3]) <= my + 6 && Math.max(sg[1], sg[3]) >= my - 10;
          }) || s.nodes.some(function (nd) {
            return nd !== info.a && nd !== info.b && mx + lw + 10 > nd.x && mx + 6 < nd.x + nd.w && my + 4 > nd.y && my - 10 < nd.y + nd.h;
          });
          if (rHit && mx - lw - 10 > 8) {
            lbls.push('<text class="elbl" x="' + (mx - 8) + '" y="' + (my + 4) + '" text-anchor="end">' + esc(e.lbl) + "</text>");
          } else {
            lbls.push('<text class="elbl" x="' + (mx + 8) + '" y="' + (my + 4) + '">' + esc(e.lbl) + "</text>");
          }
        }
      }
    });
    s.nodes.forEach(function (n) { o.push(drawNode(n)); });
    o.push(lbls.join(""));
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- embed (2-D embedding space) ---------------- */
  function embed(s) {
    var W = s.w || 760, H = s.h || 330, r = rng(s.seed || 11), pts = [], clBoxes = [], o = [svgOpen(W, H, s.cap)];
    var px0 = 24, py0 = 14, pw = W - 38, ph = H - 40;
    o.push('<rect class="plot" x="' + px0 + '" y="' + py0 + '" width="' + pw + '" height="' + ph + '" rx="10"/>');
    for (var gx = 1; gx < 8; gx++) o.push('<line class="grid" x1="' + (px0 + gx * pw / 8) + '" y1="' + py0 + '" x2="' + (px0 + gx * pw / 8) + '" y2="' + (py0 + ph) + '"/>');
    for (var gy = 1; gy < 5; gy++) o.push('<line class="grid" x1="' + px0 + '" y1="' + (py0 + gy * ph / 5) + '" x2="' + (px0 + pw) + '" y2="' + (py0 + gy * ph / 5) + '"/>');
    o.push('<text class="ns" x="' + (px0 + pw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(s.xl || "embedding dimension 1") + '</text><text class="ns" transform="translate(14 ' + (py0 + ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(s.yl || "dimension 2") + "</text>");
    var clLabels = [];
    (s.clusters || []).forEach(function (c, ci) {
      var minY = c.y, maxY = c.y;
      for (var i = 0; i < (c.k || 7); i++) {
        var gx2 = (r() + r() + r() - 1.5) * (c.r || 40) * 1.5, gy2 = (r() + r() + r() - 1.5) * (c.r || 40) * 1.5;
        var px = Math.max(px0 + 10, Math.min(px0 + pw - 10, c.x + gx2));
        var py = Math.max(py0 + 22, Math.min(py0 + ph - 10, c.y + gy2));
        pts.push({ x: px, y: py, c: c.c != null ? c.c : ci, m: c.m || "c" });
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      if (c.n) {
        var ly = minY - 11;
        if (ly < py0 + 16) ly = Math.min(py0 + ph - 8, maxY + 18);
        var lw = c.n.length * 7.2;
        clBoxes.push([c.x - lw / 2, ly - 12, c.x + lw / 2, ly + 3]);
        clLabels.push('<text class="cl c' + (c.c != null ? c.c : ci) + 't" x="' + c.x + '" y="' + ly + '" text-anchor="middle" style="paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round">' + esc(c.n) + "</text>");
      }
    });
    var q = s.query, nn = [];
    if (q) {
      var dd = pts.map(function (p, i) { return { i: i, d: Math.hypot(p.x - q.x, p.y - q.y) }; }).sort(function (a, b) { return a.d - b.d; });
      nn = dd.slice(0, s.nn || 3).map(function (e) { return e.i; });
      nn.forEach(function (i) { o.push('<line class="nnl" x1="' + q.x + '" y1="' + q.y + '" x2="' + pts[i].x + '" y2="' + pts[i].y + '"/>'); });
    }
    pts.forEach(function (p, i) {
      var hl = nn.indexOf(i) >= 0, cls = "pt c" + p.c + "f" + (hl ? " hit" : "");
      if (p.m === "s") o.push('<rect class="' + cls + '" x="' + (p.x - 5) + '" y="' + (p.y - 5) + '" width="10" height="10" rx="2"/>');
      else if (p.m === "t") o.push('<path class="' + cls + '" d="M' + p.x + " " + (p.y - 6) + "L" + (p.x + 6) + " " + (p.y + 5) + "L" + (p.x - 6) + " " + (p.y + 5) + 'Z"/>');
      else o.push('<circle class="' + cls + '" cx="' + p.x + '" cy="' + p.y + '" r="5"/>');
    });
    (s.extra || []).forEach(function (e) { o.push('<circle class="pt c' + (e.c || 0) + 'f" cx="' + e.x + '" cy="' + e.y + '" r="5"/>'); });
    o.push(clLabels.join(""));
    if (q) {
      o.push('<path class="qry" d="M' + q.x + " " + (q.y - 11) + "L" + (q.x + 11) + " " + q.y + "L" + q.x + " " + (q.y + 11) + "L" + (q.x - 11) + " " + q.y + 'Z"/>');
      var qt = q.t || "query", qw = qt.length * 7.2;
      var cands = [
        { x: q.x + 14, y: q.y + 22, a: "start", b: [q.x + 14, q.y + 9, q.x + 14 + qw, q.y + 25] },
        { x: q.x + 14, y: q.y - 12, a: "start", b: [q.x + 14, q.y - 25, q.x + 14 + qw, q.y - 9] },
        { x: q.x - 14, y: q.y + 22, a: "end", b: [q.x - 14 - qw, q.y + 9, q.x - 14, q.y + 25] },
        { x: q.x - 14, y: q.y - 12, a: "end", b: [q.x - 14 - qw, q.y - 25, q.x - 14, q.y - 9] }
      ];
      var bestC = cands[0], bestScore = -1e9;
      cands.forEach(function (cd) {
        var sc = 0;
        if (cd.b[0] < px0 + 6 || cd.b[2] > px0 + pw - 6 || cd.b[1] < py0 + 6 || cd.b[3] > py0 + ph - 6) sc -= 5000;
        clBoxes.forEach(function (cb) { if (boxesOverlap(cd.b, cb, 6)) sc -= 1000; });
        pts.forEach(function (p) { if (p.x >= cd.b[0] - 4 && p.x <= cd.b[2] + 4 && p.y >= cd.b[1] - 4 && p.y <= cd.b[3] + 4) sc -= 80; });
        if (sc > bestScore) { bestScore = sc; bestC = cd; }
      });
      o.push('<text class="nt" x="' + bestC.x + '" y="' + bestC.y + '" text-anchor="' + bestC.a + '" style="paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round">' + esc(qt) + "</text>");
    }
    if (s.legend) {
      var lgx = 30;
      s.legend.forEach(function (lg) {
        var cc = "pt c" + (lg.c != null ? lg.c : 0) + "f", my = H - 12;
        if (lg.m === "s") o.push('<rect class="' + cc + '" x="' + lgx + '" y="' + (my - 5) + '" width="10" height="10" rx="2"/>');
        else if (lg.m === "t") o.push('<path class="' + cc + '" d="M' + (lgx + 5) + " " + (my - 6) + "L" + (lgx + 11) + " " + (my + 5) + "L" + (lgx - 1) + " " + (my + 5) + 'Z"/>');
        else o.push('<circle class="' + cc + '" cx="' + (lgx + 5) + '" cy="' + my + '" r="5"/>');
        o.push('<text class="ns" x="' + (lgx + 16) + '" y="' + (my + 4) + '">' + esc(lg.t) + "</text>");
        lgx += 28 + String(lg.t).length * 6.2;
      });
    }
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- funnel ---------------- */
  function funnel(s) {
    var W = s.w || 760, st = s.stages, n = st.length, sh = 62, gap = 8, top = 12, H = top + n * (sh + gap) + 6;
    var cx = W * 0.5, last = st[n - 1] || {};
    var botNeed = Math.max(String(last.t || "").length * 7.2, String(last.s || "").length * 6.3) + 42;
    var minW = Math.max(W * 0.28, botNeed), maxW = Math.max(W * 0.54, minW + 130), o = [svgOpen(W, H, s.cap)];
    st.forEach(function (g, i) {
      var w0 = maxW - (maxW - minW) * (i / n), w1 = maxW - (maxW - minW) * ((i + 1) / n), y = top + i * (sh + gap);
      o.push('<path class="fun f' + Math.min(i, 4) + '" data-tip="' + ta(g.t + " \u2014 " + g.n + (g.s ? " \u00b7 " + g.s : "")) + '" d="M' + (cx - w0 / 2) + " " + y + "H" + (cx + w0 / 2) + "L" + (cx + w1 / 2) + " " + (y + sh) + "H" + (cx - w1 / 2) + 'Z"/>');
      o.push('<text class="nt fl" x="' + cx + '" y="' + (y + sh / 2 - 2) + '" text-anchor="middle">' + esc(g.t) + "</text>");
      if (g.s) o.push('<text class="ns fl" x="' + cx + '" y="' + (y + sh / 2 + 14) + '" text-anchor="middle">' + esc(g.s) + "</text>");
      o.push('<text class="fnum" x="' + (cx + maxW / 2 + 22) + '" y="' + (y + sh / 2 + 5) + '">' + esc(g.n) + "</text>");
      if (g.m) o.push('<text class="ns" x="' + (cx - maxW / 2 - 22) + '" y="' + (y + sh / 2 + 4) + '" text-anchor="end">' + esc(g.m) + "</text>");
    });
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- matrix ---------------- */
  function matrix(s) {
    var W = s.w || 760, R = s.rows, C = s.cols, left = 130, top = 58;
    var maxColW = Math.max.apply(null, [64].concat(C.map(function (c) { return String(c).length * 6.8 + 18; })));
    var cw = Math.min(maxColW, (W - 200) / C.length), ch = Math.min(64, (W - 220) / C.length);
    var H = top + R.length * ch + 40, o = [svgOpen(W, H, s.cap)], x0 = left + (W - left - C.length * cw) / 2;
    if (s.cl) o.push('<text class="gl" x="' + (x0 + C.length * cw / 2) + '" y="16" text-anchor="middle">' + esc(s.cl) + "</text>");
    if (s.rl) o.push('<text class="gl" x="14" y="' + (top + R.length * ch / 2) + '">' + esc(s.rl) + "</text>");
    C.forEach(function (c, j) { o.push('<text class="ns" x="' + (x0 + j * cw + cw / 2) + '" y="' + (top - 10) + '" text-anchor="middle">' + esc(c) + "</text>"); });
    R.forEach(function (rw, i) {
      o.push('<text class="ns" x="' + (x0 - 8) + '" y="' + (top + i * ch + ch / 2 + 4) + '" text-anchor="end">' + esc(rw) + "</text>");
      C.forEach(function (c, j) {
        var v = s.v[i][j], x = x0 + j * cw, y = top + i * ch;
        if (v === null || v === undefined) o.push('<rect class="cell unk" data-tip="' + ta(rw + " \u00d7 " + c + ": unknown") + '" x="' + x + '" y="' + y + '" width="' + (cw - 3) + '" height="' + (ch - 3) + '" rx="6"/><text class="nt" x="' + (x + cw / 2 - 1.5) + '" y="' + (y + ch / 2 + 4) + '" text-anchor="middle">' + esc(s.unk || "?") + "</text>");
        else o.push('<rect class="cell" data-tip="' + ta(rw + " \u00d7 " + c + ": " + (s.t && s.t[i] && s.t[i][j] != null ? s.t[i][j] : (s.fmt ? mkfmt(s.fmt)(v) : v))) + '" style="fill-opacity:' + (0.1 + 0.8 * v).toFixed(2) + '" x="' + x + '" y="' + y + '" width="' + (cw - 3) + '" height="' + (ch - 3) + '" rx="6"/><text class="nt" x="' + (x + cw / 2 - 1.5) + '" y="' + (y + ch / 2 + 4) + '" text-anchor="middle">' + (s.t && s.t[i] && s.t[i][j] != null ? esc(s.t[i][j]) : (s.fmt ? esc(mkfmt(s.fmt)(v)) : (typeof v === "number" ? v.toFixed(1) : esc(v)))) + "</text>");
        var hl = s.hl === "diag" ? i === j : (s.hl || []).some(function (p) { return p[0] === i && p[1] === j; });
        if (hl) o.push('<rect class="cellhl" x="' + (x - 1) + '" y="' + (y - 1) + '" width="' + (cw - 1) + '" height="' + (ch - 1) + '" rx="7"/>');
      });
    });
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- net (social / co-click graph) ---------------- */
  function net(s) {
    var W = s.w || 760, H = s.h || 320, o = [svgOpen(W, H, s.cap)], by = {}, placedBoxes = [];
    s.nodes.forEach(function (n) {
      var k = n.k || "fr", rad = k === "me" ? 24 : 19;
      n.rad = rad;
      n.px = 34 + n.x / 100 * (W - 68);
      n.py = 32 + n.y / 100 * (H - 64);
      by[n.id] = n;
      placedBoxes.push([n.px - rad, n.py - rad, n.px + rad, n.py + rad]);
    });
    var segs = [];
    (s.edges || []).forEach(function (e) {
      var a = by[e[0]], b = by[e[1]], op = e[2] || {};
      o.push('<line class="nedge' + (op.d ? " dash" : "") + (op.hl ? " hl" : "") + '" x1="' + a.px + '" y1="' + a.py + '" x2="' + b.px + '" y2="' + b.py + '"/>');
      segs.push({ a: a, b: b, op: op });
    });
    var subLabels = [], edgeLabels = [];
    s.nodes.forEach(function (n) {
      var k = n.k || "fr", rad = n.rad;
      o.push('<circle class="nn nn-' + k + '" cx="' + n.px + '" cy="' + n.py + '" r="' + rad + '"/><text class="nt' + (k === "me" ? " inv" : "") + '" x="' + n.px + '" y="' + (n.py + 4.5) + '" text-anchor="middle">' + esc(n.t) + "</text>");
      if (n.s) {
        var sw = n.s.length * 6.2;
        var cands = [
          { x: n.px, y: n.py + rad + 15, a: "middle", b: [n.px - sw / 2, n.py + rad + 3, n.px + sw / 2, n.py + rad + 18] },
          { x: n.px, y: n.py - rad - 7, a: "middle", b: [n.px - sw / 2, n.py - rad - 19, n.px + sw / 2, n.py - rad - 4] },
          { x: n.px + rad + 8, y: n.py + 4, a: "start", b: [n.px + rad + 8, n.py - 8, n.px + rad + 8 + sw, n.py + 7] },
          { x: n.px - rad - 8, y: n.py + 4, a: "end", b: [n.px - rad - 8 - sw, n.py - 8, n.px - rad - 8, n.py + 7] }
        ];
        var best = cands[0], bestSc = -1e9;
        cands.forEach(function (cd, idx) {
          var sc = -idx * 4;
          if (cd.b[0] < 6 || cd.b[2] > W - 6 || cd.b[1] < 4 || cd.b[3] > H - 4) sc -= 5000;
          placedBoxes.forEach(function (pb) { if (boxesOverlap(cd.b, pb, 2)) sc -= 800; });
          segs.forEach(function (sg) {
            var d = distBoxSeg(cd.b[0], cd.b[1], cd.b[2], cd.b[3], sg.a.px, sg.a.py, sg.b.px, sg.b.py);
            if (d < 4) sc -= (4 - d) * 120;
          });
          if (sc > bestSc) { bestSc = sc; best = cd; }
        });
        placedBoxes.push(best.b);
        subLabels.push('<text class="ns" x="' + best.x + '" y="' + best.y + '" text-anchor="' + best.a + '" style="paint-order:stroke;stroke:var(--fig-bg);stroke-width:5px;stroke-linejoin:round">' + esc(n.s) + "</text>");
      }
    });
    segs.forEach(function (sg) {
      if (!sg.op.l) return;
      var a = sg.a, b = sg.b, lbl = sg.op.l, lw = lbl.length * 6.2;
      var dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var cands = [];
      [0.5, 0.42, 0.58].forEach(function (t) {
        var bx = a.px + dx * t, by2 = a.py + dy * t;
        [12, -12, 18, -18].forEach(function (off) {
          var cx = bx + nx * off, cy = by2 + ny * off;
          cands.push({ x: cx, y: cy + 4, b: [cx - lw / 2, cy - 8, cx + lw / 2, cy + 6], off: Math.abs(off) + Math.abs(t - 0.5) * 10 });
        });
      });
      var best = cands[0], bestSc = -1e9;
      cands.forEach(function (cd) {
        var sc = -cd.off;
        if (cd.b[0] < 6 || cd.b[2] > W - 6 || cd.b[1] < 4 || cd.b[3] > H - 4) sc -= 5000;
        placedBoxes.forEach(function (pb) { if (boxesOverlap(cd.b, pb, 3)) sc -= 1200; });
        segs.forEach(function (other) {
          var d = distBoxSeg(cd.b[0], cd.b[1], cd.b[2], cd.b[3], other.a.px, other.a.py, other.b.px, other.b.py);
          if (d < 3) sc -= (3 - d) * 150;
        });
        if (sc > bestSc) { bestSc = sc; best = cd; }
      });
      placedBoxes.push(best.b);
      edgeLabels.push('<text class="elbl" x="' + best.x.toFixed(1) + '" y="' + best.y.toFixed(1) + '" text-anchor="middle">' + esc(lbl) + "</text>");
    });
    o.push(subLabels.join(""));
    o.push(edgeLabels.join(""));
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- curve (line chart) ---------------- */
  function curve(s) {
    var hasLegend = (s.series || []).some(function (se) { return !!se.n; });
    var W = s.w || 760, H = s.h || 320, L = 64, R = 24, T = hasLegend ? 34 : 20, B = 52, pw = W - L - R, ph = H - T - B;
    var xmin = s.xmin || 0, xmax = s.xmax != null ? s.xmax : 1, ymin = s.ymin || 0, ymax = s.ymax != null ? s.ymax : 1;
    var lg = function (v) { return s.xlog ? Math.log(v) / Math.LN10 : v; };
    function X(v) { return L + (lg(v) - lg(xmin)) / (lg(xmax) - lg(xmin)) * pw; }
    function Y(v) { return T + ph - (v - ymin) / (ymax - ymin) * ph; }
    var o = [svgOpen(W, H, s.cap)], i, ticks = s.ticks || 5;
    o[0] = o[0].replace("<svg ", '<svg data-sc="' + [L, T, pw, ph, xmin, xmax, ymin, ymax, s.xlog ? 1 : 0].join(",") + '" ');
    o.push('<rect class="plot" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/>');
    var xt = s.xticks || [], yt = s.yticks || [];
    if (!xt.length) for (i = 0; i < ticks; i++) { var tv = xmin + (xmax - xmin) * i / (ticks - 1); xt.push([tv, String(+tv.toFixed(2))]); }
    if (!yt.length) for (i = 0; i < ticks; i++) { var uv = ymin + (ymax - ymin) * i / (ticks - 1); yt.push([uv, String(+uv.toFixed(2))]); }
    xt.forEach(function (t) { o.push('<line class="grid" x1="' + X(t[0]) + '" y1="' + T + '" x2="' + X(t[0]) + '" y2="' + (T + ph) + '"/><text class="ns" x="' + X(t[0]) + '" y="' + (T + ph + 16) + '" text-anchor="middle">' + esc(t[1]) + "</text>"); });
    yt.forEach(function (t) { o.push('<line class="grid" x1="' + L + '" y1="' + Y(t[0]) + '" x2="' + (L + pw) + '" y2="' + Y(t[0]) + '"/><text class="ns" x="' + (L - 8) + '" y="' + (Y(t[0]) + 4) + '" text-anchor="end">' + esc(t[1]) + "</text>"); });
    o.push('<text class="gl" x="' + (L + pw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(s.xl || "") + '</text><text class="gl" transform="translate(16 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(s.yl || "") + "</text>");
    var curveSegs = [], lx = L;
    (s.series || []).forEach(function (se, k) {
      var ci = se.c != null ? se.c : k;
      var ptsPx = se.pts.map(function (p) { return [X(p[0]), Y(p[1])]; });
      for (var j = 1; j < ptsPx.length; j++) curveSegs.push([ptsPx[j - 1][0], ptsPx[j - 1][1], ptsPx[j][0], ptsPx[j][1]]);
      var d = ptsPx.map(function (p, j) { return (j ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
      o.push('<path class="ln c' + ci + 's' + (se.d ? " dash" : "") + '" data-n="' + ta(se.n || "") + '" data-pts="' + se.pts.map(function (p) { return p[0] + "," + p[1]; }).join(";") + '" d="' + d + '"/>');
      if (se.n) {
        o.push('<line class="ln c' + ci + 's' + (se.d ? " dash" : "") + '" x1="' + lx + '" y1="15" x2="' + (lx + 20) + '" y2="15"/>');
        o.push('<text class="nt c' + ci + 't" x="' + (lx + 26) + '" y="19">' + esc(se.n) + "</text>");
        lx += 42 + String(se.n).length * 7.0;
      }
    });
    (s.marks || []).forEach(function (m) {
      var mx = X(m.x), my = Y(m.y), mw = String(m.t || "").length * 7.0;
      o.push('<circle class="mark" cx="' + mx + '" cy="' + my + '" r="6"/>');
      var cands = [
        { x: mx + 12, y: my + 16, a: "start", b: [mx + 10, my + 3, mx + 12 + mw, my + 19] },
        { x: mx + 12, y: my - 10, a: "start", b: [mx + 10, my - 23, mx + 12 + mw, my - 7] },
        { x: mx - 12, y: my - 10, a: "end", b: [mx - 12 - mw, my - 23, mx - 10, my - 7] },
        { x: mx - 12, y: my + 16, a: "end", b: [mx - 12 - mw, my + 3, mx - 10, my + 19] }
      ];
      var best = cands[0], bestSc = -1e9;
      cands.forEach(function (cd) {
        var minD = 9999;
        curveSegs.forEach(function (sg) { minD = Math.min(minD, distBoxSeg(cd.b[0], cd.b[1], cd.b[2], cd.b[3], sg[0], sg[1], sg[2], sg[3])); });
        var sc = Math.min(minD, 24);
        if (cd.b[0] < L + 4 || cd.b[2] > L + pw - 4 || cd.b[1] < T + 4 || cd.b[3] > T + ph - 4) sc -= 5000;
        if (sc > bestSc) { bestSc = sc; best = cd; }
      });
      o.push('<text class="nt" x="' + best.x + '" y="' + best.y + '" text-anchor="' + best.a + '" style="paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round">' + esc(m.t) + "</text>");
    });
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- bars ---------------- */
  function bars(s) {
    var W = s.w || 760, n = s.labels.length, ns = s.series.length;
    var hasLeg = s.series.some(function (se) { return !!se.n; });
    var maxLb = Math.max.apply(null, [0].concat((s.labels || []).map(function (l) { return String(l).length; })));
    var L = s.horiz ? Math.max(170, Math.round(maxLb * 6.5 + 22)) : 50;
    var R = 64, T = 18, B = s.horiz ? (hasLeg ? 30 : 20) : (hasLeg ? 64 : 54);
    var dmax = Math.max.apply(null, [].concat.apply([], s.series.map(function (x) { return x.v; })));
    var max = Math.max(s.max || 0, dmax * (s.max ? 1.04 : 1.15));
    var o, H, fmt = mkfmt(s.fmt);
    if (s.horiz) {
      var rh = 18 * ns + 14; H = T + n * rh + B; o = [svgOpen(W, H, s.cap)];
      s.labels.forEach(function (lb, i) {
        var y = T + i * rh;
        o.push('<text class="ns" x="' + (L - 10) + '" y="' + (y + rh / 2 - 2) + '" text-anchor="end">' + esc(lb) + "</text>");
        s.series.forEach(function (se, k) {
          var w = (W - L - R) * se.v[i] / max;
          o.push('<rect class="bar c' + (se.c != null ? se.c : k) + 'f" data-tip="' + ta(lb + " \u00b7 " + (se.n || "value") + ": " + fmt(se.v[i])) + '" x="' + L + '" y="' + (y + 4 + k * 18) + '" width="' + Math.max(1, w) + '" height="14" rx="3"/><text class="ns" x="' + (L + w + 6) + '" y="' + (y + 15 + k * 18) + '">' + esc(fmt(se.v[i])) + "</text>");
        });
      });
    } else {
      var ph = 220; H = T + ph + B; o = [svgOpen(W, H, s.cap)];
      var gw = (W - L - R) / n, bw = Math.min(46, (gw - 24) / ns);
      o.push('<line class="axis" x1="' + L + '" y1="' + (T + ph) + '" x2="' + (W - R) + '" y2="' + (T + ph) + '"/>');
      s.labels.forEach(function (lb, i) {
        var gx = L + i * gw + gw / 2;
        s.series.forEach(function (se, k) {
          var h = ph * se.v[i] / max, x = gx - ns * bw / 2 + k * bw;
          o.push('<rect class="bar c' + (se.c != null ? se.c : k) + 'f" data-tip="' + ta(lb + " \u00b7 " + (se.n || "value") + ": " + fmt(se.v[i])) + '" x="' + x + '" y="' + (T + ph - h) + '" width="' + (bw - 4) + '" height="' + h + '" rx="3"/><text class="ns" x="' + (x + bw / 2 - 2) + '" y="' + (T + ph - h - 6) + '" text-anchor="middle">' + esc(fmt(se.v[i])) + "</text>");
        });
        wrap(lb, gw - 8, 11).forEach(function (ln, j) { o.push('<text class="ns" x="' + gx + '" y="' + (T + ph + 18 + j * 13) + '" text-anchor="middle">' + esc(ln) + "</text>"); });
      });
    }
    if (hasLeg) {
      var lw = s.series.map(function (se) { return 26 + String(se.n || "").length * 6.4; }), tot = lw.reduce(function (a, b) { return a + b; }, 0), lx = Math.max(10, W - tot - 14);
      s.series.forEach(function (se, k) {
        if (!se.n) return;
        o.push('<rect class="bar c' + (se.c != null ? se.c : k) + 'f" x="' + lx + '" y="' + (H - 16) + '" width="10" height="10" rx="2"/><text class="ns" x="' + (lx + 14) + '" y="' + (H - 7) + '">' + esc(se.n) + "</text>");
        lx += lw[k];
      });
    }
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- stack (towers / layer stacks) ---------------- */
  function stack(s) {
    var W = s.w || 760, nc = s.cols.length, cw = (W - 40) / nc, bw = Math.min(cw - 46, 230), bh = 46, gap = 20, top = 44, maxL = 0, o;
    s.cols.forEach(function (c) { maxL = Math.max(maxL, c.layers.length); });
    var join = s.join, H = top + maxL * (bh + gap) + (join ? 82 : 6);
    o = [svgOpen(W, H, s.cap)];
    s.cols.forEach(function (c, ci) {
      var cx = 20 + ci * cw + cw / 2, x = cx - bw / 2;
      o.push('<text class="gl" x="' + cx + '" y="22" text-anchor="middle">' + esc(c.t) + "</text>");
      c.layers.forEach(function (l, li) {
        var y = top + li * (bh + gap), k = l.k || (li === 0 ? "data" : "svc");
        o.push('<rect class="nd n-' + k + '" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="10"/><text class="nt" x="' + cx + '" y="' + (y + (l.s ? 20 : 28)) + '" text-anchor="middle">' + esc(l.t) + "</text>");
        if (l.s) o.push('<text class="ns" x="' + cx + '" y="' + (y + 36) + '" text-anchor="middle">' + esc(l.s) + "</text>");
        if (li < c.layers.length - 1) o.push('<path class="edge" d="M' + cx + " " + (y + bh) + "V" + (y + bh + gap) + '" marker-end="url(#arr)"/>');
      });
      if (join) {
        var ly = top + (c.layers.length - 1) * (bh + gap) + bh, jy = top + maxL * (bh + gap) + 4;
        o.push('<path class="edge" d="M' + cx + " " + ly + "V" + (jy - 8) + "H" + (W / 2) + "V" + jy + '" marker-end="url(#arr)"/>');
      }
    });
    if (join) {
      var jy2 = top + maxL * (bh + gap) + 4, jw = Math.min(280, W * 0.4);
      o.push('<rect class="nd n-model" x="' + (W / 2 - jw / 2) + '" y="' + jy2 + '" width="' + jw + '" height="52" rx="12"/><text class="nt" x="' + (W / 2) + '" y="' + (jy2 + 22) + '" text-anchor="middle">' + esc(join.t) + "</text>");
      if (join.s) o.push('<text class="ns" x="' + (W / 2) + '" y="' + (jy2 + 39) + '" text-anchor="middle">' + esc(join.s) + "</text>");
    }
    o.push("</svg>");
    return o.join("");
  }

  /* ---------------- ranklist ---------------- */
  function ranklist(s) {
    var W = s.w || 760, n = s.items.length, ih = 46, gap = 8, top = 14, H = top + Math.max(n * (ih + gap), 110) + 8, o = [svgOpen(W, H, s.cap)];
    var qx = 16, qw = 190, lx = 270, lw = W - lx - 18;
    var vmax = s.vmax || Math.max.apply(null, [1].concat(s.items.map(function (x) { return x.v || 0; })));
    o.push('<rect class="nd n-io" x="' + qx + '" y="' + top + '" width="' + qw + '" height="86" rx="12"/><text class="gl" x="' + (qx + 14) + '" y="' + (top + 22) + '">' + esc(s.ql || "Query") + '</text><text class="nt" x="' + (qx + 14) + '" y="' + (top + 46) + '">' + esc(s.q) + "</text>");
    if (s.qs) o.push('<text class="ns" x="' + (qx + 14) + '" y="' + (top + 64) + '">' + esc(s.qs) + "</text>");
    o.push('<path class="edge" d="M' + (qx + qw + 4) + " " + (top + 43) + "H" + (lx - 10) + '" marker-end="url(#arr)"/>');
    s.items.forEach(function (it, i) {
      var y = top + i * (ih + gap), bwid = 120 * Math.min(1, (it.v || 0) / vmax);
      o.push('<rect class="nd n-svc' + (it.hl ? " hl" : "") + '" data-tip="' + ta((i + 1) + ". " + it.t + (it.v != null ? " \u2014 score " + (it.sc != null ? it.sc : it.v) : "")) + '" x="' + lx + '" y="' + y + '" width="' + lw + '" height="' + ih + '" rx="10"/><text class="nt" x="' + (lx + 14) + '" y="' + (y + 20) + '">' + (i + 1) + ". " + esc(it.t) + "</text>");
      if (it.s) o.push('<text class="ns" x="' + (lx + 14) + '" y="' + (y + 36) + '">' + esc(it.s) + "</text>");
      if (it.v != null) o.push('<rect class="bar c0f" x="' + (lx + lw - 176) + '" y="' + (y + 16) + '" width="' + Math.max(2, bwid) + '" height="12" rx="3"/><text class="ns" x="' + (lx + lw - 176 + bwid + 6) + '" y="' + (y + 26) + '">' + esc(it.sc != null ? it.sc : it.v) + "</text>");
    });
    o.push("</svg>");
    return o.join("");
  }

  /* custom hand-drawn SVG held in <template id=...>: {"type":"svg","tpl":"id"} keeps automatic figure numbering */
  function svgTpl(s) { var t = document.getElementById(s.tpl); if (!t) throw new Error("missing template #" + s.tpl); return t.innerHTML; }

  window.MLDG = { svg: svgTpl, graph: graph, embed: embed, funnel: funnel, matrix: matrix, net: net, curve: curve, bars: bars, stack: stack, ranklist: ranklist };
})();
