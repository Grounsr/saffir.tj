// ============================================================
// ZARRIN & SAFFIR — Interactive Scripts
// ============================================================

(function () {
  'use strict';

  // ---- THEME TOGGLE ----
  const toggle = document.querySelector('[data-theme-toggle]');
  const mobileToggle = document.querySelector('[data-mobile-theme-toggle]');
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    updateToggleIcons();
  }

  if (toggle) toggle.addEventListener('click', switchTheme);
  if (mobileToggle) mobileToggle.addEventListener('click', switchTheme);

  // ---- NAV SCROLL ----
  var nav = document.getElementById('nav');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });

  // ---- FADE IN ON SCROLL (JS fallback) ----
  var faders = document.querySelectorAll('.fade-in-js');
  var fadeObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { root: null, rootMargin: '0px 0px -60px 0px', threshold: 0.1 });

  faders.forEach(function (el) { fadeObserver.observe(el); });

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

  // ---- PARALLAX HERO (subtle) ----
  var heroBg = document.querySelector('.hero-bg img');
  if (heroBg && window.innerWidth > 768) {
    window.addEventListener('scroll', function () {
      if (window.scrollY < window.innerHeight) {
        heroBg.style.transform = 'translateY(' + (window.scrollY * 0.3) + 'px) scale(1.1)';
      }
    }, { passive: true });
    heroBg.style.transform = 'scale(1.1)';
    heroBg.style.willChange = 'transform';
  }

})();
