/*
    GENERATIVE PORTFOLIO — recursive background
    --------------------------------------------

    Inspired by:
    - L-systems
    - recursive trees
    - symmetry
    - organic growth

    Interaction:
    - Mouse controls growth direction
    - Scroll controls growth amount
    - Canvas automatically adapts to screen size

    Changes from the original sketch.js (presentation only — the drawing code
    and its parameters are untouched):
    - Runs in p5 *instance mode* so it can share the page with the Sealife
      sketch (two global-mode sketches cannot coexist).
    - Pausable: the hero covers this canvas, so it only runs once the hero has
      started to scroll out of view (see hero.js -> Recursion.setActive).
    - Resizes ignore height-only changes (mobile URL bar) instead of
      regenerating the trees every time the viewport height moves.
    - Pixel density capped at 2.
    - prefers-reduced-motion: no animation loop; redraws on scroll instead.
*/

(function (global) {
  'use strict';

  /* COLOURS */

  const COLORS = {
    green: [159, 197, 90],
    purple: [156, 99, 163],
    yellow: [212, 196, 91],
    red: [217, 75, 104],
    white: [243, 241, 237]
  };

  const reducedMotion =
    global.matchMedia &&
    global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let instance = null;
  let wantActive = false;

  function sketch(p) {

    let branches = [];
    let growth = 0;
    let targetGrowth = 0;
    let lastWidth = 0;
    let resizeTimer = null;

    /* SETUP */

    p.setup = function () {

      p.pixelDensity(Math.min(global.devicePixelRatio || 1, 2));

      const c = p.createCanvas(global.innerWidth, global.innerHeight);
      c.parent('canvas-container');
      c.attribute('aria-hidden', 'true');

      p.angleMode(p.DEGREES);
      p.colorMode(p.RGB);
      p.background(64, 61, 63);

      lastWidth = global.innerWidth;
      generateSystem();

      // Starts paused: hero.js switches it on once the hero scrolls away.
      if (!wantActive || reducedMotion) p.noLoop();
    };

    /* CREATE INITIAL STRUCTURE */

    function generateSystem() {

      branches = [];

      /*
          Create several seeds.
          These become the roots of our recursive structures.
      */

      branches.push(new Branch(p.width * 0.88, p.height * 0.9, 90, -25, 0, COLORS.green));
      branches.push(new Branch(p.width * 0.12, p.height * 0.25, 75, 35, 0, COLORS.purple));
      branches.push(new Branch(p.width * 0.75, p.height * 0.25, 65, -20, 0, COLORS.yellow));
      branches.push(new Branch(p.width * 0.2, p.height * 0.85, 55, 15, 0, COLORS.red));
    }

    /* DRAW */

    p.draw = function () {

      /*
          Instead of clearing completely, draw a translucent background.
          This creates subtle trails.
      */

      p.background(64, 61, 63, 45);

      /* Smoothly interpolate growth. This prevents sudden movement. */

      growth = p.lerp(growth, targetGrowth, 0.04);

      /* Draw each recursive structure. */

      for (let branch of branches) {
        branch.render();
      }

      /* Small central geometric system. */

      drawGeometry();

      /* Update target growth using scroll. */

      let maxScroll =
        document.body.scrollHeight - global.innerHeight;

      if (maxScroll > 0) {

        let scrollProgress =
          p.constrain(global.scrollY / maxScroll, 0, 1);

        targetGrowth = p.map(scrollProgress, 0, 1, 0, 35);
      }
    };

    /* RECURSIVE BRANCH CLASS */

    class Branch {

      constructor(x, y, length, angle, depth, colour) {
        this.x = x;
        this.y = y;
        this.length = length;
        this.angle = angle;
        this.depth = depth;
        this.colour = colour;
      }

      render() {
        p.push();
        p.translate(this.x, this.y);
        p.rotate(this.angle);
        this.drawBranch(this.length, this.depth);
        p.pop();
      }

      drawBranch(len, depth) {

        /* Stop recursion when the branch becomes very small. */

        if (len < 4 || depth > 7) {
          return;
        }

        /* Mouse interaction. Mouse position influences branching direction. */

        let mouseInfluence = p.map(p.mouseX, 0, p.width, -20, 20);

        /* Scroll adds growth. */

        let animatedLength = len + growth * (1 - depth / 10);

        /* Branch colour. Older branches are more transparent. */

        let alpha = p.map(depth, 0, 7, 130, 35);

        p.stroke(this.colour[0], this.colour[1], this.colour[2], alpha);

        p.strokeWeight(p.map(depth, 0, 7, 2.5, 0.5));

        p.line(0, 0, 0, -animatedLength);

        p.translate(0, -animatedLength);

        /* Organic movement. Noise creates slower, less mechanical movement. */

        let movement =
          p.map(p.noise(p.frameCount * 0.005 + depth), 0, 1, -10, 10);

        /* LEFT BRANCH */

        p.push();
        p.rotate(-25 + mouseInfluence * 0.3 + movement);
        this.drawBranch(animatedLength * 0.72, depth + 1);
        p.pop();

        /* RIGHT BRANCH */

        p.push();
        p.rotate(25 + mouseInfluence * 0.3 - movement);
        this.drawBranch(animatedLength * 0.72, depth + 1);
        p.pop();
      }
    }

    /* GEOMETRIC RECURSION */

    function drawGeometry() {

      p.push();

      p.translate(p.width / 2, p.height / 2);

      /* Slow rotation. */

      p.rotate(p.frameCount * 0.01);

      p.noFill();

      /* Mouse controls scale. */

      let distance = p.dist(p.mouseX, p.mouseY, p.width / 2, p.height / 2);

      let scaleAmount = p.map(distance, 0, p.width, 0.3, 1.2);

      p.scale(scaleAmount);

      /* Draw recursive circles. */

      for (let i = 0; i < 8; i++) {

        let size = 50 + i * 35 + growth;

        p.stroke(COLORS.white[0], COLORS.white[1], COLORS.white[2], 18);

        p.ellipse(0, 0, size, size);
      }

      /* Triangle system. */

      p.rotate(p.frameCount * 0.02);

      for (let i = 0; i < 6; i++) {

        p.rotate(60);

        p.stroke(COLORS.yellow[0], COLORS.yellow[1], COLORS.yellow[2], 25);

        p.triangle(0, -120 - growth, -55, 30, 55, 30);
      }

      p.pop();
    }

    /* WINDOW RESIZE
       Original: resizeCanvas + generateSystem on every resize event.
       Now: only when the width changes (rotation, desktop resize). Height-only
       changes — the mobile URL bar showing/hiding — are ignored, otherwise the
       trees would be regenerated and the canvas cleared mid-scroll. */

    p.windowResized = function () {

      if (global.innerWidth === lastWidth) return;

      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        lastWidth = global.innerWidth;
        p.resizeCanvas(global.innerWidth, global.innerHeight);
        p.background(64, 61, 63);
        generateSystem();
        if (reducedMotion) p.redraw();
      }, 150);
    };

    /*
        MOUSE INTERACTION
        When the mouse moves, the system subtly regenerates.
    */

    p.mouseMoved = function () {

      if (
        Math.abs(p.mouseX - p.pmouseX) > 20 ||
        Math.abs(p.mouseY - p.pmouseY) > 20
      ) {

        targetGrowth += 0.5;
        targetGrowth = p.constrain(targetGrowth, 0, 50);
      }
    };

    /*
        MOBILE SUPPORT
        Touch position influences the generative system.
    */

    p.touchMoved = function () {

      if (p.touches.length > 0) {
        p.mouseX = p.touches[0].x;
        p.mouseY = p.touches[0].y;
      }
      // no preventDefault: the page must stay scrollable
    };

    /* reduced motion: no loop; redraw (throttled) when the page scrolls */

    if (reducedMotion) {
      let queued = false;
      global.addEventListener('scroll', function () {
        if (queued || !wantActive) return;
        queued = true;
        global.requestAnimationFrame(function () {
          queued = false;
          for (let i = 0; i < 6; i++) p.redraw();   // a few frames so trails build
        });
      }, { passive: true });
    }
  }

  const Recursion = {

    start() {
      if (instance) return;
      instance = new global.p5(sketch);
    },

    /* hero.js calls this: true once the hero no longer fully covers the canvas */
    setActive(active) {
      wantActive = !!active;
      if (!instance || reducedMotion) return;
      if (wantActive) instance.loop(); else instance.noLoop();
    }
  };

  global.Recursion = Recursion;

})(window);
