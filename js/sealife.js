/*
    SEALIFE — autonomous agents (flocking + seek)
    ---------------------------------------------
    Original piece: Kewin Skrzekut, university project, p5.js.
    Original source is kept untouched in projects/sealife/original/.

    Fish   : Craig Reynolds' flocking (alignment / cohesion / separation),
             following Daniel Shiffman's "Coding Challenge #124: Flocking Simulation".
    Eaters : Reynolds' "seek" steering behaviour, following Shiffman's
             "The Nature of Code 5.2 — Seeking a Target".

    This file is a PORT of that sketch, not a rewrite. Two kinds of change:

    1. PRESENTATION (can be switched off with palette:'original', world:{w:400,h:800}):
         - runs in p5 instance mode, inside any element
         - the world is a fixed-area logical space (same agent density as the
           original 400x800) at the aspect ratio of its container; the canvas is
           CSS-scaled to fit
         - site palette instead of the original navy palette
         - pause / resume, off-screen pause, high-DPI, reduced motion

    2. ADDITIONS (clearly separate from the original behaviour):
         - plankton is re-seeded once it has all been eaten (reseed:true)
         - feed(): the viewer can drop extra plankton
         - adaptive quality: drops pixel density, then fish count, if frames run slow

    BEHAVIOUR KEPT EXACTLY (so trajectories match the original frame for frame):
         - 200 fish (the original loops twice over 100), 100 plankton, 2 eaters
         - the fish update loop runs twice per frame (PASSES_PER_FRAME = 2).
           That looks like an accident in the original, but it is what makes the
           school move the way it does, so it is kept and named.
         - radii 25 / 50 / 24, maxForce 0.2, maxSpeed 5, eat distance 5
         - the neighbour search is one loop instead of three, with a cheap
           squared-distance prefilter. Same arithmetic, same summation order.
           test/equivalence.py checks this against the untouched original.
*/

