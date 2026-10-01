// ============================================================
// ZARRIN & SAFFIR — touch extras for phones
// Bottom dock with the current section, menu highlights, button
// ripples, tap-to-flip certificates and the regions swipe dots.
// ============================================================

(function () {
  'use strict';

  var buzz = window.saffirBuzz || function () {};
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- SECTION DOCK ----
  var SECTIONS = [
    { id: 'companies', en: 'Companies', ru: 'Компании' },
    { id: 'about', en: 'Mission', ru: 'Миссия' },
    { id: 'process', en: 'Process', ru: 'Процесс' },
    { id: 'certifications', en: 'Certificates', ru: 'Сертификаты' },
    { id: 'regions', en: 'Regions', ru: 'Регионы' },
    { id: 'gallery', en: 'Gallery', ru: 'Галерея' },
    { id: 'project', en: 'Expansion', ru: 'Расширение' },
    { id: 'contact', en: 'Contact', ru: 'Контакт' }
  ].map(function (s) { s.el = document.getElementById(s.id); return s; }).filter(function (s) { return s.el; });

  var dock = document.getElementById('mobileDock');
  var dockLabel = dock && dock.querySelector('.dock-label');
  var dockCount = dock && dock.querySelector('.dock-count');
  var dockRing = dock && dock.querySelector('.dock-ring-fill');
  var menu = document.getElementById('mobileMenu');
  var menuLinks = Array.prototype.slice.call(document.querySelectorAll('.mobile-menu-nav a'));
  var contact = document.getElementById('contact');
  var current = -1, lastLang = null;

  if (dock) {
    dock.querySelector('.dock-section').addEventListener('click', function () {
      menu.classList.add('open');
      buzz(6);
    });
  }

  function update() {
    var vh = innerHeight, y = scrollY;
    var idx = -1;
    for (var i = 0; i < SECTIONS.length; i++) {
      if (SECTIONS[i].el.getBoundingClientRect().top <= vh * 0.45) idx = i;
    }
    var lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';
    if (idx !== current || lang !== lastLang) {
      current = idx;
      lastLang = lang;
      if (dockLabel && idx >= 0) {
        dockLabel.textContent = SECTIONS[idx][lang];
        dockCount.textContent = String(idx + 1).padStart(2, '0') + '/' + String(SECTIONS.length).padStart(2, '0');
        dockLabel.parentNode.classList.remove('tick');
        void dockLabel.offsetWidth;
        dockLabel.parentNode.classList.add('tick');
      }
      var activeId = idx >= 0 ? SECTIONS[idx].id : null;
      menuLinks.forEach(function (a) {
        a.classList.toggle('is-current', a.getAttribute('href') === '#' + activeId);
      });
    }
    if (dock) {
      var max = document.documentElement.scrollHeight - vh;
      if (dockRing) dockRing.style.strokeDashoffset = (100 - (max > 0 ? y / max : 0) * 100).toFixed(2);
      var atContact = contact && contact.getBoundingClientRect().top < vh * 0.7;
      dock.classList.toggle('show', y > vh * 0.75 && !atContact && !menu.classList.contains('open'));
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  if (menu) new MutationObserver(onScroll).observe(menu, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(onScroll).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  update();

  // ---- RIPPLE on buttons ----
  document.addEventListener('pointerdown', function (e) {
    var btn = e.target.closest && e.target.closest('.btn, .dock-cta, .mobile-lang-btn, .mobile-theme-btn');
    if (!btn || reduceMotion) return;
    var r = btn.getBoundingClientRect();
    var d = Math.max(r.width, r.height) * 2;
    var ink = document.createElement('span');
    ink.className = 'ripple';
    ink.style.width = ink.style.height = d + 'px';
    ink.style.left = (e.clientX - r.left - d / 2) + 'px';
    ink.style.top = (e.clientY - r.top - d / 2) + 'px';
    btn.appendChild(ink);
    setTimeout(function () { ink.remove(); }, 650);
  });

  // ---- CERTIFICATES: tap the coin to flip it ----
  document.querySelectorAll('.cert-item').forEach(function (item) {
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    function flip() { item.classList.toggle('flipped'); buzz(10); }
    item.addEventListener('click', flip);
    item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });

  // ---- REGIONS: swipe dots ----
  var grid = document.querySelector('.regions-grid');
  var dots = document.querySelector('.regions-dots');
  if (grid && dots) {
    var cards = Array.prototype.slice.call(grid.children);
    var dotEls = Array.prototype.slice.call(dots.children);
    var lastDot = 0;
    grid.addEventListener('scroll', function () {
      var mid = grid.scrollLeft + grid.clientWidth / 2, best = 0, bestD = Infinity;
      cards.forEach(function (c, i) {
        var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== lastDot) { lastDot = best; buzz(6); }
      dotEls.forEach(function (d, i) { d.classList.toggle('on', i === best); });
    }, { passive: true });
    dotEls.forEach(function (d, i) {
      d.addEventListener('click', function () {
        grid.scrollTo({ left: cards[i].offsetLeft - (grid.clientWidth - cards[i].offsetWidth) / 2, behavior: 'smooth' });
      });
    });
  }
})();
