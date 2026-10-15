/*
    Hero wiring: Sealife (first viewport) + recursive background (everything below).

    - Sealife stops when the hero is almost out of view; the recursive sketch
      only runs once the hero has started to scroll away (it is hidden behind it before that).
    - Pause button (aria-pressed), Feed button, tap-the-water to feed.
    - The readout only shows numbers read from the running simulation.
    - No p5 (offline CDN, blocked script): the hero keeps its plain background and text.
*/

(function () {
  'use strict';

  var hero = document.getElementById('home');
  var holder = document.getElementById('sealife');
  var readout = document.getElementById('sealife-readout');
  var pauseBtn = document.getElementById('sealife-pause');
  var feedBtn = document.getElementById('sealife-feed');
  var note = document.getElementById('sealife-note');
  if (!hero || !holder) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hud = document.querySelector('.hero-hud');

  function hideControls() {
    if (hud) hud.querySelector('.hud-actions').hidden = true;
    if (note) note.hidden = true;
    if (readout) readout.hidden = true;
  }

  if (typeof window.p5 === 'undefined' || !window.Sealife) {
    hideControls();
    return;
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

  var sea = null;

  function renderReadout() {
    if (!sea || !readout) return;
    var s = sea.getState();
    if (!s.ready) return;
    readout.textContent =
      'Agents ' + s.agents + ' · Seekers ' + s.seekers +
      ' · Plankton ' + pad(s.plankton, 3) + '/' + s.plankton0 +
      ' · Cycle ' + pad(s.cycle, 2);
  }

  function renderButtons() {
    if (!sea || !pauseBtn) return;
    var paused = sea.isPaused();
    pauseBtn.textContent = paused ? 'Play' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    pauseBtn.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
  }

  sea = window.Sealife.create({
    parent: holder,
    palette: 'site',
    world: 'viewport',
    reducedMotion: reduced,
    onReady: function () { renderButtons(); renderReadout(); },
    onQuality: function () { renderReadout(); }
  });

  /* readout ~4×/s, only while the piece is actually running */
  setInterval(function () { if (sea.isRunning()) renderReadout(); }, 250);

  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () { sea.toggle(); renderButtons(); renderReadout(); });
  }

  if (feedBtn) {
    feedBtn.addEventListener('click', function () {
      sea.feedRandom();
      if (sea.isPaused()) { sea.resume(); renderButtons(); }
      renderReadout();
    });
  }

  /* tap / click the water: a short, nearly stationary press feeds; drags and scrolls do not */
  var down = null;
  holder.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('a,button')) { down = null; return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  holder.addEventListener('pointerup', function (e) {
    if (!down) return;
    var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    var dur = performance.now() - down.t;
    down = null;
    if (moved < 10 && dur < 300) { sea.feedAtClient(e.clientX, e.clientY); renderReadout(); }
  });
  holder.addEventListener('pointercancel', function () { down = null; });

  /* the HUD and content sit above the canvas, so listen on the hero for taps on empty space too */
  hero.addEventListener('pointerdown', function (e) {
    if (holder.contains(e.target)) return;
    if (e.target.closest && e.target.closest('a,button,.hero-content')) { down = null; return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  hero.addEventListener('pointerup', function (e) {
    if (!down) return;
    var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    var dur = performance.now() - down.t;
    down = null;
    if (moved < 10 && dur < 300) { sea.feedAtClient(e.clientX, e.clientY); renderReadout(); }
  });

  /* off-screen handling */
  if ('IntersectionObserver' in window) {
    // Sealife: stop when less than 5% of the hero is visible
    new IntersectionObserver(function (entries) {
      sea.setInView(entries[0].isIntersecting);
    }, { threshold: [0, 0.05] }).observe(hero);

    // Recursive background: only needed once the hero stops covering it
    var recursionOn = false;
    new IntersectionObserver(function (entries) {
      var on = entries[0].intersectionRatio < 0.7;
      if (on !== recursionOn) { recursionOn = on; window.Recursion && window.Recursion.setActive(on); }
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }).observe(hero);
  } else if (window.Recursion) {
    window.Recursion.setActive(true);
  }

  if (window.Recursion) window.Recursion.start();

  /* "Explore my work" should not fight reduced-motion users with smooth scroll: CSS handles it */
})();