(function (global) {
  'use strict';

  /* ORIGINAL CONSTANTS */

  const FISH_COUNT = 200;          // two loops of 100 in the original (its comments say 100)
  const PLANKTON_COUNT = 100;
  const PASSES_PER_FRAME = 2;      // fish update loop runs twice per frame in the original
  const EAT_DISTANCE = 5;
  const ORIGINAL_AREA = 400 * 800; // logical world area, in px²
  const ALIGN_R = 25, COHESION_R = 50, SEPARATION_R = 24;
  const MAX_FORCE = 0.2, MAX_SPEED = 5;
  const PREFILTER = COHESION_R * COHESION_R * (1 + 1e-9);   // coarse squared-distance cut

  /* ADDITIONS */

  const FED_CAP = 30;              // extra plankton viewers can have in the water at once
  const RESEED_DELAY_FRAMES = 90;
  const TRAIL_CLEAN_EVERY = 4, TRAIL_CLEAN_ALPHA = 28;  // pause between "all eaten" and the next batch

  /* PALETTES */

  const PALETTES = {
    site: {
      bg: [64, 61, 63],
      ramp: [[159, 197, 90], [212, 196, 91], [217, 75, 104], [156, 99, 163]],  // green → yellow → red → purple
      eaters: [[159, 197, 90], [156, 99, 163]],
      planktonA: [159, 197, 90],
      planktonB: [243, 241, 237]
    },
    original: {
      bg: [20, 40, 100]
    }
  };

  function lerpRamp(ramp, t) {
    const seg = (ramp.length - 1) * t;
    const i = Math.min(ramp.length - 2, Math.floor(seg));
    const f = seg - i;
    const a = ramp[i], b = ramp[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  const reducedMotionQuery = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------- */

  function create(options) {

    const opts = Object.assign({
      parent: null,
      palette: 'site',              // 'site' | 'original'
      world: 'viewport',            // 'viewport' | { w, h }
      fit: 'cover',                 // 'cover' (CSS-scaled to the container) | 'native'
      passes: PASSES_PER_FRAME,
      reseed: true,
      autoQuality: true,
      reducedMotion: reducedMotionQuery ? reducedMotionQuery.matches : false,
      warmupFrames: 240,            // reduced motion: frames simulated before the still frame is shown
      maxDensity: 2,
      onReady: null,
      onQuality: null
    }, options);

    const parentEl = typeof opts.parent === 'string' ? document.querySelector(opts.parent) : opts.parent;
    const palette = PALETTES[opts.palette] || PALETTES.site;
    const siteMode = opts.palette !== 'original';

    /* state shared between p5 callbacks and the controller */

    let p = null;
    let ready = false;
    let userPaused = !!opts.reducedMotion;  // reduced motion starts paused (on a warmed-up frame)
    let inView = true;
    let pageVisible = !document.hidden;
    let W = 0, H = 0;
    let fish = [], plankton = [], eaters = [];
    let fishColours = [];
    let cycle = 1;
    let reseedWait = -1;
    let qualityLevel = 0;               // 0 full · 1 density 1 · 2 150 fish · 3 100 fish
    let frameMs = 16.7, lastNow = 0, settle = 0, cooldown = 0;
    let density = 1;
    let scratch = null;
    let cleanTick = 0;

    /* ---- world size --------------------------------------------------- */

    function containerSize() {
      const w = parentEl ? parentEl.clientWidth : 0;
      const h = parentEl ? parentEl.clientHeight : 0;
      return [w || global.innerWidth, h || global.innerHeight];
    }

    function worldFor(cw, ch) {
      if (opts.world !== 'viewport') return [opts.world.w, opts.world.h];
      const aspect = Math.min(3, Math.max(0.35, cw / ch));
      return [Math.round(Math.sqrt(ORIGINAL_AREA * aspect)), Math.round(Math.sqrt(ORIGINAL_AREA / aspect))];
    }

    function densityFor(cw) {
      if (qualityLevel >= 1) return 1;
      const scale = cw / W;
      const dpr = global.devicePixelRatio || 1;
      return Math.min(opts.maxDensity, Math.max(1, scale * dpr));
    }

    function styleCanvas() {
      if (opts.fit !== 'cover') return;
      const s = p.canvas.style;
      s.setProperty('width', '100%', 'important');
      s.setProperty('height', '100%', 'important');
      s.setProperty('object-fit', 'cover', 'important');
      s.setProperty('display', 'block', 'important');
    }

    function paintBackground() {
      p.background(palette.bg[0], palette.bg[1], palette.bg[2]);
    }

    /* ---- agents ------------------------------------------------------- */

    class Fish {
      constructor(x, y) {
        this.position = p.createVector(x, y);
        this.velocity = p5.Vector.random2D();
        this.velocity.setMag(p.random(2, 4));
        this.acceleration = p.createVector();
        this.maxForce = MAX_FORCE;
        this.maxSpeed = MAX_SPEED;
      }

      /* Align + cohesion + separation in ONE pass over the school.
         The original makes three passes (one per rule). The arithmetic is the
         same: neighbours are visited in the same order, sums accumulate in the
         same order, and the steering maths still goes through p5.Vector. */
      stock(school) {
        const px = this.position.x, py = this.position.y;
        let aN = 0, ax = 0, ay = 0;
        let cN = 0, cx = 0, cy = 0;
        let sN = 0, sx = 0, sy = 0;

        for (let j = 0; j < school.length; j++) {
          const o = school[j];
          if (o === this) continue;
          const ox = o.position.x, oy = o.position.y;
          const dx = ox - px, dy = oy - py;
          if (dx * dx + dy * dy >= PREFILTER) continue;     // cannot be inside any radius
          const d = Math.hypot(dx, dy);                      // exactly what p5's dist() computes

          if (d < ALIGN_R) { ax += o.velocity.x; ay += o.velocity.y; aN++; }
          if (d < COHESION_R) { cx += ox; cy += oy; cN++; }
          if (d < SEPARATION_R) {
            let ddx = px - ox, ddy = py - oy;
            const dd = d * d;
            if (Number.isFinite(dd) && dd !== 0) { ddx /= dd; ddy /= dd; }   // p5's div() ignores 0 / NaN
            sx += ddx; sy += ddy; sN++;
          }
        }

        const a = scratch;
        // alignment
        a.set(ax, ay);
        if (aN > 0) { a.div(aN); a.setMag(this.maxSpeed); a.sub(this.velocity); a.limit(this.maxForce); }
        this.acceleration.add(a);
        // cohesion
        a.set(cx, cy);
        if (cN > 0) { a.div(cN); a.sub(this.position); a.setMag(this.maxSpeed); a.sub(this.velocity); a.limit(this.maxForce); }
        this.acceleration.add(a);
        // separation
        a.set(sx, sy);
        if (sN > 0) { a.div(sN); a.setMag(this.maxSpeed); a.sub(this.velocity); a.limit(this.maxForce); }
        this.acceleration.add(a);
      }

      update() {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        this.acceleration.mult(0);
      }

      show(i) {
        p.strokeWeight(i % 11 + 1);
        if (siteMode) p.stroke(fishColours[i]);
        else p.stroke(255, 255 % i + i, 100 - i, 100);       // original formula (fish 0 gets NaN, as before)
        p.point(this.position.x, this.position.y);
      }

      edges() {
        if (this.position.x > W) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = W;
        if (this.position.y > H) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = H;
      }
    }

    class AlgaeEater {
      constructor(x, y, shade, tint) {
        this.pos = p.createVector(x, y);
        this.vel = p.createVector(0, 0);
        this.acc = p.createVector(0, 0);
        this.maxSpeed = MAX_SPEED;
        this.maxForce = MAX_FORCE;
        this.r = 16;
        this.shade = shade;     // the number the original passes to show()
        this.tint = tint;       // site-palette colour
      }

      seek(target) {
        const force = p5.Vector.sub(target, this.pos);
        force.setMag(this.maxSpeed);
        force.sub(this.vel);
        force.limit(this.maxForce);
        this.acc.add(force);
      }

      update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
      }

      show() {
        p.noStroke();
        if (siteMode) p.fill(this.tint[0], this.tint[1], this.tint[2], 180);
        else p.fill(100 % this.shade, 250 - this.shade, 255, 180);
        p.push();
        p.translate(this.pos.x, this.pos.y);
        p.rotate(this.vel.heading());
        p.triangle(-this.r / 4, -this.r / 2, -this.r, this.r / 2, this.r, 0);
        p.rect(-this.r / 2, -this.r / 4, this.r);
        p.ellipse(this.r / 2, -this.r / 2, this.r);
        p.pop();
      }

      edges() {
        if (this.pos.x > W + this.r) this.pos.x = -this.r;
        else if (this.pos.x < -this.r) this.pos.x = W + this.r;
        if (this.pos.y > H + this.r) this.pos.y = -this.r;
        else if (this.pos.y < -this.r) this.pos.y = H + this.r;
      }

      eat(list) {
        let record = Infinity;
        let closest = -1;
        for (let i = 0; i < list.length; i++) {
          const distance = this.pos.dist(list[i]);
          if (distance < record) { record = distance; closest = i; }
        }
        if (record < EAT_DISTANCE) list.splice(closest, 1);
        else if (closest > -1) this.seek(list[closest]);
      }
    }

    /* ---- setup of the population ------------------------------------- */

    function buildColours() {
      fishColours = [];
      if (!siteMode) return;
      for (let i = 0; i < FISH_COUNT; i++) {
        const c = lerpRamp(palette.ramp, i / (FISH_COUNT - 1));
        fishColours.push(p.color(c[0], c[1], c[2], 100));
      }
    }

    /* Same order of random() calls as the original setup(), so a seeded
       Math.random gives the same starting population. */
    function populate() {
      fish = []; plankton = []; eaters = [];
      for (let i = 0; i < 100; i++) {
        const x1 = p.random(0, W / 2);
        const y1 = p.random(0, H / 2);
        fish.push(new Fish(x1, y1));
      }
      eaters.push(new AlgaeEater(100, 100, 200, siteMode ? palette.eaters[0] : null));
      eaters.push(new AlgaeEater(W + 16, H + 16, 100, siteMode ? palette.eaters[1] : null));
      for (let j = 0; j < 100; j++) {
        const x2 = p.random(0, W / 2);
        const y2 = p.random(0, H / 2);
        plankton.push(p.createVector(p.random(0, W), p.random(0, H)));
        fish.push(new Fish(x2, y2));
      }
    }

    function seedPlankton() {
      for (let k = 0; k < PLANKTON_COUNT; k++) plankton.push(p.createVector(p.random(0, W), p.random(0, H)));
    }

    /* ---- one frame ---------------------------------------------------- */

    function frame() {

      if (siteMode) {
        p.background(palette.bg[0], palette.bg[1], palette.bg[2], 10);
        /* An 8-bit canvas cannot fade the last ~12 levels at alpha 10 (the step rounds to
           zero), so coloured trails would leave a permanent stain on the background.
           A stronger fade every few frames clears it. Site palette only. */
        if (++cleanTick % TRAIL_CLEAN_EVERY === 0) p.background(palette.bg[0], palette.bg[1], palette.bg[2], TRAIL_CLEAN_ALPHA);
      } else p.background(20, 40, 100, 10);

      for (let pass = 0; pass < opts.passes; pass++) {
        p.push();
        for (let i = 0; i < fish.length; i++) {
          const f = fish[i];
          f.edges();
          f.stock(fish);
          f.update();
          f.show(i);
        }
        p.pop();
      }

      p.noStroke();
      for (let k = 0; k < plankton.length; k++) {
        if (siteMode) {
          const t = p.random();
          const A = palette.planktonA, B = palette.planktonB;
          p.fill(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, 20);
        } else {
          p.fill(p.random(0, 10), p.random(10, 255), p.random(200, 220), 20);
        }
        p.ellipse(plankton[k].x, plankton[k].y, p.random(0, 10));
      }

      for (let e = 0; e < eaters.length; e++) {
        const a = eaters[e];
        a.edges();
        a.eat(plankton);
        a.update();
        a.show();
      }

      /* addition: when the water is clear, grow a new batch */
      if (opts.reseed) {
        if (plankton.length === 0) {
          if (reseedWait < 0) reseedWait = RESEED_DELAY_FRAMES;
          else if (--reseedWait === 0) { seedPlankton(); cycle++; reseedWait = -1; }
        }
      }
    }

    /* ---- quality ladder ------------------------------------------------ */

    function monitor() {
      const now = performance.now();
      const dt = now - lastNow;
      lastNow = now;
      if (settle > 0) { settle--; return; }           // ignore the first frames after a (re)start
      if (dt > 250) return;                            // tab was throttled, not slow rendering
      frameMs += (dt - frameMs) * 0.05;
      if (cooldown > 0) { cooldown--; return; }
      if (opts.autoQuality && frameMs > 24 && qualityLevel < 3) stepDownQuality();
    }

    function stepDownQuality() {
      qualityLevel++;
      cooldown = 180;
      frameMs = 16.7;
      if (qualityLevel === 1) {
        density = 1;
        p.pixelDensity(1);
        styleCanvas();
        paintBackground();
      } else {
        fish.length = qualityLevel === 2 ? 150 : 100;
      }
      if (opts.onQuality) opts.onQuality(qualityLevel, fish.length);
    }

    /* ---- running state -------------------------------------------------- */

    function shouldRun() { return ready && !userPaused && inView && pageVisible; }

    function sync() {
      if (!ready) return;
      if (shouldRun()) {
        if (!p.isLooping()) { settle = 10; lastNow = performance.now(); p.loop(); }
      } else if (p.isLooping()) {
        p.noLoop();
      }
    }

    function onVisibility() { pageVisible = !document.hidden; sync(); }
    document.addEventListener('visibilitychange', onVisibility);

    /* ---- resize ---------------------------------------------------------- */

    let resizeObserver = null;
    let resizeTimer = null;
    let lastCW = 0, lastCH = 0;

    function handleResize() {
      if (!ready || opts.world !== 'viewport') { if (ready) { styleCanvas(); } return; }
      const [cw, ch] = containerSize();
      const widthChanged = Math.abs(cw - lastCW) > 1;
      const heightFrac = lastCH ? Math.abs(ch - lastCH) / lastCH : 1;
      // Height-only changes under 15% (mobile URL bar) are ignored: the canvas just re-covers.
      if (!widthChanged && heightFrac < 0.15) return;
      lastCW = cw; lastCH = ch;

      const [nw, nh] = worldFor(cw, ch);
      if (nw === W && nh === H) return;
      const sx = nw / W, sy = nh / H;
      for (const f of fish) { f.position.x *= sx; f.position.y *= sy; }
      for (const e of eaters) { e.pos.x *= sx; e.pos.y *= sy; }
      for (const v of plankton) { v.x *= sx; v.y *= sy; }
      W = nw; H = nh;
      density = densityFor(cw);
      p.pixelDensity(density);
      p.resizeCanvas(W, H);
      styleCanvas();
      paintBackground();
      if (!shouldRun()) p.redraw();
    }

    function scheduleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 120);
    }

    /* ---- p5 sketch --------------------------------------------------------- */

    function sketch(pp) {
      p = pp;

      p.setup = function () {
        const [cw, ch] = containerSize();
        lastCW = cw; lastCH = ch;
        [W, H] = worldFor(cw, ch);
        density = opts.world === 'viewport' ? densityFor(cw) : Math.min(opts.maxDensity, global.devicePixelRatio || 1);
        p.pixelDensity(density);
        const c = p.createCanvas(W, H);
        if (parentEl) c.parent(parentEl);
        c.attribute('aria-hidden', 'true');
        styleCanvas();
        p.frameRate(60);
        scratch = p.createVector();
        buildColours();
        paintBackground();
        populate();

        if (opts.reducedMotion) {
          // A still frame that already has some life in it: simulate, then stop.
          for (let i = 0; i < opts.warmupFrames; i++) frame();
          p.noLoop();
        } else if (!userPaused) {
          lastNow = performance.now();
          settle = 10;
        }
        ready = true;
        if (!shouldRun()) p.noLoop();
        if (opts.onReady) opts.onReady(controller);
      };

      p.draw = function () {
        frame();
        monitor();
      };
    }

    /* ---- public controller ---------------------------------------------------- */

    function clientToWorld(clientX, clientY) {
      const r = p.canvas.getBoundingClientRect();
      const s = Math.max(r.width / W, r.height / H);   // object-fit: cover
      const ox = (r.width - W * s) / 2;
      const oy = (r.height - H * s) / 2;
      return [(clientX - r.left - ox) / s, (clientY - r.top - oy) / s];
    }

    const controller = {

      get p5() { return p; },
      get canvas() { return p ? p.canvas : null; },

      pause()  { userPaused = true;  sync(); },
      resume() { userPaused = false; sync(); },
      toggle() { userPaused ? controller.resume() : controller.pause(); return !userPaused; },
      isPaused() { return userPaused; },
      isRunning() { return ready && p.isLooping(); },
      setInView(v) { inView = !!v; sync(); },

      /* addition: viewers can drop plankton (capped) */
      feed(x, y) {
        if (!ready) return false;
        let fed = 0;
        for (const v of plankton) if (v.fed) fed++;
        if (fed >= FED_CAP) return false;
        const v = p.createVector(Math.min(W, Math.max(0, x)), Math.min(H, Math.max(0, y)));
        v.fed = true;
        plankton.push(v);
        reseedWait = -1;
        if (!p.isLooping()) p.redraw();
        return true;
      },
      feedAtClient(cx, cy) { const [x, y] = clientToWorld(cx, cy); return ready && controller.feed(x, y); },
      feedRandom() {
        // several grains in a small cluster, so the eaters visibly go and get them
        const bx = W * (0.2 + 0.6 * Math.random()), by = H * (0.2 + 0.6 * Math.random());
        let any = false;
        for (let i = 0; i < 5; i++) any = controller.feed(bx + (Math.random() - 0.5) * 60, by + (Math.random() - 0.5) * 60) || any;
        return any;
      },

      /* only real values, read from the live arrays */
      getState() {
        return {
          ready,
          agents: fish.length,
          seekers: eaters.length,
          plankton: plankton.length,
          plankton0: PLANKTON_COUNT,
          cycle,
          quality: qualityLevel,
          running: ready && p.isLooping(),
          world: [W, H],
          density
        };
      },

      /* test hooks — snapshot of positions for equivalence checks */
      snapshot() {
        return {
          fish: fish.map(f => [f.position.x, f.position.y, f.velocity.x, f.velocity.y]),
          eaters: eaters.map(e => [e.pos.x, e.pos.y, e.vel.x, e.vel.y]),
          plankton: plankton.map(v => [v.x, v.y])
        };
      },
      stepFrames(n) { for (let i = 0; i < n; i++) frame(); },

      destroy() {
        document.removeEventListener('visibilitychange', onVisibility);
        if (resizeObserver) resizeObserver.disconnect();
        global.removeEventListener('resize', scheduleResize);
        clearTimeout(resizeTimer);
        if (p) p.remove();
        ready = false;
      }
    };

    /* start */

    new global.p5(sketch, parentEl || undefined);

    if (global.ResizeObserver && parentEl) {
      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(parentEl);
    } else {
      global.addEventListener('resize', scheduleResize);
    }

    return controller;
  }

  global.Sealife = { create, FISH_COUNT, PLANKTON_COUNT, PASSES_PER_FRAME };

})(window);
