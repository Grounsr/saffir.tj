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

  var N = lowPower ? 5200 : 11000;
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

  // ---------- shape builders ----------
  // Each builder fills a Float32Array of N * 4 (x, y, z, w).
  // w selects the color: 0 = cotton white, 0.5 = Saffir green, 1 = Zarrin gold.
  function Builder() {
    this.a = new Float32Array(N * 4);
    this.i = 0;
  }
  Builder.prototype.push = function (x, y, z, w) {
    if (this.i >= N) return;
    var o = this.i * 4;
    this.a[o] = x; this.a[o + 1] = y; this.a[o + 2] = z; this.a[o + 3] = w;
    this.i++;
  };
  Builder.prototype.count = function (f) { return Math.floor(N * f); };
  Builder.prototype.fill = function (fn) { while (this.i < N) fn(this); return this.a; };

  // fluffy cotton boll made of lobes plus green bracts
  function addBoll(b, n, cx, cy, cz, s, lobeW, bractW) {
    var lobes = [];
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * TAU + 0.3;
      lobes.push([Math.cos(a) * 0.64, 0.08 + (k % 2) * 0.12, Math.sin(a) * 0.64]);
    }
    lobes.push([0, 0.58, 0]);
    var nl = Math.floor(n * 0.86);
    for (var i = 0; i < nl; i++) {
      var L = lobes[i % lobes.length];
      var d = sphereDir();
      var bump = 1 + 0.12 * Math.sin(d[0] * 9 + d[1] * 5) * Math.cos(d[2] * 8 - d[1] * 4);
      // most fibers sit on the lobe surface so each lock reads as a soft shell
      var shell = rnd() < 0.78 ? 0.9 + 0.1 * rnd() : 0.35 + 0.55 * rnd();
      var r = 0.46 * bump * shell;
      b.push(cx + (L[0] + d[0] * r) * s, cy + (L[1] + d[1] * r * 1.12) * s, cz + (L[2] + d[2] * r) * s,
        rnd() < 0.05 ? 1 : lobeW);
    }
    // bracts: five pointed leaves under the boll
    for (var j = nl; j < n; j++) {
      var leaf = j % 5;
      var ang = leaf / 5 * TAU + 0.3 + TAU / 10;
      var t = Math.pow(rnd(), 0.8);
      var width = (1 - t) * 0.32 * Math.sin(t * Math.PI + 0.4);
      var off = rr(-1, 1) * width;
      var rad = 0.15 + t * 0.95;
      var x = Math.cos(ang) * rad - Math.sin(ang) * off;
      var z = Math.sin(ang) * rad + Math.cos(ang) * off;
      var y = -0.45 - 0.05 * t + 0.35 * t * t;
      b.push(cx + x * s, cy + y * s, cz + z * s, bractW);
    }
  }

  function addGlobe(b, n, cx, cy, cz, R, w, tilt) {
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    for (var i = 0; i < n; i++) {
      var lat, lon, kind = rnd();
      if (kind < 0.38) { // latitude lines
        lat = (Math.floor(rnd() * 7) - 3) / 3.6 * (Math.PI / 2);
        lon = rnd() * TAU;
      } else if (kind < 0.76) { // meridians
        lon = Math.floor(rnd() * 10) / 10 * TAU;
        lat = (rnd() - 0.5) * Math.PI;
      } else { // sparse surface
        var d = sphereDir();
        lat = Math.asin(d[1]); lon = Math.atan2(d[2], d[0]);
      }
      var j = (kind < 0.76 ? 0.012 : 0.03) * gauss();
      var x = Math.cos(lat) * Math.cos(lon) * (R + j);
      var y = Math.sin(lat) * (R + j);
      var z = Math.cos(lat) * Math.sin(lon) * (R + j);
      var ty = y * ct - x * st, tx = y * st + x * ct;
      b.push(cx + tx, cy + ty, cz + z, w);
    }
  }

  function latLon(lat, lon, R) {
    lat *= Math.PI / 180; lon *= Math.PI / 180;
    return [Math.cos(lat) * Math.cos(lon) * R, Math.sin(lat) * R, -Math.cos(lat) * Math.sin(lon) * R];
  }

  var shapes = {};

  shapes.boll = function () {
    var b = new Builder();
    addBoll(b, b.count(0.93), 0, 0.05, 0, 1.25, 0, 0.5);
    return b.fill(function (b) { // drifting fibers
      var d = sphereDir(), r = rr(1.4, 2.6);
      b.push(d[0] * r, d[1] * r * 0.7, d[2] * r, rnd() < 0.3 ? 1 : 0);
    });
  };

  shapes.duo = function () {
    var b = new Builder();
    addBoll(b, b.count(0.46), -1.55, -0.05, 0, 0.78, 0.5, 0.5);
    addGlobe(b, b.count(0.46), 1.55, 0, 0, 0.95, 1, 0.35);
    return b.fill(function (b) { // a thread connecting the two
      var t = rnd();
      b.push(-0.85 + t * 1.7, Math.sin(t * Math.PI) * 0.25 + gauss() * 0.03, gauss() * 0.04, t);
    });
  };

  shapes.field = function () {
    var b = new Builder();
    var rows = 15;
    return b.fill(function (b) {
      var row = Math.floor(rnd() * rows);
      var x = (row - (rows - 1) / 2) * 0.36;
      var z = rr(-5, 1.6);
      var spread = 1 + (1.6 - z) * 0.05;
      if (rnd() < 0.72) { // cotton puffs on plants
        var plant = Math.round(z / 0.22) * 0.22;
        var h = 0.18 + 0.12 * Math.sin(plant * 7 + row);
        var d = sphereDir();
        b.push(x * spread + d[0] * 0.07, -0.95 + h + d[1] * 0.06, plant + d[2] * 0.07, rnd() < 0.04 ? 1 : 0);
      } else { // furrows
        b.push(x * spread + 0.18 + gauss() * 0.02, -0.98, z, 0.5);
      }
    });
  };

  shapes.gin = function () {
    var b = new Builder();
    var nDisc = b.count(0.5);
    for (var i = 0; i < nDisc; i++) { // gin saws
      var k = i % 9;
      var x = (k - 4) * 0.24;
      var a = rnd() * TAU;
      var r = 0.95 * (1 + 0.035 * ((a * 22 / TAU) % 1)) - (rnd() < 0.25 ? rnd() * 0.5 : 0);
      b.push(x, Math.sin(a) * r, Math.cos(a) * r, 1);
    }
    return b.fill(function (b) { // lint pulled off the saws, flowing up and out
      var t = rnd();
      var x = rr(-1.1, 1.1);
      var a = -0.4 + t * 2.4;
      var r = 1.0 + t * 1.3 + gauss() * 0.15 * (1 + t);
      b.push(x * (1 + t * 0.4), Math.sin(a) * r * 0.9, Math.cos(a) * r * 0.6, 0);
    });
  };

  shapes.spin = function () {
    var b = new Builder();
    var H = 2.0;
    var nCone = b.count(0.62);
    for (var i = 0; i < nCone; i++) { // cross-wound yarn package
      var t = rnd();
      var y = -H / 2 + t * H;
      var R = 0.75 - t * 0.28;
      var dir = i % 2 ? 1 : -1;
      var a = t * 46 * dir + Math.floor(rnd() * 14) / 14 * TAU + gauss() * 0.02;
      b.push(Math.cos(a) * R, y, Math.sin(a) * R, 0);
    }
    var nCore = b.count(0.1);
    for (i = 0; i < nCore; i++) { // tube
      var ty = rr(-H / 2 - 0.25, H / 2 + 0.3);
      var ta = rnd() * TAU;
      var tr = ty < -H / 2 ? 0.85 : 0.22;
      b.push(Math.cos(ta) * tr, ty, Math.sin(ta) * tr, 1);
    }
    return b.fill(function (b) { // the strand of yarn leaving the package
      var t = rnd();
      var y = H / 2 + t * 1.6;
      var a = t * 9;
      var r = 0.45 * (1 - t) + 0.06;
      var tw = rnd() * TAU;
      b.push(Math.cos(a) * r + Math.cos(tw) * 0.025, y - 0.2, Math.sin(a) * r + Math.sin(tw) * 0.025, rnd() < 0.5 ? 0 : 0.5);
    });
  };

  shapes.weave = function () {
    var b = new Builder();
    var W = 2.4, Hh = 1.7, n = 22;
    var step = (2 * W) / n;
    function cloth(x, y) { return 0.25 * Math.sin(x * 1.4 + y * 0.8) + 0.12 * Math.cos(y * 2.2); }
    return b.fill(function (b) {
      var warp = rnd() < 0.5;
      var idx = Math.floor(rnd() * n);
      var u = rr(-1, 1);
      var x, y, over;
      if (warp) {
        x = -W + (idx + 0.5) * step; y = u * Hh;
        over = Math.sin((y / step) * Math.PI + idx * Math.PI);
      } else {
        y = -Hh + (idx + 0.5) * (2 * Hh / n); x = u * W;
        over = -Math.sin((x / step) * Math.PI + idx * Math.PI);
      }
      var z = cloth(x, y) + over * 0.045;
      // lay the cloth back like a fabric sheet
      var cy = Math.cos(-0.95), sy = Math.sin(-0.95);
      b.push(x, y * cy - z * sy, y * sy + z * cy, warp ? 0 : 0.5);
    });
  };

  shapes.rings = function () {
    var b = new Builder();
    function torus(n, cx, R, r, w) {
      for (var i = 0; i < n; i++) {
        var a = rnd() * TAU, c = rnd() * TAU;
        var rr2 = r * Math.sqrt(rnd());
        b.push(cx + (R + rr2 * Math.cos(c)) * Math.cos(a), (R + rr2 * Math.cos(c)) * Math.sin(a), rr2 * Math.sin(c), w);
      }
    }
    torus(b.count(0.42), -1.35, 0.95, 0.09, 0.5);
    torus(b.count(0.42), 1.35, 0.95, 0.09, 1);
    return b.fill(function (b) {
      var a = rnd() * TAU, r = rr(1.9, 2.6);
      b.push(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.55, gauss() * 0.3, 0);
    });
  };

  shapes.terrain = function () {
    var b = new Builder();
    function h(x, z) {
      var m = 0.9 * Math.exp(-((x - 1.8) * (x - 1.8) + (z + 3.2) * (z + 3.2)) / 2.2); // Pamir
      m += 0.55 * Math.exp(-((x + 0.8) * (x + 0.8) + (z + 3.8) * (z + 3.8)) / 1.6);
      m += 0.08 * Math.sin(x * 3.1) * Math.cos(z * 2.7);
      return m;
    }
    var Y0 = -0.95;
    var yov = [-0.75, 0.15], far = [0.55, 0.75];
    var nGround = b.count(0.8);
    for (var i = 0; i < nGround; i++) {
      var gx = rr(-2.8, 2.8), gz = rr(-5, 1.4);
      if (rnd() < 0.5) gz = Math.round(gz * 6) / 6; // contour-ish lines
      b.push(gx, Y0 + h(gx, gz), gz, 0);
    }
    return b.fill(function (b) { // two glowing beams: Yovon (Saffir) & Farkhor (Zarrin)
      var p = rnd() < 0.5 ? yov : far;
      var t = Math.pow(rnd(), 1.7);
      var a = rnd() * TAU, r = 0.05 + (1 - t) * 0.12 * rnd();
      b.push(p[0] + Math.cos(a) * r, Y0 + h(p[0], p[1]) + t * 1.5, p[1] + Math.sin(a) * r, p === yov ? 0.5 : 1);
    });
  };

  shapes.dust = function () {
    var b = new Builder();
    return b.fill(function (b) {
      b.push(rr(-4, 4), rr(-2.4, 2.4), rr(-4, 1.5), rnd() < 0.12 ? 1 : rnd() * 0.1);
    });
  };

  shapes.globe = function () {
    var b = new Builder();
    var R = 1.3;
    addGlobe(b, b.count(0.66), 0, 0, 0, R, 1, 0);
    // trade routes from Tajikistan to textile hubs
    var from = latLon(38.5, 71, R);
    var to = [[51, 10], [41, 29], [31, 121], [23, 90], [55.7, 37.6], [22, 114], [45, 9], [19, 73]];
    var nArc = b.count(0.3);
    for (var i = 0; i < nArc; i++) {
      var d = to[i % to.length];
      var p2 = latLon(d[0], d[1], R);
      var t = rnd();
      var x = from[0] + (p2[0] - from[0]) * t, y = from[1] + (p2[1] - from[1]) * t, z = from[2] + (p2[2] - from[2]) * t;
      var len = Math.sqrt(x * x + y * y + z * z);
      var lift = R + Math.sin(t * Math.PI) * 0.35;
      b.push(x / len * lift, y / len * lift, z / len * lift, 0);
    }
    return b.fill(function (b) { // origin glow
      var d = sphereDir();
      b.push(from[0] * 1.02 + d[0] * 0.05, from[1] * 1.02 + d[1] * 0.05, from[2] * 1.02 + d[2] * 0.05, 0.5);
    });
  };

  // Placement for each shape: x = fraction of half-viewport width,
  // y offset, scale, alpha, spin (idle rotation), tilt.
  var PLACE = {
    boll:    { x: 0.42, y: 0.0,  s: 1.0,  a: 1.0,  spin: 1,   tilt: 0.25, my: 0.43, ms: 0.85 },
    duo:     { x: 0.0,  y: 0.05, s: 1.05, a: 0.55, spin: 0,   tilt: 0.1 },
    field:   { x: 0.0,  y: -0.1, s: 1.0,  a: 0.55, spin: 0,   tilt: 0.0 },
    'field-side': { x: 0.4, y: 0.12, s: 0.8, a: 0.9, spin: 0, tilt: 0.5, my: -0.3 },
    gin:     { x: 0.45, y: -0.12, s: 0.82, a: 0.95, spin: 0.6, tilt: 0.2, my: -0.62, ms: 0.75 },
    spin:    { x: 0.45, y: -0.12, s: 0.85, a: 0.95, spin: 1,   tilt: 0.15, my: -0.62, ms: 0.7 },
    weave:   { x: 0.42, y: 0.0,  s: 0.78, a: 0.95, spin: 0.4, tilt: 0.1, my: -0.62, ms: 0.8 },
    rings:   { x: 0.0,  y: 0.0,  s: 1.0,  a: 0.42, spin: 0,   tilt: 0.0 },
    terrain: { x: 0.0,  y: -0.22, s: 1.0, a: 0.7,  spin: 0,   tilt: 0.0 },
    dust:    { x: 0.0,  y: 0.0,  s: 1.0,  a: 0.45, spin: 0.3, tilt: 0.0 },
    globe:   { x: 0.5,  y: 0.0,  s: 1.0,  a: 0.6,  spin: 1,   tilt: 0.4 },
    'globe-wide': { x: 0.0, y: 0.0, s: 1.45, a: 0.5, spin: 1, tilt: 0.4 }
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
    'attribute vec3 aRand;',
    'uniform float uT, uTime, uSize, uAlpha, uCamZ;',
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
    '  p += normalize(p + vec3(0.0001)) * mid * 0.35 * aRand.y;',
    '  p += vec3(sin(uTime * 0.7 + aRand.y * 6.28), cos(uTime * 0.6 + aRand.z * 6.28), sin(uTime * 0.5 + aRand.x * 6.28)) * 0.018;',
    '  float w = mix(aFrom.w, aTo.w, t);',
    '  vec3 wp = uRot * (p * uScale) + uOffset;',
    '  vec4 mv = vec4(wp.xy, wp.z - uCamZ, 1.0);',
    '  gl_Position = uProj * mv;',
    '  float depth = -mv.z;',
    '  gl_PointSize = uSize * (0.55 + aRand.z * 0.9) / depth;',
    '  vColor = w < 0.5 ? mix(uC0, uC1, w * 2.0) : mix(uC1, uC2, w * 2.0 - 1.0);',
    '  float tw = 0.75 + 0.25 * sin(uTime * 1.5 + aRand.x * 40.0);',
    '  float fog = clamp(1.0 - (depth - uCamZ) * 0.32, 0.18, 1.25);',
    '  vAlpha = uAlpha * (0.45 + 0.55 * aRand.y) * tw * fog;',
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
  ['aFrom', 'aTo', 'aRand'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
  ['uT', 'uTime', 'uSize', 'uAlpha', 'uCamZ', 'uProj', 'uRot', 'uOffset', 'uScale', 'uC0', 'uC1', 'uC2']
    .forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });

  var buffers = {};
  Object.keys(shapes).forEach(function (k) {
    var data = shapes[k]();
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    buffers[k] = buf;
  });

  var rand = new Float32Array(N * 3);
  for (var i = 0; i < rand.length; i++) rand[i] = rnd();
  var randBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, randBuf);
  gl.bufferData(gl.ARRAY_BUFFER, rand, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc.aRand);
  gl.vertexAttribPointer(loc.aRand, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc.aFrom);
  gl.enableVertexAttribArray(loc.aTo);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  var boundFrom = null, boundTo = null;
  function bindShapes(a, b) {
    if (a !== boundFrom) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[a]);
      gl.vertexAttribPointer(loc.aFrom, 4, gl.FLOAT, false, 0, 0);
      boundFrom = a;
    }
    if (b !== boundTo) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[b]);
      gl.vertexAttribPointer(loc.aTo, 4, gl.FLOAT, false, 0, 0);
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
  var mouseX = 0, mouseY = 0, mx = 0, my = 0;
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
    var alpha = pl.a * pal.gain * (narrow ? 0.7 : 1) * intro;
    gl.uniform1f(loc.uAlpha, alpha);
    gl.uniform1f(loc.uSize, (narrow ? 34 : 40) * dpr * Math.sqrt(H / 900) * (lowPower ? 1.15 : 1));
    gl.uniform1f(loc.uCamZ, CAMZ);
    gl.uniform1f(loc.uTime, time);
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
  }, { passive: true });
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
