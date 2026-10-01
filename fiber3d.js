// ============================================================
// ZARRIN & SAFFIR — "Cotton Fiber" 3D scene
// A dependency-free WebGL particle system. Thousands of cotton
// fibers morph between shapes that tell the company story as the
// visitor scrolls: cotton boll → two companies → field → ginning →
// spinning → weaving → certification → regions → global trade.
// ============================================================

(function () {
  'use strict';

  var canvas = document.getElementById('fiber-canvas');
  if (!canvas) return;

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = Math.min(screen.width, screen.height) < 768 || innerWidth < 768;
  var lowPower = isSmall || (navigator.hardwareConcurrency || 8) <= 4;

  var gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  document.documentElement.classList.add('has-webgl');

  var N = lowPower ? 6000 : 14000;
  var TAU = Math.PI * 2;

  // ---------- seeded random ----------
  var seed = 7;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function rr(a, b) { return a + (b - a) * rnd(); }
  function gauss() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }
  function sphereDir() {
    var u = rnd() * 2 - 1, t = rnd() * TAU, s = Math.sqrt(1 - u * u);
    return [s * Math.cos(t), u, s * Math.sin(t)];
  }

  // ---------- vector helpers ----------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function len(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  // rotate v around unit axis k by angle a (Rodrigues)
  function rot(v, k, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
  }
  function anyPerp(v) { return norm(cross(v, Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])); }

  // ---------- shape builders ----------
  // Every point has a position (x, y, z, w) and a flow vector (tx, ty, tz, speed).
  // w picks the color: 0 = cotton white, 0.5 = Saffir green, 1 = Zarrin gold.
  // The flow vector is the local direction of the fiber the point sits on:
  // the shader slides points along it and fades them at the ends, so every
  // shape is made of living threads instead of static dots.
  function Builder() {
    this.a = new Float32Array(N * 4);
    this.t = new Float32Array(N * 4);
    this.i = 0;
  }
  Builder.prototype.push = function (p, w, t, speed) {
    if (this.i >= N) return false;
    var o = this.i * 4;
    this.a[o] = p[0]; this.a[o + 1] = p[1]; this.a[o + 2] = p[2]; this.a[o + 3] = w;
    if (t) { this.t[o] = t[0]; this.t[o + 1] = t[1]; this.t[o + 2] = t[2]; this.t[o + 3] = speed || 1; }
    this.i++;
    return true;
  };
  Builder.prototype.count = function (f) { return Math.floor(N * f); };
  Builder.prototype.left = function () { return N - this.i; };
  // n points along curve f(s), s in [s0, s1]; flow follows the curve
  Builder.prototype.curve = function (n, f, w, flow, speed, s0, s1) {
    s0 = s0 || 0; s1 = s1 == null ? 1 : s1;
    for (var i = 0; i < n; i++) {
      var s = s0 + (s1 - s0) * rnd();
      var p = f(s);
      var d = sub(f(Math.min(1, s + 0.01)), f(Math.max(0, s - 0.01)));
      var ww = typeof w === 'function' ? w(s) : w;
      if (!this.push(p, ww, mul(norm(d), flow), speed)) return;
    }
  };
  Builder.prototype.done = function (fill) {
    while (this.i < N) fill(this);
    return { pos: this.a, flow: this.t };
  };

  // ---- cotton boll: five locks wound from fibers, wisps pulled into the air,
  // bracts drawn as veined leaves ----
  function addBoll(b, n, c, s, lockW, bractW, wisps) {
    var locks = [];
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * TAU + 0.3;
      locks.push([Math.cos(a) * 0.6, 0.12 + (k % 2) * 0.12, Math.sin(a) * 0.6]);
    }
    locks.push([0, 0.6, 0]);
    var R = wisps ? 0.44 : 0.5;
    var nLock = Math.floor(n * (wisps ? 0.6 : 0.72));
    var nFill = Math.floor(n * 0.14);
    var nWisp = wisps ? Math.floor(n * 0.07) : 0;
    var made = 0, fiber = 0;
    function P(v) { return add(c, mul(v, s)); }
    // fibers wrapped over each lock surface
    while (made < nLock) {
      var L = locks[fiber++ % locks.length];
      var out = norm(L[1] > 0.5 ? [0, 1, 0] : L);
      var u = norm(add(mul(sphereDir(), 1.0), mul(out, 0.7)));
      var axis = anyPerp(u);
      axis = rot(axis, u, rnd() * TAU);
      var arc = rr(0.5, 1.2);
      var bulge = rr(0.94, 1.06);
      var pts = 18;
      (function (L, u, axis, arc, bulge) {
        b.curve(pts, function (t) {
          var v = rot(u, axis, (t - 0.5) * arc);
          var r = R * bulge * (1 + 0.06 * Math.sin(t * 9 + v[1] * 4));
          return P([L[0] + v[0] * r, L[1] + v[1] * r * 1.1, L[2] + v[2] * r]);
        }, rnd() < 0.04 ? 1 : lockW, 0.07 * s, 0.6);
      })(L, u, axis, arc, bulge);
      made += pts;
    }
    // soft core so each lock keeps its volume
    for (var f = 0; f < nFill; f++) {
      var Lf = locks[f % locks.length], df = sphereDir(), rf = R * Math.pow(rnd(), 0.5) * 0.92;
      b.push(P([Lf[0] + df[0] * rf, Lf[1] + df[1] * rf * 1.1, Lf[2] + df[2] * rf]), lockW, mul(anyPerp(df), 0.03 * s), 0.3);
    }
    // wisps: fibers teased out and curling into the air
    var w0 = 0;
    while (w0 < nWisp) {
      var L2 = locks[Math.floor(rnd() * locks.length)];
      var d0 = norm(add(sphereDir(), mul(norm(L2), 1.2)));
      var start = add(L2, mul(d0, R));
      var reach = rr(0.4, 1.0), curl = rr(0.12, 0.3), turns = rr(1.5, 3.5), ph = rnd() * TAU;
      var side = anyPerp(d0), side2 = cross(d0, side);
      (function (start, d0, side, side2, reach, curl, turns, ph) {
        b.curve(30, function (t) {
          var a = t * turns * TAU + ph;
          var rad = curl * t;
          var p = add(add(start, mul(d0, t * reach)), add(mul(side, Math.cos(a) * rad), mul(side2, Math.sin(a) * rad)));
          p[1] += t * t * 0.35;
          return P(p);
        }, rnd() < 0.15 ? 1 : 0, 0.12 * s, 1.4);
      })(start, d0, side, side2, reach, curl, turns, ph);
      w0 += 30;
    }
    // burs: the opened golden capsule, five pointed segments curling outward
    var nBur = wisps ? Math.floor(n * 0.14) : 0;
    for (var bi = 0; bi < 5 && nBur; bi++) {
      var ba = bi / 5 * TAU + 0.3 + TAU / 10;
      (function (ba) {
        var edge = function (t, side) {
          var spread = Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.36 * side;
          var a = ba + spread;
          var r = 0.2 + t * 1.05 + t * t * 0.25;
          var y = -0.4 + t * 0.7 - t * t * 0.75;
          return P([Math.cos(a) * r, y, Math.sin(a) * r]);
        };
        var per = Math.floor(nBur / 5);
        b.curve(Math.floor(per * 0.4), function (t) { return edge(t, 1); }, 1, 0.05 * s, 0.7);
        b.curve(Math.floor(per * 0.4), function (t) { return edge(t, -1); }, 1, 0.05 * s, 0.7);
        b.curve(per - 2 * Math.floor(per * 0.4), function (t) { return edge(t * 0.92, 0); }, 1, 0.05 * s, 0.7);
      })(ba);
    }
    // bracts: five leaves with midrib and veins
    var nBract = n - nLock - nWisp - nFill - nBur;
    var per = Math.max(1, Math.floor(nBract / 5));
    for (var leaf = 0; leaf < 5; leaf++) {
      var ang = leaf / 5 * TAU + 0.3 + TAU / 10;
      var dir = [Math.cos(ang), 0, Math.sin(ang)];
      var perp = [-dir[2], 0, dir[0]];
      var leafPt = function (t, o) { // t along leaf, o across (-1..1)
        var wdt = Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.3 * (1 - t * 0.3);
        var p = add(mul(dir, 0.15 + t * 1.0), mul(perp, o * wdt));
        p[1] = -0.42 - 0.08 * t + 0.42 * t * t - Math.abs(o) * 0.05;
        return P(p);
      };
      // midrib
      b.curve(Math.floor(per * 0.25), function (t) { return leafPt(t, 0); }, bractW, 0.05 * s, 0.5);
      // outline
      b.curve(Math.floor(per * 0.35), function (t) { return t < 0.5 ? leafPt(t * 2, 1) : leafPt(2 - t * 2, -1); }, bractW, 0.05 * s, 0.5);
      // veins
      var veins = 6;
      for (var v = 0; v < veins; v++) {
        var t0 = 0.15 + v / veins * 0.7, sgn = v % 2 ? 1 : -1;
        (function (t0, sgn) {
          b.curve(Math.floor(per * 0.4 / veins), function (t) { return leafPt(t0 + t * 0.12, sgn * t * 0.95); }, bractW, 0.04 * s, 0.5);
        })(t0, sgn);
      }
    }
  }

  // ---- ball of yarn: dozens of wound great circles ----
  function addYarnBall(b, n, c, R, w) {
    var made = 0, loops = 0;
    var per = Math.max(60, Math.floor(n / 34));
    while (made < n) {
      var axis = sphereDir();
      // winding axes drift slowly, like real winding
      axis = norm(add(axis, mul([Math.sin(loops * 0.7), 1, Math.cos(loops * 0.7)], 0.6)));
      var u = anyPerp(axis);
      var r = R * rr(0.97, 1.03);
      (function (axis, u, r) {
        b.curve(Math.min(per, n - made), function (t) {
          return add(c, mul(rot(u, axis, t * TAU), r));
        }, w, 0.09, 0.8);
      })(axis, u, r);
      made += per; loops++;
    }
  }

  // ---- two-ply twisted thread along a path ----
  function addPly(b, n, path, w, radius, twists, speed) {
    for (var ply = 0; ply < 2; ply++) {
      (function (ply) {
        b.curve(Math.floor(n / 2), function (t) {
          var p = path(t);
          var d = norm(sub(path(Math.min(1, t + 0.01)), path(Math.max(0, t - 0.01))));
          var a1 = anyPerp(d), a2 = cross(d, a1);
          var a = t * twists * TAU + ply * Math.PI;
          return add(p, add(mul(a1, Math.cos(a) * radius), mul(a2, Math.sin(a) * radius)));
        }, w, 0.1, speed);
      })(ply);
    }
  }

  function latLon(lat, lon, R) {
    lat *= Math.PI / 180; lon *= Math.PI / 180;
    return [Math.cos(lat) * Math.cos(lon) * R, Math.sin(lat) * R, -Math.cos(lat) * Math.sin(lon) * R];
  }

  var shapes = {};

  // Hero: a blooming cotton boll with fibers being teased into the air
  shapes.boll = function () {
    var b = new Builder();
    addBoll(b, b.count(0.94), [0, 0.05, 0], 1.25, 0, 0.5, true);
    return b.done(function (b) { // slow orbiting lint
      var a = rnd() * TAU, r = rr(1.6, 2.6), y = gauss() * 0.6;
      b.push([Math.cos(a) * r, y, Math.sin(a) * r], rnd() < 0.3 ? 1 : 0, [-Math.sin(a) * 0.1, 0.02, Math.cos(a) * 0.1], 0.5);
    });
  };

  // Companies: Saffir's cotton spins a thread that winds Zarrin's golden ball —
  // the yarn ball doubles as a globe of trade
  shapes.duo = function () {
    var b = new Builder();
    addBoll(b, b.count(0.42), [-1.6, -0.05, 0], 0.72, 0.5, 0.5, false);
    addYarnBall(b, b.count(0.42), [1.6, 0, 0], 0.9, 1);
    var path = function (t) {
      return [-1.05 + t * 1.85, 0.25 + Math.sin(t * Math.PI) * 0.45 - t * 0.2, Math.sin(t * Math.PI * 2) * 0.15];
    };
    addPly(b, b.count(0.14), path, function (t) { return 0.5 + t * 0.5; }, 0.03, 9, 2.2);
    return b.done(function (b) {
      var p = path(rnd());
      b.push(add(p, mul(sphereDir(), 0.12 * rnd())), 0, [0.08, 0, 0], 1);
    });
  };

  // Field: rows of plants that grow from the soil and burst into bolls
  shapes.field = function () {
    var b = new Builder();
    var rows = 11, Y0 = -0.95;
    var plants = [];
    for (var r = 0; r < rows; r++) {
      for (var z = 1.4; z > -5; z -= 0.34) plants.push([(r - (rows - 1) / 2) * 0.42, z + rr(-0.06, 0.06)]);
    }
    var per = Math.max(12, Math.floor(b.count(0.9) / plants.length));
    plants.forEach(function (pl) {
      var x0 = pl[0] * (1 + (1.4 - pl[1]) * 0.04), z0 = pl[1];
      var h = rr(0.28, 0.42), lean = rr(-0.08, 0.08);
      var stem = function (t) { return [x0 + lean * t * t, Y0 + t * h, z0]; };
      b.curve(Math.floor(per * 0.22), stem, 0.5, 0.05, 0.7);
      var tips = [];
      for (var k = 0; k < 3; k++) {
        var a = k / 3 * TAU + rnd(), t0 = 0.45 + k * 0.17;
        var base = stem(t0), tip = add(base, [Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12]);
        tips.push(tip);
        (function (base, tip) {
          b.curve(Math.floor(per * 0.08), function (t) { return add(base, mul(sub(tip, base), t)); }, 0.5, 0.04, 0.7);
        })(base, tip);
      }
      tips.push(stem(1));
      var puffN = Math.floor(per * 0.46 / tips.length);
      tips.forEach(function (tp) {
        for (var i = 0; i < puffN; i++) {
          var d = sphereDir();
          b.push(add(tp, mul(d, 0.055 * (0.8 + 0.2 * rnd()))), rnd() < 0.03 ? 1 : 0, mul(anyPerp(d), 0.03), 0.4);
        }
      });
    });
    return b.done(function (b) { // furrows
      var p = plants[Math.floor(rnd() * plants.length)];
      b.push([p[0] + 0.21, Y0 - 0.02, p[1] + rr(-0.17, 0.17)], 0.5, [0, 0, 0.06], 0.3);
    });
  };

  // Ginning: two counter-rotating saw cylinders comb lint up and drop seeds
  shapes.gin = function () {
    var b = new Builder();
    var cyl = [[0.3, 1], [-0.42, -1]];
    var nSaw = b.count(0.46);
    for (var i = 0; i < nSaw; i++) {
      var C = cyl[i % 2];
      var k = Math.floor(rnd() * 11);
      var x = (k - 5) * 0.2;
      var a = rnd() * TAU;
      var tooth = (a * 26 / TAU) % 1;
      var r = (C[1] > 0 ? 0.5 : 0.36) * (1 + 0.05 * tooth);
      var p = [x, C[0] + Math.sin(a) * r, Math.cos(a) * r];
      b.push(p, C[1] > 0 ? 1 : 0.75, [0, Math.cos(a) * 0.09 * C[1], -Math.sin(a) * 0.09 * C[1]], 1.2);
    }
    // lint ribbons leaving the top saw, billowing up and back
    var nLint = b.count(0.4), made = 0;
    while (made < nLint) {
      var x0 = rr(-1.05, 1.05), sway = rr(-0.3, 0.3), h = rr(1.0, 1.8);
      (function (x0, sway, h) {
        b.curve(36, function (t) {
          return [x0 + Math.sin(t * 5 + x0) * 0.08 * t + sway * t, 0.8 + t * h, -0.2 - Math.sin(t * Math.PI * 0.8) * 0.7];
        }, 0, 0.14, 1.6);
      })(x0, sway, h);
      made += 36;
    }
    return b.done(function (b) { // seeds falling below
      var p = [rr(-1.1, 1.1), rr(-0.85, -2.0), rr(-0.3, 0.3)];
      b.push(p, 0.75, [0, -0.16, 0], 1.8);
    });
  };

  // Spinning: roving is drafted, twisted into yarn, ballooned and wound
  shapes.spin = function () {
    var b = new Builder();
    var base = 0.15, H = 1.25;
    // the package: cross-wound helices that wind as you watch
    var nPkg = b.count(0.4);
    for (var i = 0; i < nPkg; i++) {
      var t = rnd(), dir = i % 2 ? 1 : -1;
      var y = base + t * H, R = 0.5 - t * 0.17;
      var a = t * 36 * dir + Math.floor(rnd() * 12) / 12 * TAU;
      b.push([Math.cos(a) * R, y, Math.sin(a) * R], 0, [-Math.sin(a) * 0.08 * dir, 0.004 * dir, Math.cos(a) * 0.08 * dir], 0.9);
    }
    // bobbin tube and ring
    b.curve(b.count(0.05), function (t) { return [Math.cos(t * TAU * 24) * 0.14, base - 0.1 + t * (H + 0.35), Math.sin(t * TAU * 24) * 0.14]; }, 1, 0.05, 0.6);
    b.curve(b.count(0.05), function (t) { return [Math.cos(t * TAU) * 0.62, base - 0.02, Math.sin(t * TAU) * 0.62]; }, 1, 0.1, 1.4);
    // balloon: the yarn loop sweeping around the spindle
    var balloon = function (t) {
      var y = base - 0.05 - t * 0.85;
      var r = 0.6 * (1 - t) * (0.35 + Math.sin(t * Math.PI) * 1.1);
      var a = t * TAU * 0.8;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    b.curve(b.count(0.12), balloon, 0, 0.1, 2.4);
    // twisted yarn rising from the drafting rollers into the balloon
    var end = balloon(1);
    addPly(b, b.count(0.12), function (t) { return [end[0], -1.3 + t * (end[1] + 1.3), end[2]]; }, 0, 0.022, 8, 2);
    // drafting rollers: a pair of turning cylinders
    for (var rl = 0; rl < 2; rl++) {
      (function (rl) {
        b.curve(b.count(0.05), function (t) {
          var a = t * TAU * 7;
          return [(rl ? 0.1 : -0.1) + Math.cos(a) * 0.08, -1.36 + Math.sin(a) * 0.08, (t - 0.5) * 0.7];
        }, 1, rl ? 0.06 : -0.06, 1.2);
      })(rl);
    }
    return b.done(function (b) { // the roving: a soft wide ribbon narrowing into the rollers
      var t = rnd();
      var wdt = t * 0.5 + 0.03;
      b.push([gauss() * 0.04, -1.45 - t * 0.6, gauss() * wdt * 0.5], 0, [0, 0.07, 0], 1);
    });
  };

  // Weaving: warp and weft interlace on a rippling cloth with a fringe
  shapes.weave = function () {
    var b = new Builder();
    var W = 2.2, Hh = 1.5, n = 20;
    var step = (2 * W) / n, stepY = (2 * Hh) / n;
    var tilt = -0.95, ct = Math.cos(tilt), st = Math.sin(tilt);
    function cloth(x, y) { return 0.22 * Math.sin(x * 1.3 + y * 0.9) + 0.1 * Math.cos(y * 2.0 - x * 0.5); }
    function place(x, y, z) { return [x, y * ct - z * st, y * st + z * ct]; }
    var nCloth = b.count(0.88);
    for (var i = 0; i < nCloth; i++) {
      var warp = i % 2 === 0;
      var idx = Math.floor(rnd() * n);
      var u = rr(-1, 1), x, y, over, f;
      if (warp) {
        x = -W + (idx + 0.5) * step; y = u * Hh;
        over = Math.sin((y / stepY) * Math.PI + idx * Math.PI);
        f = place(0, 0.07, 0);
      } else {
        y = -Hh + (idx + 0.5) * stepY; x = u * W;
        over = -Math.sin((x / step) * Math.PI + idx * Math.PI);
        f = [0.07, 0, 0];
      }
      b.push(place(x, y, cloth(x, y) + over * 0.05), warp ? 0 : 0.5, f, warp ? 0.5 : 1.4);
    }
    return b.done(function (b) { // fringe hanging from the near edge
      var idx = Math.floor(rnd() * n), t = rnd();
      var x = -W + (idx + 0.5) * step, y = -Hh - t * 0.35;
      b.push(place(x + Math.sin(t * 4 + idx) * 0.03, y, cloth(x, -Hh) - t * t * 0.4), 0, place(0, -0.05, -0.04), 0.6);
    });
  };

  // Certification: two guilloché medallions, like the engraving on a certificate
  shapes.rings = function () {
    var b = new Builder();
    function rosette(n, cx, w, lobes, phase) {
      var curves = 18, per = Math.floor(n * 0.86 / curves);
      for (var k = 0; k < curves; k++) {
        (function (k) {
          b.curve(per, function (t) {
            var a = t * TAU;
            var r = 0.72 + 0.16 * Math.sin(lobes * a + k * TAU / curves + phase) + 0.05 * Math.sin((lobes * 3 + 1) * a);
            return [cx + Math.cos(a) * r, Math.sin(a) * r, 0.05 * Math.sin(lobes * a + k)];
          }, w, 0.07, 0.5);
        })(k);
      }
      // beaded rim
      for (var i = 0; i < n * 0.14; i++) {
        var a = Math.floor(rnd() * 72) / 72 * TAU + gauss() * 0.01;
        b.push([cx + Math.cos(a) * 1.02, Math.sin(a) * 1.02, 0], w, [-Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0], 0.3);
      }
    }
    rosette(b.count(0.46), -1.3, 0.5, 7, 0);
    rosette(b.count(0.46), 1.3, 1, 9, 0.5);
    return b.done(function (b) {
      var a = rnd() * TAU, r = rr(2.0, 2.5);
      b.push([Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.5, gauss() * 0.3], 0, [-Math.sin(a) * 0.1, Math.cos(a) * 0.05, 0], 0.4);
    });
  };

  // Regions: relief of southern Tajikistan, the Vakhsh and Panj rivers flowing,
  // and two beams of light over Yovon (Saffir) and Farkhor (Zarrin)
  shapes.terrain = function () {
    var b = new Builder();
    function h(x, z) {
      var m = 0.95 * Math.exp(-((x - 1.8) * (x - 1.8) + (z + 3.2) * (z + 3.2)) / 2.2);
      m += 0.6 * Math.exp(-((x + 0.8) * (x + 0.8) + (z + 3.8) * (z + 3.8)) / 1.6);
      m += 0.35 * Math.exp(-((x + 2.2) * (x + 2.2) + (z + 1.5) * (z + 1.5)) / 1.0);
      m += 0.06 * Math.sin(x * 3.1) * Math.cos(z * 2.7);
      return m;
    }
    var Y0 = -0.95;
    var yov = [-0.7, 0.05], far = [0.55, 0.7];
    // contour lines: points slide along each line of equal height
    var nGround = b.count(0.62);
    for (var i = 0; i < nGround; i++) {
      var gx = rr(-2.8, 2.8), gz = Math.round(rr(-5, 1.4) * 5) / 5;
      var e = 0.02;
      var dzx = [1, h(gx + e, gz) - h(gx - e, gz), 0];
      b.push([gx, Y0 + h(gx, gz), gz], 0, mul(norm(dzx), 0.05), 0.25);
    }
    // rivers
    var vakhsh = function (t) { var x = -1.5 + t * 1.6 + Math.sin(t * 7) * 0.15, z = -4.5 + t * 5.6; return [x, Y0 + h(x, z) + 0.02, z]; };
    var panj = function (t) { var x = 2.6 - t * 5.2, z = 1.25 + Math.sin(t * 9) * 0.12 - t * 0.2; return [x, Y0 + h(x, z) + 0.02, z]; };
    b.curve(b.count(0.08), vakhsh, 0, 0.12, 1.6);
    b.curve(b.count(0.08), panj, 0, 0.12, 1.6);
    return b.done(function (b) { // beams rise like threads of light
      var p = rnd() < 0.5 ? yov : far;
      var t = Math.pow(rnd(), 1.5);
      var a = rnd() * TAU + t * 8, r = 0.04 + (1 - t) * 0.1 * rnd();
      b.push([p[0] + Math.cos(a) * r, Y0 + h(p[0], p[1]) + t * 1.6, p[1] + Math.sin(a) * r], p === yov ? 0.5 : 1, [0, 0.16, 0], 1.5);
    });
  };

  // Gallery: cotton seeds with their fluffy pappus drifting up on the wind
  shapes.dust = function () {
    var b = new Builder();
    return b.done(function (b) {
      var c = [rr(-4, 4), rr(-2.4, 2.4), rr(-4, 1.5)];
      var wcol = rnd() < 0.1 ? 1 : 0;
      for (var k = 0; k < 7 && b.left(); k++) {
        var d = sphereDir();
        d[1] = Math.abs(d[1]);
        b.push(add(c, mul(d, 0.05 + rnd() * 0.04)), wcol, [0.02, 0.06, 0], 0.35);
      }
    });
  };

  // Global trade: a globe of latitude threads, trade routes streaming out of
  // Tajikistan to the world's textile hubs, and an orbit of golden yarn
  shapes.globe = function () {
    var b = new Builder();
    var R = 1.3;
    var nLat = b.count(0.44);
    for (var i = 0; i < nLat; i++) {
      var lat = (Math.floor(rnd() * 11) - 5) / 6 * (Math.PI / 2);
      var lon = rnd() * TAU;
      var p = [Math.cos(lat) * Math.cos(lon) * R, Math.sin(lat) * R, Math.cos(lat) * Math.sin(lon) * R];
      b.push(p, 1, [-Math.sin(lon) * 0.06, 0, Math.cos(lon) * 0.06], 0.4);
    }
    var nMer = b.count(0.14);
    for (i = 0; i < nMer; i++) {
      var lo = Math.floor(rnd() * 12) / 12 * TAU, la = (rnd() - 0.5) * Math.PI;
      b.push([Math.cos(la) * Math.cos(lo) * R, Math.sin(la) * R, Math.cos(la) * Math.sin(lo) * R], 1, [0, 0.05, 0], 0.3);
    }
    var from = latLon(38.5, 71, R);
    var to = [[51, 10], [41, 29], [31, 121], [23, 90], [55.7, 37.6], [22, 114], [45, 9], [19, 73], [40, -74]];
    var nArc = b.count(0.28), per = Math.floor(nArc / to.length);
    to.forEach(function (d) {
      var p2 = latLon(d[0], d[1], R);
      b.curve(per, function (t) {
        var q = add(from, mul(sub(p2, from), t));
        var l = len(q) || 1;
        var lift = R + Math.sin(t * Math.PI) * (0.25 + len(sub(p2, from)) * 0.18);
        return mul(q, lift / l);
      }, 0, 0.14, 1.8);
    });
    // orbit of yarn
    b.curve(b.count(0.08), function (t) {
      var a = t * TAU;
      return rot([Math.cos(a) * 1.85, 0, Math.sin(a) * 1.85], [1, 0, 0], 0.45);
    }, 0.5, 0.1, 1.2);
    return b.done(function (b) { // origin glow
      var d = sphereDir();
      b.push(add(mul(from, 1.02), mul(d, 0.06 * rnd())), 0.5, mul(d, 0.04), 1);
    });
  };

  // Placement for each shape: x = fraction of half-viewport width,
  // y offset, scale, alpha, spin (idle rotation), tilt.
  var PLACE = {
    boll:    { x: 0.42, y: 0.0,  s: 1.0,  a: 1.0,  spin: 1,   tilt: 0.42, my: 0.43, ms: 0.85 },
    duo:     { x: 0.0,  y: -0.12, s: 1.05, a: 0.8, spin: 0,   tilt: 0.1 },
    field:   { x: 0.0,  y: -0.1, s: 1.0,  a: 0.55, spin: 0,   tilt: 0.0 },
    'field-side': { x: 0.4, y: 0.12, s: 0.8, a: 0.9, spin: 0, tilt: 0.5, my: -0.3 },
    gin:     { x: 0.45, y: -0.12, s: 0.82, a: 0.95, spin: 0.6, tilt: 0.2, my: -0.62, ms: 0.75 },
    spin:    { x: 0.45, y: 0.05, s: 0.95, a: 0.95, spin: 1,   tilt: 0.15, my: -0.5, ms: 0.7 },
    weave:   { x: 0.42, y: 0.0,  s: 0.78, a: 0.95, spin: 0.4, tilt: 0.1, my: -0.62, ms: 0.8 },
    rings:   { x: 0.0,  y: 0.2, s: 0.75, a: 0.6, spin: 0,   tilt: 0.0, my: -0.1, ms: 0.7 },
    terrain: { x: 0.0,  y: -0.42, s: 1.0, a: 0.7,  spin: 0,   tilt: 0.0 },
    dust:    { x: 0.0,  y: 0.0,  s: 1.0,  a: 0.45, spin: 0.3, tilt: 0.0 },
    globe:   { x: 0.5,  y: 0.0,  s: 1.0,  a: 0.6,  spin: 1,   tilt: 0.4 },
    'globe-wide': { x: 0.0, y: 0.0, s: 1.45, a: 0.42, spin: 1, tilt: 0.4 }
  };

  // mobile placement defaults: same y, same scale
  Object.keys(PLACE).forEach(function (k) {
    var p = PLACE[k];
    if (p.my == null) p.my = p.y;
    if (p.ms == null) p.ms = 1;
  });

  // ---------- GL setup ----------
  var VS = [
    'attribute vec4 aFrom;',
    'attribute vec4 aTo;',
    'attribute vec4 aFromF;',
    'attribute vec4 aToF;',
    'attribute vec3 aRand;',
    'uniform float uT, uTime, uSize, uAlpha, uCamZ, uAspect, uMouseOn;',
    'uniform vec2 uMouse;',
    'uniform mat4 uProj;',
    'uniform mat3 uRot;',
    'uniform vec3 uOffset;',
    'uniform float uScale;',
    'uniform vec3 uC0, uC1, uC2;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main() {',
    '  float d = aRand.x * 0.4;',
    '  float t = clamp((uT - d) / 0.6, 0.0, 1.0);',
    '  t = t * t * (3.0 - 2.0 * t);',
    '  vec3 p = mix(aFrom.xyz, aTo.xyz, t);',
    '  float mid = sin(t * 3.14159);',
    // mid-morph the fibers lift into a soft swirl
    '  vec3 sw = vec3(-p.z, 0.0, p.x);',
    '  p += (normalize(p + vec3(0.0001)) * 0.3 + sw * 0.25) * mid * aRand.y;',
    // living threads: slide along the fiber and fade at both ends
    '  vec3 fl = mix(aFromF.xyz, aToF.xyz, t);',
    '  float sp = mix(aFromF.w, aToF.w, t);',
    '  float ph = fract(uTime * 0.32 * sp + aRand.x * 17.0);',
    '  float moving = step(0.0001, dot(fl, fl));',
    '  p += fl * (ph - 0.5) * 2.0;',
    '  float fade = mix(1.0, sin(ph * 3.14159), moving);',
    '  p += vec3(sin(uTime * 0.7 + aRand.y * 6.28), cos(uTime * 0.6 + aRand.z * 6.28), sin(uTime * 0.5 + aRand.x * 6.28)) * 0.01;',
    '  float w = mix(aFrom.w, aTo.w, t);',
    '  vec3 wp = uRot * (p * uScale) + uOffset;',
    '  vec4 mv = vec4(wp.xy, wp.z - uCamZ, 1.0);',
    '  gl_Position = uProj * mv;',
    // the cursor parts the fibers like a hand through cotton
    '  vec2 ndc = gl_Position.xy / gl_Position.w;',
    '  vec2 dm = (ndc - uMouse) * vec2(uAspect, 1.0);',
    '  float md = length(dm);',
    '  float push = uMouseOn * smoothstep(0.32, 0.0, md);',
    '  ndc += (dm / max(md, 0.001)) * push * 0.09 / vec2(uAspect, 1.0);',
    '  gl_Position.xy = ndc * gl_Position.w;',
    '  float depth = -mv.z;',
    '  gl_PointSize = uSize * (0.55 + aRand.z * 0.9) * (1.0 + push * 0.6) / depth;',
    '  vColor = w < 0.5 ? mix(uC0, uC1, w * 2.0) : mix(uC1, uC2, w * 2.0 - 1.0);',
    '  vColor = mix(vColor, vec3(1.0, 0.86, 0.5), push * 0.35);',
    '  float tw = 0.8 + 0.2 * sin(uTime * 1.5 + aRand.x * 40.0);',
    '  float fog = clamp(1.0 - (depth - uCamZ) * 0.32, 0.18, 1.25);',
    '  vAlpha = uAlpha * (0.5 + 0.5 * aRand.y) * tw * fog * (0.45 + 0.55 * fade);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'varying float vAlpha;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float r = length(c);',
    '  if (r > 0.5) discard;',
    '  float a = smoothstep(0.5, 0.0, r);',
    '  a = a * a * vAlpha;',
    '  gl_FragColor = vec4(vColor * a, a);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    document.documentElement.classList.remove('has-webgl');
    document.documentElement.classList.add('no-webgl');
    return;
  }
  gl.useProgram(prog);

  var loc = {};
  ['aFrom', 'aTo', 'aFromF', 'aToF', 'aRand'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
  ['uT', 'uTime', 'uSize', 'uAlpha', 'uCamZ', 'uAspect', 'uMouseOn', 'uMouse', 'uProj', 'uRot', 'uOffset', 'uScale', 'uC0', 'uC1', 'uC2']
    .forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });

  var buffers = {};
  function upload(arr) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    return buf;
  }
  Object.keys(shapes).forEach(function (k) {
    var data = shapes[k]();
    buffers[k] = { pos: upload(data.pos), flow: upload(data.flow) };
  });

  var rand = new Float32Array(N * 3);
  for (var i = 0; i < rand.length; i++) rand[i] = rnd();
  var randBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, randBuf);
  gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc.aRand);
  gl.vertexAttribPointer(loc.aRand, 3, gl.FLOAT, false, 0, 0);
  [loc.aFrom, loc.aTo, loc.aFromF, loc.aToF].forEach(function (l) { gl.enableVertexAttribArray(l); });

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  var boundFrom = null, boundTo = null;
  function bindShapes(a, b) {
    if (a !== boundFrom) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[a].pos);
      gl.vertexAttribPointer(loc.aFrom, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[a].flow);
      gl.vertexAttribPointer(loc.aFromF, 4, gl.FLOAT, false, 0, 0);
      boundFrom = a;
    }
    if (b !== boundTo) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[b].pos);
      gl.vertexAttribPointer(loc.aTo, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[b].flow);
      gl.vertexAttribPointer(loc.aToF, 4, gl.FLOAT, false, 0, 0);
      boundTo = b;
    }
  }

  // ---------- palette (follows the site theme) ----------
  var PALETTES = {
    dark:  { c0: [0.97, 0.94, 0.88], c1: [0.36, 0.78, 0.48], c2: [0.93, 0.72, 0.27], additive: true,  gain: 1.0 },
    light: { c0: [0.42, 0.37, 0.31], c1: [0.11, 0.45, 0.24], c2: [0.70, 0.52, 0.06], additive: false, gain: 1.35 }
  };
  function palette() {
    return PALETTES[document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'];
  }

  // ---------- resize / projection ----------
  var FOV = 40 * Math.PI / 180, CAMZ = 6.2;
  var W = 0, H = 0, dpr = 1, aspect = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = W / H;
    var f = 1 / Math.tan(FOV / 2), near = 0.1, far = 50;
    gl.uniformMatrix4fv(loc.uProj, false, new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ]));
    needsFrame = true;
  }

  // ---------- scroll keyframes ----------
  var keys = [];
  function measure() {
    var els = document.querySelectorAll('[data-shape]');
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    keys = [];
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var top = r.top + scrollY;
      var anchor = el.hasAttribute('data-shape-top') ? top : top + r.height / 2 - innerHeight / 2;
      anchor = Math.max(0, Math.min(maxScroll, anchor));
      var shape = el.getAttribute('data-shape');
      keys.push({ shape: shape, place: el.getAttribute('data-place') || shape, at: anchor });
    });
    keys.sort(function (a, b) { return a.at - b.at; });
    needsFrame = true;
  }

  // shape transitions happen in the middle of the gap between anchors,
  // so each shape holds still while its content is read
  function hold(t) {
    t = Math.max(0, Math.min(1, (t - 0.18) / 0.64));
    return t;
  }

  function stateAt(y) {
    if (!keys.length) return { a: 'boll', b: 'boll', pa: 'boll', pb: 'boll', t: 0 };
    if (y <= keys[0].at) return { a: keys[0].shape, b: keys[0].shape, pa: keys[0].place, pb: keys[0].place, t: 0 };
    for (var k = 0; k < keys.length - 1; k++) {
      var A = keys[k], B = keys[k + 1];
      if (y < B.at) {
        var span = B.at - A.at;
        var t = span > 1 ? (y - A.at) / span : 1;
        return { a: A.shape, b: B.shape, pa: A.place, pb: B.place, t: hold(t) };
      }
    }
    var L = keys[keys.length - 1];
    return { a: L.shape, b: L.shape, pa: L.place, pb: L.place, t: 0 };
  }

  // ---------- animation state ----------
  var smoothY = scrollY;
  var mouseX = 0, mouseY = 0, mx = 0, my = 0, px = 0, py = 0, mouseOn = 0, mouseTarget = 0;
  var angle = 0, lastNow = performance.now(), time = 0;
  var needsFrame = true;
  var visible = true;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixPlace(pa, pb, t) {
    var e = t * t * (3 - 2 * t);
    var o = {};
    for (var k in pa) o[k] = lerp(pa[k], pb[k], e);
    return o;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    if (!visible) return;

    var targetY = scrollY;
    var moving = Math.abs(targetY - smoothY) > 0.5 || Math.abs(mouseX - mx) > 0.001 || Math.abs(mouseY - my) > 0.001;
    if (reduceMotion && !moving && !needsFrame) return;

    smoothY = reduceMotion ? targetY : lerp(smoothY, targetY, 1 - Math.pow(0.0009, dt));
    mx = lerp(mx, mouseX, 1 - Math.pow(0.02, dt));
    my = lerp(my, mouseY, 1 - Math.pow(0.02, dt));
    px = lerp(px, mouseX, 1 - Math.pow(0.0005, dt));
    py = lerp(py, mouseY, 1 - Math.pow(0.0005, dt));
    mouseOn = lerp(mouseOn, reduceMotion ? 0 : mouseTarget, 1 - Math.pow(0.05, dt));
    if (!reduceMotion) time += dt;

    var st = stateAt(smoothY);
    var t = reduceMotion ? Math.round(st.t) : st.t;
    var pl = mixPlace(PLACE[st.pa], PLACE[st.pb], t);

    // idle turntable rotation; shapes with spin 0 settle facing forward
    if (!reduceMotion) {
      angle += dt * 0.12 * pl.spin;
      if (pl.spin < 0.5) {
        var target = Math.round(angle / TAU) * TAU;
        angle = lerp(angle, target, 1 - Math.pow(0.15, dt));
      }
    }

    var yaw = angle + mx * 0.35 + (reduceMotion ? 0 : Math.sin(time * 0.3) * 0.08 * (1 - pl.spin));
    var pitch = pl.tilt + my * 0.18;
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    // R = Rx(pitch) * Ry(yaw), column-major
    gl.uniformMatrix3fv(loc.uRot, false, new Float32Array([
      cy, sx * sy, -cx * sy,
      0, cx, sx,
      sy, -sx * cy, cx * cy
    ]));

    var halfH = Math.tan(FOV / 2) * CAMZ;
    var halfW = halfH * aspect;
    var narrow = aspect < 0.9;
    var fit = Math.min(1, halfW / 2.7);
    var offX = narrow ? 0 : pl.x * halfW;
    var scale = pl.s * (narrow ? Math.max(0.62, fit * 1.15) * pl.ms : Math.min(1.1, 0.75 + aspect * 0.12));
    if (!narrow && Math.abs(pl.x) > 0.1) scale *= 0.92;
    gl.uniform3f(loc.uOffset, offX, (narrow ? pl.my : pl.y) * halfH, 0);
    gl.uniform1f(loc.uScale, scale);

    var pal = palette();
    if (pal.additive) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform3fv(loc.uC0, pal.c0);
    gl.uniform3fv(loc.uC1, pal.c1);
    gl.uniform3fv(loc.uC2, pal.c2);

    // hero fade-in on first load and a gentle dim on small screens behind text
    // on phones the shape sits behind body copy: full strength in the hero, softer below
    var heroK = Math.max(0, Math.min(1, 1 - smoothY / H));
    // mid-morph the fibers spread over the copy, so they thin out on phones
    var morphDim = narrow ? 1 - 0.45 * Math.sin(t * Math.PI) : 1;
    var alpha = pl.a * pal.gain * (narrow ? lerp(0.45, 0.8, heroK) : 1) * morphDim * intro;
    gl.uniform1f(loc.uAlpha, alpha);
    gl.uniform1f(loc.uSize, (narrow ? 34 : 40) * dpr * Math.sqrt(H / 900) * (lowPower ? 1.15 : 1));
    gl.uniform1f(loc.uCamZ, CAMZ);
    gl.uniform1f(loc.uTime, time);
    gl.uniform1f(loc.uAspect, aspect);
    gl.uniform2f(loc.uMouse, px, -py);
    gl.uniform1f(loc.uMouseOn, mouseOn);
    gl.uniform1f(loc.uT, t);

    bindShapes(st.a, st.b);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);

    if (intro < 1) intro = Math.min(1, intro + dt * 0.8);
    needsFrame = false;
  }
  var intro = reduceMotion ? 1 : 0;

  // ---------- events ----------
  addEventListener('resize', function () { resize(); measure(); }, { passive: true });
  addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); }).observe(document.body);
  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mouseX = (e.clientX / innerWidth) * 2 - 1;
    mouseY = (e.clientY / innerHeight) * 2 - 1;
    mouseTarget = 1;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { mouseTarget = 0; });
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; lastNow = performance.now(); });
  new MutationObserver(function () { needsFrame = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    document.documentElement.classList.remove('has-webgl');
    document.documentElement.classList.add('no-webgl');
    visible = false;
  });

  resize();
  measure();
  requestAnimationFrame(frame);
})();
