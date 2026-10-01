// ============================================================
// ZARRIN & SAFFIR — Interactive Scripts
// ============================================================

(function () {
  'use strict';

  // ---- THEME TOGGLE ----
  const toggle = document.querySelector('[data-theme-toggle]');
  const mobileToggle = document.querySelector('[data-mobile-theme-toggle]');
  const root = document.documentElement;
  // Dark is the signature look of the 3D design; a saved choice wins.
  var theme = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  root.setAttribute('data-theme', theme);

  function updateToggleIcons() {
    var sunSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    var moonSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    if (toggle) {
      toggle.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
      toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    }

    // Mobile toggle — update icon + text
    if (mobileToggle) {
      var iconSmall = theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      var labelSpan = mobileToggle.querySelector('span');
      mobileToggle.innerHTML = iconSmall;
      if (labelSpan) mobileToggle.appendChild(labelSpan);
      else {
        var s = document.createElement('span');
        s.setAttribute('data-en', 'Switch theme');
        s.setAttribute('data-ru', 'Сменить тему');
        s.textContent = currentLang === 'ru' ? 'Сменить тему' : 'Switch theme';
        mobileToggle.appendChild(s);
      }
    }
  }
  updateToggleIcons();

  function switchTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    updateToggleIcons();
  }

  if (toggle) toggle.addEventListener('click', switchTheme);
  if (mobileToggle) mobileToggle.addEventListener('click', switchTheme);

  // ---- COUNTER ANIMATION ----
  var counters = document.querySelectorAll('.counter[data-target]');
  var counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function (el) { counterObserver.observe(el); });

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var duration = 1500;
    var start = performance.now();
    function update(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString('en-US');
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ---- LANGUAGE SWITCHER (desktop + mobile synced) ----
  var currentLang = 'en';
  var desktopLangBtns = document.querySelectorAll('.lang-switch .lang-btn');
  var mobileLangBtns = document.querySelectorAll('.mobile-lang-btn');

  function switchLang(lang) {
    if (lang === currentLang) return;
    currentLang = lang;

    // Sync desktop buttons
    desktopLangBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });

    // Sync mobile buttons
    mobileLangBtns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });

    // Update all translatable elements
    document.querySelectorAll('[data-' + lang + ']').forEach(function (el) {
      var text = el.getAttribute('data-' + lang);
      if (text && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
        el.innerHTML = text;
      }
    });

    document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';
  }

  desktopLangBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchLang(this.getAttribute('data-lang'));
    });
  });

  mobileLangBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchLang(this.getAttribute('data-lang'));
    });
  });

  // ---- SMOOTH ANCHOR SCROLLING ----
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ============================================================
  // 3D SCROLL ENGINE
  // One rAF loop drives every scroll-linked effect with eased values:
  //  --q on [data-reveal]  : 0 → 1 as the element enters the viewport
  //  --p on [data-pin]     : 0 → 1 progress through a pinned scene
  //  --h on .hero          : 0 → 1 while the hero scrolls away
  //  --rx / --ry on [data-tilt] : pointer tilt (mouse only)
  // ============================================================
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.getElementById('nav');
  var hero = document.querySelector('.hero');
  var progressBar = document.querySelector('.scroll-progress span');
  var reveals = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]')).map(function (el) {
    return { el: el, q: reduceMotion ? 1 : 0, last: -1 };
  });
  var tilts = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]')).map(function (el) {
    return { el: el, tx: 0, ty: 0, x: 0, y: 0 };
  });
  var processTrack = document.querySelector('.process-track');
  var processSteps = Array.prototype.slice.call(document.querySelectorAll('.process-step'));
  var railFill = document.querySelector('.process-rail-fill');
  var railTicks = Array.prototype.slice.call(document.querySelectorAll('.process-rail i'));
  var galleryTrack = document.querySelector('.gallery-track');
  var galleryRing = document.querySelector('.gallery-ring');
  var galleryItems = Array.prototype.slice.call(document.querySelectorAll('.gallery-item'));
  var ringRadius = 400;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // hold each slide while it is read, move in the middle of the gap
  function held(x, n) {
    var i = Math.floor(x), f = x - i;
    if (i >= n - 1) return n - 1;
    return i + smooth(clamp((f - 0.18) / 0.64, 0, 1));
  }

  galleryItems.forEach(function (item, i) { item.style.setProperty('--i', i); });

  function layoutRing() {
    if (!galleryItems.length) return;
    var w = galleryItems[0].offsetWidth;
    var n = galleryItems.length;
    ringRadius = Math.round((w / 2) / Math.tan(Math.PI / n) + w * 0.12);
    galleryRing.style.setProperty('--r', ringRadius + 'px');
  }
  layoutRing();
  addEventListener('resize', layoutRing, { passive: true });

  tilts.forEach(function (t) {
    t.el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || reduceMotion) return;
      var r = t.el.getBoundingClientRect();
      t.tx = ((e.clientY - r.top) / r.height - 0.5) * -8;
      t.ty = ((e.clientX - r.left) / r.width - 0.5) * 10;
      t.el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      t.el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
    t.el.addEventListener('pointerleave', function () { t.tx = 0; t.ty = 0; });
  });

  var pinState = new Map();
  function pinProgress(el) {
    var r = el.getBoundingClientRect();
    var range = r.height - innerHeight;
    return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  }

  var lastTime = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    var k = reduceMotion ? 1 : 1 - Math.pow(0.002, dt);
    var vh = innerHeight;
    var y = scrollY;

    nav.classList.toggle('scrolled', y > 60);
    var max = document.documentElement.scrollHeight - vh;
    if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0).toFixed(4) + ')';

    if (hero && !reduceMotion) {
      var h = clamp(y / vh, 0, 1);
      if (h < 1 || hero._h !== 1) { hero.style.setProperty('--h', h.toFixed(4)); hero._h = h; }
    }

    // reveals
    for (var i = 0; i < reveals.length; i++) {
      var R = reveals[i];
      if (!reduceMotion) {
        var rect = R.el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) continue;
        var target = clamp((vh - rect.top) / (vh * 0.55), 0, 1);
        R.q = lerp(R.q, target, k);
        if (Math.abs(R.q - target) < 0.001) R.q = target;
      }
      if (Math.abs(R.q - R.last) > 0.0005) {
        R.el.style.setProperty('--q', smooth(R.q).toFixed(4));
        R.last = R.q;
      }
    }

    // pointer tilt
    for (var j = 0; j < tilts.length; j++) {
      var T = tilts[j];
      if (Math.abs(T.x - T.tx) < 0.01 && Math.abs(T.y - T.ty) < 0.01 && T.done) continue;
      T.x = lerp(T.x, T.tx, 1 - Math.pow(0.001, dt));
      T.y = lerp(T.y, T.ty, 1 - Math.pow(0.001, dt));
      T.done = Math.abs(T.x - T.tx) < 0.01 && Math.abs(T.y - T.ty) < 0.01;
      T.el.style.setProperty('--rx', T.x.toFixed(2) + 'deg');
      T.el.style.setProperty('--ry', T.y.toFixed(2) + 'deg');
    }

    if (reduceMotion) return;

    // process: 3D drum of slides
    if (processTrack) {
      var pp = pinProgress(processTrack);
      var ps = pinState.get(processTrack);
      ps = ps == null ? pp : lerp(ps, pp, k);
      pinState.set(processTrack, ps);
      var n = processSteps.length;
      var s = held(ps * (n - 1) + 0.0001, n);
      processSteps.forEach(function (el, idx) {
        var d = idx - s;
        var ad = Math.abs(d);
        var o = clamp(1 - ad * 1.3, 0, 1);
        el.style.transform = 'translate3d(0,' + (d * 46).toFixed(2) + '%,' + (-ad * 140).toFixed(1) + 'px) rotateX(' + (-d * 70).toFixed(2) + 'deg)';
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      });
      if (railFill) railFill.style.transform = 'scaleY(' + (s / (n - 1)).toFixed(4) + ')';
      var active = Math.round(s);
      railTicks.forEach(function (t, idx) { t.classList.toggle('on', idx <= active); });
    }

    // gallery: rotating 3D ring
    if (galleryTrack && galleryRing) {
      var gp = pinProgress(galleryTrack);
      var gs = pinState.get(galleryTrack);
      gs = gs == null ? gp : lerp(gs, gp, k);
      pinState.set(galleryTrack, gs);
      var count = galleryItems.length;
      var step = 360 / count;
      var angle = -gs * step * (count - 1);
      galleryRing.style.transform = 'translateZ(' + (-ringRadius) + 'px) rotateX(-4deg) rotateY(' + angle.toFixed(2) + 'deg)';
      galleryItems.forEach(function (item, idx) {
        var rel = ((idx * step + angle) % 360 + 540) % 360 - 180;
        var facing = Math.cos(rel * Math.PI / 180);
        item.style.setProperty('--dim', ((1 - facing) * 0.42).toFixed(3));
      });
    }
  }
  requestAnimationFrame(tick);
})();
