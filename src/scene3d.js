// Premium 3D stage for the site: sculpted cotton, gold and lacquer objects
// that change with the page as you scroll. Built into ../scene3d.js with
// `npm run build`. Each [data-shape] element in index.html is a keyframe.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Object3D,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial,
  IcosahedronGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, TubeGeometry,
  LatheGeometry, ExtrudeGeometry, PlaneGeometry, ConeGeometry, BufferGeometry, Float32BufferAttribute,
  Shape, Path, Vector2, Vector3, Color, CatmullRomCurve3, Curve,
  DirectionalLight, HemisphereLight, PMREMGenerator, CanvasTexture,
  ACESFilmicToneMapping, SRGBColorSpace, DoubleSide, AdditiveBlending, RepeatWrapping, MathUtils
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const canvas = document.getElementById('fiber-canvas');
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = Math.min(screen.width, screen.height) < 768 || innerWidth < 768;
const lowPower = isSmall || (navigator.hardwareConcurrency || 8) <= 4;
const TAU = Math.PI * 2;

let renderer;
try {
  renderer = canvas && new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }

if (!renderer) {
  root.classList.add('no-webgl');
} else {
  root.classList.add('has-webgl');
  start();
}

function start() {
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  canvas.style.transition = 'none';
  canvas.style.opacity = '0';

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 9);

  const key = new DirectionalLight(0xfff1d6, 2.2);
  key.position.set(4, 6, 6);
  const rim = new DirectionalLight(0x9fd8b8, 1.4);
  rim.position.set(-6, 2, -4);
  const hemi = new HemisphereLight(0xfff6e8, 0x0b1a12, 0.5);
  scene.add(key, rim, hemi);

  // ---------- seeded random + smooth noise ----------
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rr = (a, b) => a + (b - a) * rnd();
  function hash(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
      l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
      w);
  }

  // ---------- materials ----------
  const M = {
    cotton: new MeshPhysicalMaterial({ color: 0xf6f1e7, roughness: 0.82, sheen: 1, sheenRoughness: 0.45, sheenColor: 0xffffff, envMapIntensity: 0.7 }),
    gold: new MeshPhysicalMaterial({ color: 0xe0b45a, metalness: 1, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.15, envMapIntensity: 1.25 }),
    goldSatin: new MeshPhysicalMaterial({ color: 0xc99a45, metalness: 1, roughness: 0.42, envMapIntensity: 1.1, side: DoubleSide }),
    emerald: new MeshPhysicalMaterial({ color: 0x0f6b3e, metalness: 0.1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4, emissive: 0x04301a, emissiveIntensity: 0.6 }),
    leaf: new MeshPhysicalMaterial({ color: 0x2c6e43, roughness: 0.45, sheen: 0.6, sheenColor: 0x9fe0b4, envMapIntensity: 0.8, side: DoubleSide }),
    lacquer: new MeshPhysicalMaterial({ color: 0x07100b, metalness: 0.2, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.4 }),
    seed: new MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.5, metalness: 0.1 }),
    glow: new MeshBasicMaterial({ color: 0xffd98a, toneMapped: false }),
    glowGreen: new MeshBasicMaterial({ color: 0x7dffb0, toneMapped: false }),
    beam: new MeshBasicMaterial({ color: 0xffcf73, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    wave: new MeshBasicMaterial({ color: 0xf2c56b, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
  };

  // ---------- geometry helpers ----------
  const detail = lowPower ? 4 : 5;
  // cotton puff: a soft union of spheres (billowy lobes) with a faint fibrous fuzz
  function puffGeo(det, lobes, s, size = 1) {
    let g = new IcosahedronGeometry(1, det);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const keep = seed; seed = 1000 + Math.floor(s * 7919);
    const L = [{ c: new Vector3(), r: 0.62 }];
    for (let k = 0; k < lobes; k++) {
      const d = new Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize();
      L.push({ c: d.multiplyScalar(rr(0.3, 0.5) * (2 - size)), r: rr(0.36, 0.55) * size });
    }
    seed = keep;
    const p = g.attributes.position, v = new Vector3(), K = 16;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let sum = 0;
      for (const { c, r } of L) {
        const b = v.dot(c), disc = r * r - c.lengthSq() + b * b;
        const t = disc > 0 ? b + Math.sqrt(disc) : 0;
        sum += Math.exp(K * t);
      }
      const t = Math.log(sum) / K;
      const fuzz = noise(v.x * 14 + s, v.y * 14, v.z * 14 - s) * 0.025;
      v.multiplyScalar(t + fuzz);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  // parametric surface: fn(u, v, target) with u,v in [0,1]
  function surface(fn, nu, nv) {
    const pos = [], idx = [], t = new Vector3();
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { fn(i / nu, j / nv, t); pos.push(t.x, t.y, t.z); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  class FnCurve extends Curve {
    constructor(fn) { super(); this.fn = fn; }
    getPoint(t, target = new Vector3()) { return this.fn(t, target); }
  }
  const tube = (fn, seg, r, rs = 8) => new TubeGeometry(new FnCurve(fn), seg, r, rs, false);
  const ring = (R, r, seg = 160) => new TorusGeometry(R, r, 10, seg);
  const mesh = (g, m) => new Mesh(g, m);
  const latLon = (lat, lon, R, out = new Vector3()) => {
    const la = MathUtils.degToRad(lat), lo = MathUtils.degToRad(lon);
    return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).multiplyScalar(R);
  };
  const SEG = lowPower ? 0.6 : 1; // tessellation budget
  let narrowNow = innerWidth / innerHeight < 0.9;

  // ---------- builders: each returns { group, update(time) } ----------
  const builders = {};

  function cottonBoll(scale, withBur = true) {
    const g = new Group();
    const locks = 5;
    for (let k = 0; k < locks; k++) {
      const a = (k / locks) * TAU;
      const m = mesh(puffGeo(detail, 14, k * 3.1 + 1, 0.8), M.cotton);
      m.position.set(Math.cos(a) * 0.44, 0.1 + (k % 2) * 0.06, Math.sin(a) * 0.44);
      m.scale.set(0.58, 0.62, 0.58);
      m.rotation.set(rnd(), rnd() * TAU, rnd());
      g.add(m);
    }
    const top = mesh(puffGeo(detail, 14, 9.7, 0.8), M.cotton);
    top.position.set(0, 0.5, 0); top.scale.setScalar(0.52);
    g.add(top);
    if (withBur) {
      // dried carpels: gold shells cupping the locks from below, tips curling out
      const carpel = surface((u, v, t) => {
        const a = 0.6 + u * 1.25;
        const w = 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.75);
        const curl = Math.max(0, a - 1.3);
        const vv = v * 2 - 1;
        const rc = 0.8 * Math.sin(Math.min(a, 1.3)) * (1 - 0.1 * vv * vv) + curl * curl * 1.6 + 0.05;
        const y = -Math.cos(Math.min(a, 1.3)) * 0.8 + curl * 0.25 - 0.15;
        const th = vv * w / Math.max(0.4, rc);
        t.set(Math.sin(th) * rc, y, Math.cos(th) * rc);
      }, Math.round(36 * SEG), Math.round(14 * SEG));
      for (let k = 0; k < locks; k++) {
        const c = mesh(carpel, M.goldSatin);
        c.rotation.y = (k + 0.5) / locks * TAU;
        g.add(c);
      }
      // calyx bracts and stem
      const bract = surface((u, v, t) => {
        const w = 0.5 * Math.sin(Math.PI * u) * (1 - u * 0.4);
        const x = (v * 2 - 1) * w;
        t.set(x, -0.82 - u * 0.25 + u * u * 0.55 - x * x * 0.4, 0.15 + u * 0.95);
      }, 16, 10);
      for (let k = 0; k < 3; k++) {
        const b = mesh(bract, M.leaf);
        b.rotation.y = (k / 3) * TAU + 0.4;
        g.add(b);
      }
      const base = mesh(new SphereGeometry(0.26, 32, 20), M.gold);
      base.position.y = -0.62; base.scale.y = 0.7;
      g.add(base);
      const stem = mesh(new CylinderGeometry(0.05, 0.08, 0.7, 16), M.gold);
      stem.position.y = -1.15; stem.rotation.z = 0.15;
      g.add(stem);
    }
    g.scale.setScalar(scale);
    return g;
  }

  function goldOrbit(R, tiltX, tiltZ, beads = 1, r = 0.012) {
    const g = new Group();
    g.add(mesh(ring(R, r, Math.round(220 * SEG)), M.gold));
    const bs = [];
    for (let i = 0; i < beads; i++) {
      const b = mesh(new SphereGeometry(0.055, 20, 14), M.glow);
      g.add(b); bs.push(b);
    }
    g.rotation.set(tiltX, 0, tiltZ);
    return {
      group: g,
      update(time, speed = 0.35) {
        bs.forEach((b, i) => { const a = time * speed + i * TAU / bs.length; b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); });
      }
    };
  }

  builders.boll = () => {
    const g = new Group();
    const boll = cottonBoll(1.15);
    g.add(boll);
    const o1 = goldOrbit(1.85, 1.25, 0.25, 2);
    const o2 = goldOrbit(2.15, 1.45, -0.35, 1, 0.006);
    g.add(o1.group, o2.group);
    return {
      group: g, update(t) {
        boll.position.y = Math.sin(t * 0.8) * 0.06;
        boll.rotation.y = t * 0.15;
        o1.update(t, 0.4); o2.update(t, -0.25);
      }
    };
  };

  function globe(R, arcsOn = true) {
    const g = new Group();
    g.add(mesh(new SphereGeometry(R, Math.round(72 * SEG), Math.round(48 * SEG)), M.lacquer));
    const lineR = R * 0.004 + 0.004;
    for (let i = 0; i < 12; i++) {
      const m = mesh(ring(R * 1.002, lineR, Math.round(120 * SEG)), M.gold);
      m.rotation.y = (i / 12) * Math.PI;
      g.add(m);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const rr2 = R * Math.cos(MathUtils.degToRad(lat));
      const m = mesh(ring(rr2 * 1.002, lineR, Math.round(120 * SEG)), M.gold);
      m.rotation.x = Math.PI / 2; m.position.y = R * Math.sin(MathUtils.degToRad(lat));
      g.add(m);
    }
    const beads = [];
    if (arcsOn) {
      // trade routes from Tajikistan
      const home = latLon(38.6, 68.8, R);
      const pin = mesh(new SphereGeometry(R * 0.05, 20, 14), M.glow);
      pin.position.copy(home); g.add(pin);
      const halo = mesh(ring(R * 0.09, R * 0.008, 48), M.glow);
      halo.position.copy(home.clone().multiplyScalar(1.01)); halo.lookAt(home.clone().multiplyScalar(2)); g.add(halo);
      [[39.9, 116.4], [41, 29], [55.7, 37.6], [51, 10], [28.6, 77.2], [35.7, 51.4], [25.2, 55.3]].forEach(([la, lo], i) => {
        const end = latLon(la, lo, R);
        const dist = home.angleTo(end);
        const fn = (t, out) => {
          out.copy(home).lerp(end, t).normalize();
          return out.multiplyScalar(R * (1 + Math.sin(Math.PI * t) * (0.12 + dist * 0.35)));
        };
        g.add(mesh(tube(fn, Math.round(64 * SEG), R * 0.006 + 0.003, 6), M.gold));
        const d = mesh(new SphereGeometry(R * 0.022 + 0.01, 12, 8), M.glow);
        d.position.copy(end); g.add(d);
        const b = mesh(new SphereGeometry(R * 0.028 + 0.012, 12, 8), M.glow);
        g.add(b); beads.push({ b, fn, off: i * 0.37 });
      });
      g.rotation.y = -MathUtils.degToRad(68.8) + 0.3;
      g.rotation.x = 0.35;
    }
    const tmp = new Vector3();
    return {
      group: g,
      update(time) { beads.forEach(({ b, fn, off }) => { const t = (time * 0.18 + off) % 1; fn(t, tmp); b.position.copy(tmp); }); }
    };
  }

  builders.globe = () => {
    const g = new Group();
    const gl = globe(1.35);
    const spin = new Group(); spin.add(gl.group); g.add(spin);
    const o = goldOrbit(1.95, 1.2, 0.3, 2);
    g.add(o.group);
    return { group: g, orbit: o.group, update(t) { spin.rotation.y = t * 0.12; gl.update(t); o.update(t, 0.3); } };
  };

  builders.duo = () => {
    const g = new Group();
    const boll = cottonBoll(0.62);
    boll.position.set(-2.1, 0.05, 0);
    const gl = globe(0.7, false);
    gl.group.position.set(2.1, 0, 0);
    g.add(boll, gl.group);
    // a gold thread binds the two companies, a light travels along it
    const fn = (t, out) => out.set(MathUtils.lerp(-1.45, 1.45, t), Math.sin(Math.PI * t) * 0.75, Math.sin(Math.PI * t * 2) * 0.2);
    g.add(mesh(tube(fn, 100, 0.014, 8), M.gold));
    const fn2 = (t, out) => out.set(MathUtils.lerp(-1.45, 1.45, t), Math.sin(Math.PI * t) * 0.55, -Math.sin(Math.PI * t * 2) * 0.2);
    g.add(mesh(tube(fn2, 100, 0.007, 6), M.gold));
    const beads = [0, 0.5].map(() => { const b = mesh(new SphereGeometry(0.05, 16, 10), M.glow); g.add(b); return b; });
    // emerald gem at the centre of the bond
    const gem = mesh(new IcosahedronGeometry(0.26, 0), M.emerald);
    gem.position.set(0, 0.75, 0);
    g.add(gem);
    const tmp = new Vector3();
    return {
      group: g, update(t) {
        boll.rotation.y = t * 0.25; gl.group.rotation.y = -t * 0.2;
        gem.rotation.set(t * 0.4, t * 0.6, 0); gem.position.y = 0.75 + Math.sin(t) * 0.05;
        beads.forEach((b, i) => { const u = (t * 0.22 + i * 0.5) % 1; (i ? fn2 : fn)(i ? 1 - u : u, tmp); b.position.copy(tmp); });
      }
    };
  };

  function plinth(R, h = 0.16) {
    const g = new Group();
    const base = mesh(new CylinderGeometry(R, R * 1.02, h, Math.round(120 * SEG)), M.lacquer);
    g.add(base);
    const rimT = mesh(ring(R, 0.022, Math.round(200 * SEG)), M.gold);
    rimT.rotation.x = Math.PI / 2; rimT.position.y = h / 2;
    const rimB = rimT.clone(); rimB.position.y = -h / 2; rimB.scale.setScalar(1.02);
    g.add(rimT, rimB);
    return g;
  }

  builders.field = () => {
    const g = new Group();
    const R = 2.1;
    g.add(plinth(R));
    // rows of plants on the lacquer stage
    const plants = [];
    for (let x = -1.8; x <= 1.8; x += 0.4) for (let z = -1.8; z <= 1.8; z += 0.3) {
      if (x * x + z * z < (R - 0.25) * (R - 0.25)) plants.push([x + rr(-0.04, 0.04), z + rr(-0.05, 0.05), rr(0.32, 0.5)]);
    }
    const stemG = new CylinderGeometry(0.012, 0.018, 1, 6); stemG.translate(0, 0.5, 0);
    const stems = new InstancedMesh(stemG, M.leaf, plants.length);
    const leafG = new SphereGeometry(1, 10, 6); leafG.scale(1, 0.18, 0.55);
    const leaves = new InstancedMesh(leafG, M.leaf, plants.length * 2);
    const puffG = puffGeo(2, 6, 4.2);
    const puffs = new InstancedMesh(puffG, M.cotton, plants.length * 3);
    const o = new Object3D();
    let li = 0, pi = 0;
    plants.forEach(([x, z, h], i) => {
      o.position.set(x, 0.08, z); o.rotation.set(rr(-0.08, 0.08), 0, rr(-0.08, 0.08)); o.scale.set(1, h, 1); o.updateMatrix();
      stems.setMatrixAt(i, o.matrix);
      for (let k = 0; k < 2; k++) {
        o.position.set(x + (k ? 0.06 : -0.06), 0.08 + h * (0.35 + k * 0.2), z);
        o.rotation.set(0, rnd() * TAU, (k ? -0.4 : 0.4)); o.scale.setScalar(0.07); o.updateMatrix();
        leaves.setMatrixAt(li++, o.matrix);
      }
      const n = 2 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < 3; k++) {
        if (k < n) {
          o.position.set(x + rr(-0.06, 0.06), 0.08 + h * (0.7 + k * 0.17), z + rr(-0.05, 0.05));
          o.rotation.set(rnd(), rnd(), rnd()); o.scale.setScalar(rr(0.045, 0.07));
        } else o.scale.setScalar(0);
        o.updateMatrix();
        puffs.setMatrixAt(pi++, o.matrix);
      }
    });
    g.add(stems, leaves, puffs);
    const sway = new Group(); // leaves the base still; plants are static instances
    g.add(sway);
    g.rotation.x = 0.55;
    return { group: g, update(t) { g.rotation.y = Math.sin(t * 0.2) * 0.15; } };
  };

  builders.gin = () => {
    const g = new Group();
    // gin saws: a stack of toothed gold discs on an axle
    const teeth = 48, Ro = 0.95, Ri = 0.87;
    const s = new Shape();
    for (let i = 0; i <= teeth; i++) {
      const a0 = (i / teeth) * TAU, a1 = ((i + 0.75) / teeth) * TAU;
      if (i === 0) s.moveTo(Math.cos(a0) * Ri, Math.sin(a0) * Ri);
      else s.lineTo(Math.cos(a0) * Ri, Math.sin(a0) * Ri);
      if (i < teeth) s.lineTo(Math.cos(a1) * Ro, Math.sin(a1) * Ro);
    }
    const hole = new Path(); hole.absarc(0, 0, 0.16, 0, TAU, true); s.holes.push(hole);
    const sawG = new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
    sawG.center();
    const drum = new Group();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const d = mesh(sawG, M.gold);
      d.position.z = (i - (n - 1) / 2) * 0.2;
      drum.add(d);
      if (i < n - 1) {
        const sp = mesh(new CylinderGeometry(0.62, 0.62, 0.15, Math.round(64 * SEG)), M.lacquer);
        sp.rotation.x = Math.PI / 2; sp.position.z = d.position.z + 0.1;
        drum.add(sp);
      }
    }
    const axle = mesh(new CylinderGeometry(0.16, 0.16, 1.9, 32), M.gold);
    axle.rotation.x = Math.PI / 2;
    drum.add(axle);
    g.add(drum);
    // cotton fed in from above, seeds falling away below
    const cluster = (n, s0, spread) => {
      const c = new Group();
      for (let i = 0; i < n; i++) {
        const m = mesh(puffGeo(detail - 1, 7, s0 + i * 1.7), M.cotton);
        m.position.set(rr(-spread, spread) * 0.6, rr(-0.08, 0.08), rr(-spread, spread));
        m.scale.setScalar(rr(0.2, 0.3));
        c.add(m);
      }
      return c;
    };
    const feed = cluster(6, 2.2, 0.6);
    feed.position.set(-0.45, 1.0, 0);
    g.add(feed);
    const lint = cluster(5, 5.5, 0.55);
    lint.position.set(1.1, 0.2, 0); lint.scale.setScalar(0.85);
    g.add(lint);
    const seedG = new SphereGeometry(1, 12, 8); seedG.scale(0.05, 0.08, 0.05);
    const SEEDS = 26;
    const seeds = new InstancedMesh(seedG, M.seed, SEEDS);
    const sd = Array.from({ length: SEEDS }, () => [rr(-0.5, 0.2), rr(-0.8, 0.8), rnd(), rnd() * TAU]);
    g.add(seeds);
    // housing arcs
    const arc = mesh(new TorusGeometry(1.18, 0.03, 12, 120, Math.PI * 1.1), M.gold);
    arc.rotation.z = Math.PI * 0.55;
    const arc2 = arc.clone(); arc2.position.z = 0.75; const arc3 = arc.clone(); arc3.position.z = -0.75;
    g.add(arc2, arc3);
    const o = new Object3D();
    g.rotation.set(0.25, -0.95, 0);
    return {
      group: g, update(t) {
        drum.rotation.z = -t * 0.9;
        feed.rotation.y = Math.sin(t * 0.5) * 0.2;
        lint.position.x = 1.05 + Math.sin(t * 0.7) * 0.05;
        sd.forEach(([x, z, ph, rot], i) => {
          const k = (t * 0.25 + ph) % 1;
          o.position.set(x - k * 0.2, -0.95 - k * 1.3, z);
          o.rotation.set(rot + t, rot, 0);
          o.scale.setScalar(Math.sin(Math.PI * k));
          o.updateMatrix(); seeds.setMatrixAt(i, o.matrix);
        });
        seeds.instanceMatrix.needsUpdate = true;
      }
    };
  };

  function windingTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#e9e1d2'; x.fillRect(0, 0, 512, 512);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = -512; i < 1024; i += 6) {
        const l = 200 + Math.floor(rnd() * 55);
        x.strokeStyle = `rgba(${l},${l - 8},${l - 22},0.9)`;
        x.lineWidth = 2 + rnd() * 2;
        x.beginPath();
        if (pass) { x.moveTo(i, 0); x.lineTo(i + 512, 512); } else { x.moveTo(i + 512, 0); x.lineTo(i, 512); }
        x.stroke();
      }
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  builders.spin = () => {
    const g = new Group();
    const tex = windingTexture();
    const yarn = new MeshPhysicalMaterial({ color: 0xffffff, map: tex, bumpMap: tex, bumpScale: 2, roughness: 0.8, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.5, envMapIntensity: 0.7 });
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const y = -0.95 + u * 1.75;
      let r = MathUtils.lerp(0.95, 0.5, u);
      if (u < 0.06) r *= 0.9 + u / 0.06 * 0.1; // rounded bottom shoulder
      if (u > 0.92) r *= 1 - (u - 0.92) / 0.08 * 0.25; // rounded top
      prof.push(new Vector2(r, y));
    }
    const cone = new Group();
    cone.add(mesh(new LatheGeometry(prof, Math.round(96 * SEG)), yarn));
    const core = mesh(new CylinderGeometry(0.3, 0.42, 2.05, Math.round(64 * SEG), 1, true), M.gold);
    core.material = M.goldSatin;
    core.position.y = -0.05;
    cone.add(core);
    const lip = mesh(ring(0.42, 0.025, 80), M.gold); lip.rotation.x = Math.PI / 2; lip.position.y = -1.08;
    cone.add(lip);
    g.add(cone);
    // the thread rising off the package through a gold guide
    const guideY = 2.0;
    const guide = mesh(ring(0.16, 0.025, 60), M.gold);
    guide.rotation.x = Math.PI / 2; guide.position.y = guideY;
    g.add(guide);
    let threadMesh = null, ph = 0;
    const threadFn = (t, out) => {
      const r = 0.55 * (1 - t) * Math.sin(Math.PI * Math.min(1, t * 1.2) * 0.9) + 0.02;
      const a = ph + t * TAU * 1.5;
      return out.set(Math.cos(a) * (0.6 * (1 - t) + r * t), 0.8 + t * (guideY - 0.8), Math.sin(a) * (0.6 * (1 - t) + r * t));
    };
    const rebuild = () => {
      if (threadMesh) { threadMesh.geometry.dispose(); g.remove(threadMesh); }
      threadMesh = mesh(tube(threadFn, 64, 0.012, 6), M.cotton);
      g.add(threadMesh);
    };
    rebuild();
    const o = goldOrbit(1.35, Math.PI / 2, 0, 1, 0.01);
    o.group.position.y = -1.08;
    g.add(o.group);
    g.rotation.x = 0.12;
    let last = -1;
    return {
      group: g, update(t) {
        cone.rotation.y = t * 0.8;
        ph = -t * 2.2;
        o.update(t, 0.6);
        if (Math.floor(t * 30) !== last) { last = Math.floor(t * 30); rebuild(); }
      }
    };
  };

  builders.weave = () => {
    const g = new Group();
    const N = 9, sp = 0.24, A = 0.055, half = (N - 1) / 2 * sp;
    const drape = (x, z) => Math.sin(x * 1.3 + 0.4) * 0.12 + Math.cos(z * 1.1) * 0.1;
    const seg = Math.round(90 * SEG);
    for (let i = 0; i < N; i++) {
      const x = (i - (N - 1) / 2) * sp;
      g.add(mesh(tube((t, out) => {
        const z = MathUtils.lerp(-half - 0.2, half + 0.2, t);
        return out.set(x, drape(x, z) + A * Math.cos(Math.PI * z / sp + i * Math.PI), z);
      }, seg, 0.07, 10), M.cotton));
      const z = (i - (N - 1) / 2) * sp;
      g.add(mesh(tube((t, out) => {
        const xx = MathUtils.lerp(-half - 0.2, half + 0.2, t);
        return out.set(xx, drape(xx, z) - A * Math.cos(Math.PI * xx / sp + i * Math.PI), z);
      }, seg, 0.06, 10), M.gold));
    }
    // the shuttle slides across, trailing a gold thread
    const shuttle = mesh(new LatheGeometry([0, 0.3, 0.5, 0.7, 1].map((u, i, a) => new Vector2(Math.sin(Math.PI * u) * 0.085 + 0.001, (u - 0.5) * 0.9)), 32), M.gold);
    shuttle.rotation.z = Math.PI / 2;
    g.add(shuttle);
    const inlay = mesh(new CylinderGeometry(0.03, 0.03, 0.25, 16), M.emerald);
    inlay.rotation.z = Math.PI / 2;
    shuttle.add(inlay); inlay.rotation.set(0, 0, 0); inlay.position.set(0.07, 0, 0); inlay.scale.set(1, 1, 1);
    g.rotation.set(0.75, 0.6, 0);
    return {
      group: g, update(t) {
        const k = Math.sin(t * 0.9);
        shuttle.position.set(k * (half + 0.6), drape(k * half, half + 0.35) + 0.12, half + 0.35);
        g.rotation.y = 0.6 + Math.sin(t * 0.25) * 0.15;
      }
    };
  };

  function medallion() {
    const g = new Group();
    const prof = [
      [0, 0.05], [0.62, 0.05], [0.66, 0.07], [0.74, 0.08], [0.8, 0.06], [0.82, 0], [0.8, -0.06], [0.74, -0.08], [0.66, -0.07], [0.62, -0.05], [0, -0.05]
    ].map(([r, y]) => new Vector2(r, y));
    const coin = mesh(new LatheGeometry(prof, Math.round(96 * SEG)), M.gold);
    coin.rotation.x = Math.PI / 2;
    g.add(coin);
    const enamel = mesh(new CylinderGeometry(0.42, 0.42, 0.11, Math.round(64 * SEG)), M.emerald);
    enamel.rotation.x = Math.PI / 2;
    g.add(enamel);
    // guilloché rose engraved around the enamel
    const rose = (t, out) => {
      const a = t * TAU, r = 0.53 + 0.04 * Math.sin(a * 14);
      return out.set(Math.cos(a) * r, Math.sin(a) * r, 0.06);
    };
    const roseG = tube(rose, Math.round(360 * SEG), 0.008, 5);
    const front = mesh(roseG, M.gold); g.add(front);
    const back = mesh(roseG, M.gold); back.rotation.y = Math.PI; g.add(back);
    const star = mesh(new IcosahedronGeometry(0.14, 0), M.gold);
    star.scale.set(1, 1, 0.45); g.add(star);
    return g;
  }

  builders.rings = () => {
    const g = new Group();
    const coins = [-1, 1].map((side, i) => {
      const holder = new Group();
      const c = medallion();
      const o = goldOrbit(1.1, 1.3, side * 0.3, 1, 0.008);
      holder.add(c, o.group);
      g.add(holder);
      return { holder, c, o, side };
    });
    return {
      group: g, update(t) {
        coins.forEach(({ holder, c, o, side }, i) => {
          holder.position.set(side * (narrowNow ? 1.25 : 3.6), Math.sin(t * 0.9 + i * 2) * 0.06, 0);
          c.rotation.y = Math.sin(t * 0.6 + i * 1.3) * 0.5 - side * 0.25;
          o.update(t, 0.5 * side);
        });
      }
    };
  };

  builders.terrain = () => {
    const g = new Group();
    const W = 6, D = 3.4;
    const geo = new PlaneGeometry(W, D, Math.round(200 * SEG), Math.round(100 * SEG));
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const height = (x, z) => {
      let h = 0, f = 0.55, a = 1;
      for (let o = 0; o < 4; o++) { h += (1 - Math.abs(noise(x * f + 3, 0.5, z * f) * 2 - 1)) * a; f *= 2.1; a *= 0.45; }
      const back = 1 - MathUtils.smoothstep(z, -1.6, 1.6); // mountains rise to the back
      const edge = (1 - MathUtils.smoothstep(Math.abs(x), W / 2 - 1, W / 2)) * (1 - MathUtils.smoothstep(Math.abs(z), D / 2 - 0.5, D / 2));
      return (h * 0.45 * (0.25 + back) - 0.15) * edge;
    };
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const mat = new MeshStandardMaterial({ color: 0x0a1510, roughness: 0.85, metalness: 0.1, envMapIntensity: 0.35, transparent: true });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;\nvarying vec2 vXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;\nvXZ = position.xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;\nvarying vec2 vXZ;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= (1.0 - smoothstep(0.55, 1.0, abs(vXZ.x) / ' + (W / 2).toFixed(2) + ')) * (1.0 - smoothstep(0.45, 1.0, abs(vXZ.y) / ' + (D / 2).toFixed(2) + '));')
        .replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          'float hh = vH * 14.0;',
          'float fw = max(fwidth(hh), 1e-3);',
          'float ln = 1.0 - smoothstep(0.0, 1.2, abs(fract(hh) - 0.5) / fw);',
          'float major = 1.0 - smoothstep(0.0, 1.5, abs(fract(hh / 5.0) - 0.5) / max(fw / 5.0, 1e-3));',
          'totalEmissiveRadiance += vec3(0.95, 0.68, 0.28) * (ln * 0.55 + major * 0.9) * smoothstep(-0.2, 0.05, vH);'
        ].join('\n'));
    };
    g.add(mesh(geo, mat));
    // rivers of the valley
    const river = (pts) => {
      const c = new CatmullRomCurve3(pts.map(([x, z]) => new Vector3(x, height(x, z) + 0.03, z)));
      g.add(mesh(new TubeGeometry(c, 120, 0.028, 8), M.emerald));
    };
    river([[-3.3, 0.5], [-2, 0.9], [-0.8, 0.6], [0.4, 1.0], [1.6, 0.7], [3.3, 1.1]]);
    river([[-1.2, -1.6], [-1, -0.6], [-0.8, 0.6]]);
    // the two districts: gold pins with light beams and pulsing rings
    const pulses = [];
    [[-1.5, 0.75], [1.3, 0.85]].forEach(([x, z]) => {
      const y = height(x, z);
      const pin = mesh(new ConeGeometry(0.09, 0.32, 24), M.gold);
      pin.rotation.x = Math.PI; pin.position.set(x, y + 0.42, z);
      const head = mesh(new SphereGeometry(0.1, 24, 16), M.gold); head.position.set(x, y + 0.62, z);
      const gem = mesh(new SphereGeometry(0.05, 16, 10), M.glow); gem.position.set(x, y + 0.62, z + 0.07);
      const beam = mesh(new CylinderGeometry(0.006, 0.006, 1.3, 8, 1, true), M.glow); beam.position.set(x, y + 1.3, z);
      const pulse = mesh(ring(0.3, 0.012, 64), M.glow); pulse.rotation.x = Math.PI / 2; pulse.position.set(x, y + 0.03, z);
      pulses.push(pulse);
      g.add(pin, head, gem, beam, pulse);
    });
    const frame = mesh(new TorusGeometry(1, 0.02, 8, 4), M.gold); // not shown, keeps materials warm
    frame.visible = false; g.add(frame);
    g.rotation.x = 0.8;
    return {
      group: g, update(t) {
        pulses.forEach((p2, i) => { const k = (t * 0.5 + i * 0.5) % 1; p2.scale.setScalar(0.5 + k * 1.6); p2.material = M.glow; p2.visible = k < 0.92; });
        g.rotation.y = Math.sin(t * 0.15) * 0.08;
      }
    };
  };

  builders.dust = () => {
    const g = new Group();
    const items = [];
    for (let i = 0; i < 7; i++) {
      const isRing = i % 3 === 2;
      const m = isRing ? mesh(ring(0.22, 0.018, 64), M.gold) : mesh(puffGeo(detail - 1, 7, i * 2.3), M.cotton);
      if (!isRing) m.scale.setScalar(rr(0.22, 0.36));
      // keep to the margins so the copy stays clear
      const side = i % 2 ? 1 : -1;
      const base = new Vector3(side * rr(3.9, 4.8), (i / 6 - 0.5) * 3.6 + rr(-0.2, 0.2), rr(-0.6, 0.6));
      g.add(m); items.push({ m, base, ph: rnd() * TAU });
    }
    return {
      group: g, update(t) {
        items.forEach(({ m, base, ph }) => {
          m.position.set(base.x * (narrowNow ? 0.7 : 1) + Math.sin(t * 0.3 + ph) * 0.2, base.y + Math.sin(t * 0.5 + ph) * 0.25, base.z);
          m.rotation.set(t * 0.2 + ph, t * 0.3, 0);
        });
      }
    };
  };

  // ---------- build all scenes ----------
  const stage = new Group();
  scene.add(stage);
  const scenes = {};
  Object.keys(builders).forEach((k) => {
    const s = builders[k]();
    s.holder = new Group();
    s.holder.add(s.group);
    s.holder.visible = false;
    stage.add(s.holder);
    scenes[k] = s;
  });
  // a thin gold ring that ripples out when one object gives way to the next
  const wave = mesh(ring(1.6, 0.01, 200), M.wave);
  stage.add(wave);

  // Placement for each keyframe: x = fraction of half-viewport width, y offset,
  // s scale, a canvas strength, spin (idle turntable), tilt; my/ms on phones.
  const PLACE = {
    boll: { x: 0.42, y: 0.02, s: 1.0, a: 1.0, spin: 1, tilt: 0.12, my: 0.4, ms: 0.85 },
    duo: { x: 0.0, y: -0.12, s: 1.0, a: 0.85, spin: 0, tilt: 0.05, ms: 0.8 },
    field: { x: 0.0, y: -0.1, s: 1.0, a: 0.6, spin: 0, tilt: 0.0 },
    'field-side': { x: 0.42, y: 0.08, s: 0.85, a: 1.0, spin: 0, tilt: 0.1, my: -0.3 },
    gin: { x: 0.45, y: -0.08, s: 0.9, a: 1.0, spin: 0.3, tilt: 0.0, my: -0.6, ms: 0.75 },
    spin: { x: 0.45, y: 0.0, s: 0.85, a: 1.0, spin: 0.4, tilt: 0.0, my: -0.5, ms: 0.65 },
    weave: { x: 0.43, y: 0.0, s: 0.95, a: 1.0, spin: 0.2, tilt: 0.0, my: -0.6, ms: 0.75 },
    rings: { x: 0.0, y: 0.22, s: 0.75, a: 1.0, spin: 0, tilt: 0.0, my: 0.3, ms: 0.85 },
    terrain: { x: 0.0, y: -0.3, s: 1.05, a: 1.0, spin: 0, tilt: 0.0, ms: 0.9 },
    dust: { x: 0.0, y: 0.0, s: 1.0, a: 0.9, spin: 0, tilt: 0.0, ms: 0.75 },
    globe: { x: 0.5, y: 0.0, s: 1.0, a: 0.85, spin: 0, tilt: 0.1 },
    'globe-wide': { x: 0.0, y: -0.25, s: 1.25, a: 0.3, spin: 0, tilt: 0.1 }
  };
  Object.values(PLACE).forEach((p) => { if (p.my == null) p.my = p.y; if (p.ms == null) p.ms = 1; });

  // ---------- resize ----------
  let W = 0, H = 0, aspect = 1;
  function resize() {
    W = innerWidth; H = innerHeight; aspect = W / H;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.setSize(W, H, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    needsFrame = true;
  }

  // ---------- scroll keyframes (same anchors as the content) ----------
  let keys = [];
  function measure() {
    const maxScroll = Math.max(1, root.scrollHeight - innerHeight);
    keys = [];
    document.querySelectorAll('[data-shape]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + scrollY;
      let at = el.hasAttribute('data-shape-top') ? top : top + r.height / 2 - innerHeight / 2;
      at = Math.max(0, Math.min(maxScroll, at));
      const shape = el.getAttribute('data-shape');
      if (scenes[shape]) keys.push({ shape, place: PLACE[el.getAttribute('data-place')] ? el.getAttribute('data-place') : shape, at });
    });
    keys.sort((a, b) => a.at - b.at);
    needsFrame = true;
  }
  // each object holds still while its content is read; the swap happens mid-gap
  const hold = (t) => Math.max(0, Math.min(1, (t - 0.18) / 0.64));
  function stateAt(y) {
    if (!keys.length) return { a: 'boll', b: 'boll', pa: 'boll', pb: 'boll', t: 0 };
    if (y <= keys[0].at) return { a: keys[0].shape, b: keys[0].shape, pa: keys[0].place, pb: keys[0].place, t: 0 };
    for (let k = 0; k < keys.length - 1; k++) {
      const A = keys[k], B = keys[k + 1];
      if (y < B.at) {
        const span = B.at - A.at;
        return { a: A.shape, b: B.shape, pa: A.place, pb: B.place, t: hold(span > 1 ? (y - A.at) / span : 1) };
      }
    }
    const L = keys[keys.length - 1];
    return { a: L.shape, b: L.shape, pa: L.place, pb: L.place, t: 0 };
  }

  // ---------- animation ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOutBack = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function mixPlace(pa, pb, t) { const e = smooth(t), o = {}; for (const k in pa) o[k] = lerp(pa[k], pb[k], e); return o; }

  let smoothY = scrollY, mouseX = 0, mouseY = 0, mx = 0, my = 0;
  let angle = 0, spinVel = 0, time = 0, lastNow = performance.now(), intro = reduceMotion ? 1 : 0;
  let needsFrame = true, visible = true, opacity = -1;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    if (!visible) return;
    const moving = Math.abs(scrollY - smoothY) > 0.5 || Math.abs(mouseX - mx) > 0.001 || Math.abs(mouseY - my) > 0.001 || Math.abs(spinVel) > 0.001;
    if (reduceMotion && !moving && !needsFrame) return;

    smoothY = reduceMotion ? scrollY : lerp(smoothY, scrollY, 1 - Math.pow(0.0009, dt));
    mx = lerp(mx, mouseX, 1 - Math.pow(0.02, dt));
    my = lerp(my, mouseY, 1 - Math.pow(0.02, dt));
    if (!reduceMotion) time += dt;

    const st = stateAt(smoothY);
    const t = reduceMotion ? Math.round(st.t) : st.t;
    const pl = mixPlace(PLACE[st.pa], PLACE[st.pb], t);

    // a finger flick spins the object; it eases back to face the viewer
    angle += spinVel * dt + (reduceMotion ? 0 : dt * 0.1 * pl.spin);
    spinVel *= Math.pow(0.15, dt);
    if (pl.spin < 0.5 && Math.abs(spinVel) < 0.3) angle = lerp(angle, Math.round(angle / TAU) * TAU, 1 - Math.pow(0.2, dt));

    // which objects are on stage: the outgoing one shrinks away, the next one blooms in
    const same = st.a === st.b;
    for (const k in scenes) scenes[k].holder.visible = false;
    const A = scenes[st.a], B = scenes[st.b];
    const outK = same ? 1 : 1 - smooth(Math.min(1, t / 0.5));
    const inK = same ? 1 : easeOutBack(Math.max(0, (t - 0.5) / 0.5));
    if (outK > 0.001) { A.holder.visible = true; A.holder.scale.setScalar(outK); A.holder.rotation.y = (1 - outK) * 1.2; A.holder.position.y = -(1 - outK) * 0.4; }
    if (!same && t > 0.5) { B.holder.visible = true; B.holder.scale.setScalar(Math.max(0.001, inK)); B.holder.rotation.y = -(1 - Math.min(1, inK)) * 1.2; B.holder.position.y = (1 - Math.min(1, inK)) * 0.4; }
    if (!reduceMotion) {
      if (A.holder.visible) A.update(time);
      if (B !== A && B.holder.visible) B.update(time);
    }
    const w = same ? 0 : Math.max(0, 1 - Math.abs(t - 0.5) / 0.22);
    wave.visible = w > 0;
    M.wave.opacity = w * 0.8;
    wave.scale.setScalar(0.4 + (t - 0.28) * 2.2);
    wave.rotation.x = 1.2;

    // place the stage in the free side of the layout
    const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * aspect;
    const narrow = aspect < 0.9;
    narrowNow = narrow;
    const fit = Math.min(1, halfW / 2.7);
    let scale = pl.s * (narrow ? Math.max(0.55, fit * 1.1) * pl.ms : Math.min(1.1, 0.75 + aspect * 0.12));
    if (!narrow && Math.abs(pl.x) > 0.1) scale *= 0.92;
    stage.position.set(narrow ? 0 : pl.x * halfW, (narrow ? pl.my : pl.y) * halfH, 0);
    stage.scale.setScalar(scale);
    scenes.globe.orbit.visible = pl.s < 1.15; // the wide contact globe goes without its ring
    const idle = reduceMotion ? 0 : Math.sin(time * 0.3) * 0.06;
    stage.rotation.set(pl.tilt + my * 0.2, angle + mx * 0.45 + idle, 0);

    // on phones the object sits behind body copy: full strength in the hero, softer below
    const heroK = Math.max(0, Math.min(1, 1 - smoothY / H));
    const light = root.getAttribute('data-theme') === 'light';
    renderer.toneMappingExposure = light ? 0.9 : 1.05;
    let op = (0.35 + 0.65 * pl.a) * (narrow ? lerp(0.5, 0.95, heroK) : 1) * intro;
    if (Math.abs(op - opacity) > 0.005) { opacity = op; canvas.style.opacity = op.toFixed(3); }

    renderer.render(scene, camera);
    if (intro < 1) intro = Math.min(1, intro + dt * 0.8);
    needsFrame = false;
  }

  // ---------- events ----------
  addEventListener('resize', () => { resize(); measure(); }, { passive: true });
  addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe(document.body);
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouseX = (e.clientX / innerWidth) * 2 - 1;
    mouseY = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouseX = mouseY = 0; });

  // Touch: dragging sideways turns the object, even while the page scrolls
  let touched = false, lastTX = null;
  addEventListener('touchstart', (e) => {
    lastTX = e.touches[0] ? e.touches[0].clientX : null;
    if (!touched) { touched = true; root.classList.add('fibers-touched'); }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    const tch = e.touches[0];
    if (!tch || lastTX == null) return;
    const dx = tch.clientX - lastTX;
    lastTX = tch.clientX;
    if (!reduceMotion) spinVel = Math.max(-8, Math.min(8, spinVel + dx * 0.04));
  }, { passive: true });
  addEventListener('touchend', () => { lastTX = null; }, { passive: true });

  // Tilting the phone tilts the object (where the browser allows it without a prompt)
  if (isSmall && !reduceMotion && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let base = null;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      if (!base) base = { g: e.gamma, b: e.beta };
      base.b = lerp(base.b, e.beta, 0.01);
      mouseX = Math.max(-1, Math.min(1, (e.gamma - base.g) / 30));
      mouseY = Math.max(-1, Math.min(1, (e.beta - base.b) / 30));
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; lastNow = performance.now(); });
  new MutationObserver(() => { needsFrame = true; }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.classList.remove('has-webgl');
    root.classList.add('no-webgl');
    visible = false;
  });

  // compile every material up front so the first swap doesn't stutter
  for (const k in scenes) scenes[k].holder.visible = true;
  resize();
  renderer.compile(scene, camera);
  for (const k in scenes) scenes[k].holder.visible = false;
  measure();
  requestAnimationFrame(frame);
}
