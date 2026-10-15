/*
    Venus Flytrap page behaviour. Plain JS, no libraries.

    - Mechanism diagram in the hero (SVG, drawn here). It is an illustration, not telemetry:
      the slider value is the slider's own value. Range (0–180°) and easing (smoothstep)
      copy the Arduino sketch so the diagram behaves like the real thing.
    - Stages sit one after another. Each signal flow lights up in order when it scrolls
      into view, to show the direction of the signal.
    - Making timeline: the rail fills as you scroll.
    - Click-to-play YouTube (nothing loads from YouTube until pressed).
    - Videos play only while visible; with reduced motion they get controls instead.
*/

(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- mechanism diagram ---------- */

  var rig = document.getElementById('vf-rig');
  if (rig) (function () {
    var slider = document.getElementById('rig-angle');
    var out = document.getElementById('rig-out');
    var A = { x: 154, y: 270 }, B = { x: 246, y: 270 };
    var TEETH = 20, RO = 50, RI = 42, PITCH = 360 / TEETH;
    var gA = document.getElementById('rig-gear-a'), gB = document.getElementById('rig-gear-b');
    var pA = document.getElementById('rig-petal-a'), pB = document.getElementById('rig-petal-b');

    function gearPath() {
      var d = '';
      for (var k = 0; k < TEETH; k++) {
        var a0 = k * PITCH;
        [[RI, 0], [RO, .22], [RO, .5], [RI, .72]].forEach(function (pt, i) {
          var a = (a0 + pt[1] * PITCH) * Math.PI / 180;
          d += (k === 0 && i === 0 ? 'M' : 'L') + (pt[0] * Math.cos(a)).toFixed(2) + ',' + (pt[0] * Math.sin(a)).toFixed(2);
        });
      }
      return d + 'Z';
    }

    function build(g, c) {
      g.setAttribute('transform', 'translate(' + c.x + ' ' + c.y + ')');
      var inner = el('g', {}, g);
      el('path', { d: gearPath() }, inner);
      el('circle', { r: 7 }, inner);
      return inner;
    }
    var innerA = build(gA, A), innerB = build(gB, B);

    function petal(g, c) {
      g.setAttribute('transform', 'translate(' + c.x + ' ' + c.y + ')');
      var inner = el('g', {}, g);
      el('line', { x1: 0, y1: 0, x2: 0, y2: -62 }, inner);
      el('path', { class: 'leaf', d: 'M0,-62 C-32,-104 -28,-172 0,-200 C28,-172 32,-104 0,-62Z' }, inner);
      var cilia = '';
      [-80, -110, -140, -165].forEach(function (y) {
        var w = 24 - Math.abs(y + 120) * 0.12;
        cilia += 'M' + (-w) + ',' + y + ' l-9,-5 M' + w + ',' + y + ' l9,-5 ';
      });
      el('path', { class: 'cilia', d: cilia }, inner);
      return inner;
    }
    var petA = petal(pA, A), petB = petal(pB, B);

    function set(angle) {
      var p = angle / 180;
      var r = 25 - p * 80;                    // petal lean: +25° (closed, leaning in) to -55° (open)
      petA.setAttribute('transform', 'rotate(' + r + ')');
      petB.setAttribute('transform', 'rotate(' + (-r) + ')');
      innerA.setAttribute('transform', 'rotate(' + r + ')');
      innerB.setAttribute('transform', 'rotate(' + (-r + PITCH / 2) + ')');   // half a pitch so the teeth interleave
      out.textContent = ('000' + Math.round(angle)).slice(-3) + '°';
      slider.value = Math.round(angle);
    }
    set(0);

    slider.addEventListener('input', function () { stopDemo(); set(+slider.value); });

    /* one demonstration sweep when the diagram first scrolls into view, using the sketch's smoothstep */
    var raf = null, demoDone = false;
    function stopDemo() { demoDone = true; if (raf) cancelAnimationFrame(raf); raf = null; }
    function ease(t) { return t * t * (3 - 2 * t); }
    function demo() {
      var t0 = performance.now(), DUR = 2000, HOLD = 500;
      (function step(now) {
        var e = now - t0, a;
        if (e < DUR) a = 180 * ease(e / DUR);
        else if (e < DUR + HOLD) a = 180;
        else if (e < 2 * DUR + HOLD) a = 180 * (1 - ease((e - DUR - HOLD) / DUR));
        else { set(0); raf = null; return; }
        set(a);
        raf = requestAnimationFrame(step);
      })(t0);
    }
    if (!reduced && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting && !demoDone) { demoDone = true; setTimeout(demo, 600); io.disconnect(); }
      }, { threshold: .5 });
      io.observe(rig);
    }
  })();

  /* ---------- stages: light the signal flow in order when a stage scrolls into view ---------- */

  var stages = document.querySelectorAll('.vf-stage');
  if ('IntersectionObserver' in window && !reduced) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); sio.unobserve(e.target); }
      });
    }, { threshold: .35 });
    stages.forEach(function (st) { sio.observe(st.querySelector('.vf-flow') || st); });
    // observe the flow, flag its stage
    stages.forEach(function (st) {
      var flow = st.querySelector('.vf-flow');
      if (!flow) return;
      sio.unobserve(st);
      new IntersectionObserver(function (es, o) {
        if (es[0].isIntersecting) { st.classList.add('in'); o.disconnect(); }
      }, { threshold: .6 }).observe(flow);
    });
  }

  /* ---------- making: timeline fills as you scroll ---------- */

  var time = document.getElementById('vf-time');
  if (time) {
    var nodes = time.querySelectorAll('.vf-node');
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = window.innerHeight, mid = vh * 0.55;
      var r = time.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (mid - r.top) / r.height));
      time.style.setProperty('--p', p.toFixed(3));
      nodes.forEach(function (n) {
        var nr = n.getBoundingClientRect();
        n.classList.toggle('done', nr.top < mid);
      });
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- click-to-play YouTube ---------- */

  document.querySelectorAll('.vf-yt-play').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + btn.getAttribute('data-id') + '?autoplay=1&rel=0';
      f.title = 'Venus Flytrap mixed reality overview (YouTube)';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'strict-origin-when-cross-origin';   // YouTube rejects embeds that send no referrer
      btn.parentNode.replaceChild(f, btn);
    });
  });

  /* ---------- videos: play only while visible ---------- */

  var vio = null;
  function watchVideos() {
    var vids = document.querySelectorAll('video[data-autoplay]');
    if (reduced) {
      vids.forEach(function (v) { v.controls = true; v.removeAttribute('loop'); });
      return;
    }
    if (!('IntersectionObserver' in window)) return;
    if (!vio) vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: .25 });
    vids.forEach(function (v) { if (!v.__w) { v.__w = true; vio.observe(v); } });
  }
  watchVideos();

  /* ---------- before / after ---------- */

  var ba = document.getElementById('vf-ba'), range = document.getElementById('ba-range');
  if (ba && range) range.addEventListener('input', function () { ba.style.setProperty('--pos', range.value + '%'); });

  /* ---------- loops table: highlight one row ---------- */

  var rows = document.querySelectorAll('button.vf-loop');
  rows.forEach(function (r) {
    r.addEventListener('click', function () {
      var on = r.getAttribute('aria-pressed') === 'true';
      rows.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      if (!on) r.setAttribute('aria-pressed', 'true');
    });
  });
})();
