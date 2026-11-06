/* Shared chrome for the ML System Design study guide.
   Loads after assets/dg.js. Provides: sidebar, pager, credit, progress bar,
   active-section highlighting, table wrapping, and figure mounting for
   <script type="application/json" class="dg" data-cap="..."> blocks. */
(function () {
  var CH = [
    ["intro", "Introduction and Framework", "How every ML design answer is structured"],
    ["visual-search", "Visual Search System", "Retrieve images similar to a query image"],
    ["street-view-blurring", "Street View Blurring", "Detect faces and plates, then blur them"],
    ["youtube-video-search", "YouTube Video Search", "Text query in, ranked videos out"],
    ["harmful-content-detection", "Harmful Content Detection", "Find and act on policy-violating posts"],
    ["video-recommendation", "Video Recommendation", "Personalized video feed at huge scale"],
    ["event-recommendation", "Event Recommendation", "Short-lived items, heavy cold start"],
    ["ad-click-prediction", "Ad Click Prediction", "Predict P(click) for social-platform ads"],
    ["similar-listings", "Similar Listings", "More-like-this for rental listings"],
    ["news-feed", "Personalized News Feed", "Rank posts by predicted engagement"],
    ["people-you-may-know", "People You May Know", "Friend suggestions on a social graph"]
  ];
  var COURSE = "https://bytebytego.com/courses/machine-learning-system-design-interview";
  var OPEN = {
    "visual-search": "visual-search-system",
    "youtube-video-search": "youtube-video-search",
    "video-recommendation": "video-recommendation-system",
    "news-feed": "personalized-news-feed"
  };
  var NS = "http://www.w3.org/2000/svg";
  var slug = document.body.getAttribute("data-slug") || "index";
  var idx = CH.findIndex(function (c) { return c[0] === slug; });
  var chNo = idx + 1;

  /* progress bar */
  var pb = document.createElement("div"); pb.id = "progress"; document.body.appendChild(pb);
  function prog() { var h = document.documentElement; var m = h.scrollHeight - h.clientHeight; pb.style.width = (m > 0 ? h.scrollTop / m * 100 : 0) + "%"; }
  window.addEventListener("scroll", prog, { passive: true }); prog();

  /* shared arrowhead marker */
  var defs = document.createElementNS(NS, "svg");
  defs.setAttribute("width", "0"); defs.setAttribute("height", "0"); defs.style.position = "absolute";
  defs.innerHTML = '<defs><marker id="arr" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arrowhead"/></marker></defs>';
  document.body.insertBefore(defs, document.body.firstChild);

  /* figures: legacy .flow blocks and new script.dg blocks, in document order */
  var figN = 0;
  document.querySelectorAll(".flow, script.dg").forEach(function (el) {
    figN++;
    var cap = el.getAttribute("data-cap") || "", svg = "";
    if (el.tagName === "SCRIPT") {
      try {
        var spec = JSON.parse(el.textContent); spec.cap = cap;
        if (!window.MLDG || !window.MLDG[spec.type]) throw new Error("unknown diagram type: " + spec.type);
        svg = window.MLDG[spec.type](spec);
      } catch (e) {
        svg = '<div class="note" style="border-color:var(--bad)"><b>Diagram error (Figure ' + chNo + "." + figN + "):</b> " + String(e.message).replace(/</g, "&lt;") + "</div>";
      }
    } else {
      var rows = el.getAttribute("data-flow").split("||").map(function (r) { return r.trim(); });
      var W = 760, rowH = 112, top = 10, bh = 56, out = [];
      rows.forEach(function (r, i) {
        var label = "", body = r, m = r.match(/^([^:>]+):(.*)$/);
        if (m) { label = m[1].trim(); body = m[2]; }
        var items = body.split(">").map(function (s) { return s.trim(); });
        var n = items.length, gap = 36, pad = 28, bw = Math.min(150, (W - 2 * pad - (n - 1) * gap) / n), total = n * bw + (n - 1) * gap, x0 = (W - total) / 2, gt = top + i * rowH, by = gt + 30;
        out.push('<rect class="group" x="' + (x0 - 14) + '" y="' + gt + '" width="' + (total + 28) + '" height="' + (rowH - 14) + '" rx="10"/>');
        if (label) out.push('<text class="gl" x="' + (x0 - 4) + '" y="' + (gt + 18) + '">' + label + "</text>");
        items.forEach(function (t, k) {
          var acc = t.charAt(0) === "*"; if (acc) t = t.slice(1);
          var x = x0 + k * (bw + gap), lines = t.split("/");
          out.push('<rect class="nd ' + (acc ? "n-model" : "n-svc") + '" x="' + x + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="10"/>');
          lines.forEach(function (ln, j) { out.push('<text class="nt" x="' + (x + bw / 2) + '" y="' + (by + bh / 2 - (lines.length - 1) * 7.5 + j * 15 + 4.5) + '" text-anchor="middle" style="font-size:12px">' + ln.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>"); });
          if (k < n - 1) out.push('<path class="edge" d="M' + (x + bw + 3) + " " + (by + bh / 2) + "H" + (x + bw + gap - 3) + '" marker-end="url(#arr)"/>');
        });
      });
      svg = '<svg class="fig" viewBox="0 0 ' + W + " " + (rows.length * rowH + top) + '">' + out.join("") + "</svg>";
    }
    var fig = document.createElement("figure");
    fig.innerHTML = svg + "<figcaption><b>Figure " + chNo + "." + figN + "</b>" + cap.replace(/</g, "&lt;") + "</figcaption>";
    el.parentNode.replaceChild(fig, el);
  });

  /* fit pass: shrink node text to its box, then keep every label inside the diagram */
  function fitSvg(svg) {
    var vb = svg.viewBox.baseVal, rects = [].slice.call(svg.querySelectorAll("rect.nd"));
    [].slice.call(svg.querySelectorAll("text")).forEach(function (t) {
      if (t.getAttribute("transform")) return;
      var b;
      try { b = t.getBBox(); } catch (e) { return; }
      if (!b.width) return;
      if (t.classList.contains("nt") || t.classList.contains("ns")) {
        var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        var r = rects.filter(function (r) {
          var x = +r.getAttribute("x"), y = +r.getAttribute("y"), w = +r.getAttribute("width"), h = +r.getAttribute("height");
          return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
        })[0];
        if (r) {
          var bw = +r.getAttribute("width") - 10;
          if (b.width > bw) {
            var fs = parseFloat(getComputedStyle(t).fontSize) || 12;
            t.style.fontSize = Math.max(8.5, fs * bw / b.width) + "px";
            b = t.getBBox();
          }
        }
      }
      var dx = 0;
      if (b.x < 6) {
        dx = 6 - b.x;
        var bar0 = svg.querySelector("rect.bar");
        if (bar0 && t.getAttribute("text-anchor") === "end") {
          var bx0 = +bar0.getAttribute("x");
          if (b.x + b.width <= bx0 && b.x + b.width + dx > bx0 - 6) dx = Math.max(0, bx0 - 6 - (b.x + b.width));
        }
      } else if (b.x + b.width > vb.width - 6) dx = vb.width - 6 - (b.x + b.width);
      if (dx) t.setAttribute("transform", "translate(" + dx + " 0)");
    });
  }
  document.querySelectorAll("main svg.fig").forEach(fitSvg);

  /* wrap bare tables */
  document.querySelectorAll("main table").forEach(function (t) {
    if (t.parentNode.classList.contains("tbl")) return;
    var w = document.createElement("div"); w.className = "tbl"; t.parentNode.insertBefore(w, t); w.appendChild(t);
  });

  /* index cards */
  var cards = document.getElementById("cards");
  if (cards && !cards.children.length) cards.innerHTML = CH.map(function (c, i) {
    return '<a class="card" href="' + c[0] + '.html"><div class="n">Chapter ' + (i + 1) + '</div><div class="t">' + c[1] + '</div><div class="d">' + c[2] + "</div></a>";
  }).join("");

  /* sidebar */
  var toc = document.getElementById("toc"), main = document.querySelector("main"), links = [];
  if (toc && main) {
    var h = "<h4>Chapters</h4>" + CH.map(function (c, i) {
      return '<a href="' + c[0] + '.html"' + (c[0] === slug ? ' class="active"' : "") + ">" + (i + 1) + ". " + c[1] + "</a>";
    }).join("");
    var hs = main.querySelectorAll("h2");
    if (hs.length) {
      h += '<div class="on-page"><h4 style="margin-top:20px">On this page</h4>';
      hs.forEach(function (e, i) { if (!e.id) e.id = "s" + i; h += '<a data-sec="' + e.id + '" href="#' + e.id + '">' + e.textContent + "</a>"; });
      h += "</div>";
    }
    toc.innerHTML = h;
    links = [].slice.call(toc.querySelectorAll("a[data-sec]"));
    if (links.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-sec") === e.target.id); }); }
        });
      }, { rootMargin: "-20% 0px -70% 0px" });
      hs.forEach(function (e) { io.observe(e); });
    }
  }

  /* pager + credit */
  if (main && idx >= 0) {
    var prev = CH[idx - 1], next = CH[idx + 1], pg = document.createElement("div");
    pg.className = "pager";
    pg.innerHTML = (prev ? '<a href="' + prev[0] + '.html">&larr; ' + prev[1] + "</a>" : "<span></span>") + (next ? '<a href="' + next[0] + '.html">' + next[1] + " &rarr;</a>" : "<span></span>");
    main.appendChild(pg);
    var cr = document.createElement("div");
    cr.className = "note"; cr.style.marginTop = "28px";
    cr.innerHTML = "<b>Credit.</b> An independent study aid, written in my own words. The chapter list and structure follow " +
      "<i>Machine Learning System Design Interview</i> by <b>Ali Aminian and Alex Xu</b> (ByteByteGo). " +
      'For the authors\' full treatment of this problem, read the original: <a href="' + (OPEN[slug] ? COURSE + "/" + OPEN[slug] : COURSE) + '" target="_blank" rel="noopener">' + (OPEN[slug] ? "this chapter on ByteByteGo (free to read)" : "the ByteByteGo course") + "</a>. " +
      "Details were cross-checked against the public papers and engineering posts listed in References.";
    main.appendChild(cr);
  }

  /* interactive layer (hover, flow, drag, crosshair) */
  var lv = document.createElement("script"); lv.src = "assets/live.js";
  lv.onload = function () { var mo = document.createElement("script"); mo.src = "assets/motion.js"; document.body.appendChild(mo); };
  document.body.appendChild(lv);
})();
