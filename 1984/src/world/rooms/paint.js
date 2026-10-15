// Canvas-painted textures for the interiors: a stain/dirt decal atlas, fabric
// and paper patterns, printed matter of Oceania, and the painted views seen
// through windows (day and night). Everything is drawn once at setup.
import * as THREE from 'three';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 8;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.mips === false) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}

let seed = 1;
function srand(s) { seed = (s >>> 0) || 1; }
function rnd() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const R = (a, b) => a + (b - a) * rnd();

// 2D value noise for painting (tileable over the period p)
function vnoise(x, y, p = 256) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const h = (i, j) => {
    i = ((i % p) + p) % p; j = ((j % p) + p) % p;
    let n = i * 374761393 + j * 668265263 + 1013904223;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, oct = 4, p = 256) {
  let s = 0, a = 0.5, t = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, y, p); t += a; x *= 2; y *= 2; p *= 2; a *= 0.5; }
  return s / t;
}

// per-pixel grain, optionally only on alpha>0 pixels
function grain(ctx, w, h, amt, mono = true) {
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 255 * amt;
    d[i] += n; d[i + 1] += mono ? n : (rnd() - 0.5) * 255 * amt; d[i + 2] += mono ? n : (rnd() - 0.5) * 255 * amt;
  }
  ctx.putImageData(img, 0, 0);
}

// low-frequency mottling over a whole canvas (tileable)
function mottle(ctx, w, h, scale, amt, color = [0, 0, 0], p = 8) {
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x / w * scale, y / h * scale, 4, scale) - 0.5;
      const k = Math.max(0, n * 2) * amt;
      const i = (y * w + x) * 4;
      d[i] += (color[0] - d[i]) * k; d[i + 1] += (color[1] - d[i + 1]) * k; d[i + 2] += (color[2] - d[i + 2]) * k;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function irregular(ctx, cx, cy, r, wob = 0.25, n = 64, ph = rnd() * 9) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    const k = 1 + wob * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 7 + ph * 1.7) * 0.3 + Math.sin(a * 13 + ph * 2.3) * 0.2);
    const x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function softDot(ctx, x, y, r, rgba0, rgba1 = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba0); g.addColorStop(1, rgba1);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const SANS = '"Oswald","Arial Narrow","Helvetica Neue",Arial,sans-serif';
const SERIF = '"Libre Caslon Text","Times New Roman",Georgia,serif';
const HAND = '"Segoe Print","Bradley Hand","Comic Sans MS",cursive';
const TYPE = '"Courier New",Courier,monospace';

// ---------------------------------------------------------------- decals

// Decal atlas, 4x4 cells. The index names are used by Room.decal().
export const DECALS = {
  water: 0, damp: 1, mould: 2, soot: 3, scuff: 4, grime: 5, crack: 6, flake: 7,
  floordirt: 8, stew: 9, dust: 10, rust: 11, smudge: 12, ghost: 13, nicotine: 14, hole: 15,
};

export function decalAtlas() {
  const S = 512, N = 4;
  const [c, ctx] = cv(S * N, S * N);
  const cell = (i, f) => {
    const x = (i % N) * S, y = Math.floor(i / N) * S;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip(); ctx.translate(x, y);
    srand(100 + i * 31);
    f(ctx);
    ctx.restore();
  };
  // water stain: tide-marked rings from a leak above
  cell(0, (g) => {
    for (let k = 0; k < 7; k++) softDot(g, R(180, 330), R(180, 330), R(80, 170), 'rgba(132,100,58,0.16)');
    for (const [s, a, w] of [[1, 0.55, 5], [0.82, 0.35, 3], [0.6, 0.3, 3], [0.38, 0.22, 2]]) {
      g.save(); g.filter = 'blur(1.5px)';
      irregular(g, 256, 256, 200 * s, 0.22, 90, 2.1 + s);
      g.strokeStyle = `rgba(96,62,28,${a})`; g.lineWidth = w; g.stroke();
      g.restore();
      irregular(g, 256, 256, 200 * s, 0.22, 90, 2.1 + s);
      g.fillStyle = 'rgba(150,118,70,0.06)'; g.fill();
    }
  });
  // rising damp: dark mottled band with a salty whitish tide line
  cell(1, (g) => {
    const gr = g.createLinearGradient(0, 512, 0, 120);
    gr.addColorStop(0, 'rgba(38,40,30,0.55)'); gr.addColorStop(0.7, 'rgba(50,52,40,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 512);
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, 200 + Math.sin(x * 0.02) * 40 + R(-25, 25) + (Math.abs(x - 256) / 256) ** 2 * 160);
    g.lineTo(512, 512); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(210,205,185,0.35)'; g.lineWidth = 6; g.filter = 'blur(3px)';
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) { const y = 200 + Math.sin(x * 0.02) * 40 + (Math.abs(x - 256) / 256) ** 2 * 160; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke(); g.filter = 'none';
    for (let i = 0; i < 500; i++) { const x = R(0, 512), y = R(260, 512); softDot(g, x, y, R(2, 7), `rgba(20,24,16,${R(0.2, 0.5)})`); }
    g.globalCompositeOperation = 'destination-in';
    const fx = g.createLinearGradient(0, 0, 512, 0);
    fx.addColorStop(0, 'rgba(0,0,0,0)'); fx.addColorStop(0.15, '#000'); fx.addColorStop(0.85, '#000'); fx.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fx; g.fillRect(0, 0, 512, 512);
  });
  // black mould spreading from a corner (top-left of the cell)
  cell(2, (g) => {
    for (let i = 0; i < 2600; i++) {
      const r = Math.pow(rnd(), 1.8) * 480, a = rnd() * Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      softDot(g, x, y, R(1.5, 6) * (1 - r / 560), `rgba(16,18,12,${R(0.25, 0.7) * (1 - r / 520)})`);
    }
    softDot(g, 0, 0, 300, 'rgba(30,32,24,0.45)');
  });
  // soot plume rising from the bottom centre
  cell(3, (g) => {
    for (let i = 0; i < 60; i++) {
      const t = rnd(); const y = 512 - t * 470;
      softDot(g, 256 + R(-30, 30) * (1 + t * 3), y, 30 + t * 120, `rgba(14,12,10,${0.14 * (1 - t * 0.8)})`);
    }
  });
  // scuff marks low on a wall
  cell(4, (g) => {
    for (let i = 0; i < 70; i++) {
      const y = R(300, 500), x = R(20, 460), l = R(15, 90);
      g.strokeStyle = `rgba(20,18,16,${R(0.1, 0.45)})`; g.lineWidth = R(1, 4);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + R(-6, 6), x + l, y + R(-8, 8)); g.stroke();
    }
    for (let i = 0; i < 20; i++) softDot(g, R(30, 480), R(330, 500), R(20, 50), 'rgba(40,34,28,0.12)');
  });
  // greasy band where shoulders and hands rub along a wall
  cell(5, (g) => {
    for (let i = 0; i < 140; i++) softDot(g, R(-20, 532), 256 + R(-80, 80), R(25, 70), `rgba(52,44,34,${R(0.04, 0.12)})`);
    for (let i = 0; i < 40; i++) softDot(g, R(0, 512), 256 + R(-40, 40), R(8, 22), `rgba(30,26,20,${R(0.08, 0.2)})`);
  });
  // a branching plaster crack
  cell(6, (g) => {
    const walk = (x, y, a, len, w) => {
      g.lineWidth = w; g.strokeStyle = 'rgba(18,15,12,0.75)';
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < len; i++) {
        a += R(-0.5, 0.5); x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y);
        if (rnd() < 0.04 && w > 0.8) walk(x, y, a + R(-1, 1), len * 0.4, w * 0.6);
      }
      g.stroke();
    };
    walk(40, 60, 0.9, 70, 2.6);
    g.globalCompositeOperation = 'destination-over';
    walk(41, 61, 0.9, 70, 6); // soft shadow under the crack
  });
  // flaked plaster: a patch of exposed pinkish render with a broken edge
  cell(7, (g) => {
    irregular(g, 256, 256, 170, 0.35, 80, 1.3);
    g.fillStyle = 'rgba(176,150,122,0.95)'; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 300; i++) softDot(g, R(80, 430), R(80, 430), R(4, 18), `rgba(120,96,74,${R(0.1, 0.4)})`);
    g.restore();
    irregular(g, 256, 256, 170, 0.35, 80, 1.3);
    g.strokeStyle = 'rgba(40,30,24,0.6)'; g.lineWidth = 4; g.stroke();
    irregular(g, 252, 262, 178, 0.35, 80, 1.3);
    g.strokeStyle = 'rgba(230,224,206,0.4)'; g.lineWidth = 3; g.stroke();
  });
  // floor dirt and wear
  cell(8, (g) => {
    for (let i = 0; i < 90; i++) softDot(g, R(60, 452), R(60, 452), R(30, 110), `rgba(44,38,30,${R(0.04, 0.1)})`);
    for (let i = 0; i < 900; i++) softDot(g, R(40, 472), R(40, 472), R(1, 3), `rgba(30,26,20,${R(0.1, 0.4)})`);
  });
  // a pool of spilt stew
  cell(9, (g) => {
    irregular(g, 256, 256, 150, 0.4, 70, 0.4);
    g.fillStyle = 'rgba(150,112,96,0.92)'; g.fill();
    for (let i = 0; i < 20; i++) { irregular(g, 256 + R(-90, 90), 256 + R(-90, 90), R(8, 26), 0.3, 20); g.fillStyle = `rgba(${R(160, 190) | 0},${R(120, 140) | 0},${R(100, 120) | 0},0.9)`; g.fill(); }
    irregular(g, 330, 330, 40, 0.5, 30, 3); g.fillStyle = 'rgba(150,112,96,0.85)'; g.fill();
  });
  // dust on a flat surface
  cell(10, (g) => {
    const img = g.getImageData(0, 0, 512, 512); const d = img.data;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const e = Math.min(x, y, 511 - x, 511 - y) / 60;
      const n = fbm(x / 64, y / 64, 4, 8);
      const a = Math.min(1, e) * (0.35 + n * 0.45) + (rnd() < 0.02 ? 0.3 : 0);
      const i = (y * 512 + x) * 4;
      d[i] = 168; d[i + 1] = 160; d[i + 2] = 146; d[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  });
  // rust streaks running down from a pipe or bracket
  cell(11, (g) => {
    for (let i = 0; i < 18; i++) {
      const x = 256 + R(-60, 60), l = R(120, 460);
      const gr = g.createLinearGradient(0, 20, 0, 20 + l);
      gr.addColorStop(0, `rgba(120,58,24,${R(0.35, 0.6)})`); gr.addColorStop(1, 'rgba(110,60,30,0)');
      g.fillStyle = gr; g.fillRect(x, 20, R(3, 12), l);
    }
  });
  // greasy hand smudges (around switches and door edges)
  cell(12, (g) => {
    for (let i = 0; i < 26; i++) {
      const x = 256 + R(-140, 140), y = 256 + R(-160, 160);
      g.save(); g.translate(x, y); g.rotate(R(-0.6, 0.6)); g.scale(1, R(1.2, 1.7));
      softDot(g, 0, 0, R(14, 30), `rgba(40,32,24,${R(0.12, 0.3)})`);
      g.restore();
    }
  });
  // the ghost of a picture taken down: a cleaner rectangle with a dusty edge
  cell(13, (g) => {
    g.fillStyle = 'rgba(255,250,232,0.16)'; g.fillRect(96, 64, 320, 384);
    g.strokeStyle = 'rgba(40,32,22,0.25)'; g.lineWidth = 10; g.filter = 'blur(6px)'; g.strokeRect(96, 64, 320, 384); g.filter = 'none';
    g.strokeStyle = 'rgba(30,24,18,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(256, 20); g.lineTo(150, 64); g.moveTo(256, 20); g.lineTo(362, 64); g.stroke();
  });
  // tobacco and lamp-smoke stain on a ceiling
  cell(14, (g) => {
    for (let i = 0; i < 50; i++) softDot(g, 256 + R(-120, 120), 256 + R(-120, 120), R(60, 160), `rgba(120,92,40,${R(0.03, 0.08)})`);
  });
  // mouse hole in the skirting (bottom centre)
  cell(15, (g) => {
    g.fillStyle = 'rgba(6,5,4,0.96)';
    g.beginPath(); g.moveTo(186, 512); g.lineTo(190, 440); g.quadraticCurveTo(256, 330, 322, 440); g.lineTo(326, 512); g.closePath(); g.fill();
    g.filter = 'blur(10px)'; g.fillStyle = 'rgba(20,16,12,0.6)';
    g.beginPath(); g.ellipse(256, 470, 110, 90, 0, 0, Math.PI * 2); g.fill(); g.filter = 'none';
  });
  return toTex(c, { aniso: 4 });
}

// Soft round shadow for contact AO under furniture.
export function blob() {
  const [c, ctx] = cv(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return toTex(c, { srgb: false });
}

// Gradient across u for the corner occlusion strips (dark at u=0).
export function ramp() {
  const [c, ctx] = cv(128, 4);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.25, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 4);
  const t = toTex(c, { srgb: false, mips: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------- patterns

export function ragRug(sd = 1, palette) {
  srand(400 + sd);
  const [c, ctx] = cv(512, 512);
  const pal = palette || ['#5a4a3c', '#6a5a48', '#4a3c34', '#7a6450', '#3e3a36', '#6e4a3a', '#58584c', '#80705a'];
  ctx.fillStyle = '#4a4038'; ctx.fillRect(0, 0, 512, 512);
  // hooked rag strips in rows, a border of darker rags
  for (let y = 0; y < 512; y += 6) {
    for (let x = 0; x < 512; x += R(6, 14)) {
      const edge = Math.min(x, y, 512 - x, 512 - y) < 46;
      const band = Math.floor(Math.min(x, y, 512 - x, 512 - y) / 46);
      ctx.fillStyle = edge ? pal[(band + 2) % pal.length] : pal[Math.floor(rnd() * pal.length)];
      ctx.globalAlpha = R(0.6, 1);
      ctx.beginPath(); ctx.ellipse(x, y + 3, R(4, 8), R(2.5, 3.5), R(-0.3, 0.3), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // trodden centre
  softDot(ctx, 256, 256, 300, 'rgba(60,50,40,0.35)');
  grain(ctx, 512, 512, 0.08);
  return toTex(c);
}

export function runner() {
  srand(410);
  const [c, ctx] = cv(256, 1024);
  ctx.fillStyle = '#5a2a22'; ctx.fillRect(0, 0, 256, 1024);
  ctx.fillStyle = '#3a1c18'; ctx.fillRect(0, 0, 256, 1024);
  ctx.fillStyle = '#6a3226'; ctx.fillRect(18, 0, 220, 1024);
  ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 4; ctx.strokeRect(30, -10, 196, 1044);
  for (let y = 40; y < 1024; y += 120) {
    ctx.fillStyle = '#8a5a3a';
    ctx.beginPath(); ctx.moveTo(128, y); ctx.lineTo(178, y + 50); ctx.lineTo(128, y + 100); ctx.lineTo(78, y + 50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2420'; ctx.beginPath(); ctx.arc(128, y + 50, 16, 0, Math.PI * 2); ctx.fill();
  }
  // worn to the weft down the middle
  for (let i = 0; i < 40; i++) softDot(ctx, 128 + R(-40, 40), R(0, 1024), R(40, 90), 'rgba(120,100,80,0.18)');
  grain(ctx, 256, 1024, 0.1);
  return toTex(c, { repeat: true });
}

export function damask() {
  srand(420);
  const [c, ctx] = cv(512, 512);
  ctx.fillStyle = '#18233a'; ctx.fillRect(0, 0, 512, 512);
  const motif = (cx, cy, s) => {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.scale(sx, 1);
      ctx.beginPath();
      ctx.moveTo(0, -110); ctx.bezierCurveTo(40, -90, 60, -40, 30, -10); ctx.bezierCurveTo(70, -20, 90, 20, 50, 40);
      ctx.bezierCurveTo(80, 60, 50, 100, 0, 120); ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.arc(52, -50, 12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  ctx.fillStyle = '#22304c';
  for (const [x, y] of [[128, 128], [384, 384], [384, -128], [-128, 384], [384, 128 + 512 - 512], [128, 640]]) motif(x, y, 0.95);
  motif(384, 128 - 256 + 256, 0.6);
  ctx.fillStyle = '#1c2840';
  for (let x = 0; x < 512; x += 64) ctx.fillRect(x, 0, 2, 512);
  grain(ctx, 512, 512, 0.04);
  return toTex(c, { repeat: true });
}

export function creamPaper() {
  srand(430);
  const [c, ctx] = cv(256, 256);
  ctx.fillStyle = '#ddd2b6'; ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) { ctx.fillStyle = 'rgba(160,140,100,0.08)'; ctx.fillRect(x, 0, 6, 256); }
  grain(ctx, 256, 256, 0.04);
  return toTex(c, { repeat: true });
}

export function floral() {
  srand(440);
  const [c, ctx] = cv(512, 512);
  ctx.fillStyle = '#b8a47e'; ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { ctx.fillStyle = 'rgba(140,110,70,0.25)'; ctx.fillRect(x + 28, 0, 8, 512); }
  const sprig = (x, y, s) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(R(-0.3, 0.3));
    ctx.strokeStyle = '#6a6a40'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(-6, 0, 2, -24); ctx.stroke();
    ctx.fillStyle = '#727040';
    for (const [lx, ly, a] of [[-10, 8, -0.8], [10, -4, 0.7], [-8, -14, -0.5]]) { ctx.beginPath(); ctx.ellipse(lx, ly, 9, 4, a, 0, Math.PI * 2); ctx.fill(); }
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#9a5a4c' : '#a8665a'; ctx.beginPath(); ctx.arc(2 + Math.cos(k) * 6, -28 + Math.sin(k) * 6, 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#7a3e36'; ctx.beginPath(); ctx.arc(2, -28, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) sprig(col * 128 + 64 + (row % 2) * 64, row * 128 + 64, 1.1);
  // yellowed, faded, sun-bleached unevenly
  mottle(ctx, 512, 512, 3, 0.25, [150, 120, 70]);
  grain(ctx, 512, 512, 0.05);
  return toTex(c, { repeat: true });
}

export function lino() {
  srand(450);
  const [c, ctx] = cv(512, 512);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    ctx.fillStyle = (i + j) % 2 ? '#4a3026' : '#6a5440';
    ctx.fillRect(i * 256, j * 256, 256, 256);
  }
  // marbling
  for (let k = 0; k < 400; k++) {
    ctx.strokeStyle = `rgba(${R(20, 120) | 0},${R(20, 90) | 0},${R(10, 60) | 0},0.12)`; ctx.lineWidth = R(1, 4);
    ctx.beginPath(); const x = R(0, 512), y = R(0, 512); ctx.moveTo(x, y); ctx.bezierCurveTo(x + R(-40, 40), y + R(-40, 40), x + R(-60, 60), y + R(-60, 60), x + R(-80, 80), y + R(-80, 80)); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,14,10,0.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256); ctx.strokeRect(256, 256, 256, 256); ctx.strokeRect(256, 0, 256, 256); ctx.strokeRect(0, 256, 256, 256);
  mottle(ctx, 512, 512, 4, 0.3, [110, 96, 80]);
  grain(ctx, 512, 512, 0.06);
  return toTex(c, { repeat: true });
}

export function quarry() {
  srand(455);
  const [c, ctx] = cv(512, 512);
  ctx.fillStyle = '#2a1a14'; ctx.fillRect(0, 0, 512, 512);
  const n = 4, s = 512 / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = R(0.8, 1.15);
    ctx.fillStyle = `rgb(${110 * v | 0},${52 * v | 0},${38 * v | 0})`;
    ctx.fillRect(i * s + 4, j * s + 4, s - 8, s - 8);
  }
  mottle(ctx, 512, 512, 4, 0.35, [70, 60, 52]);
  grain(ctx, 512, 512, 0.07);
  return toTex(c, { repeat: true });
}

export function dartboard() {
  const [c, ctx] = cv(512, 512);
  ctx.fillStyle = '#141210'; ctx.beginPath(); ctx.arc(256, 256, 250, 0, Math.PI * 2); ctx.fill();
  const rings = [[200, 186], [126, 112]];
  for (let k = 0; k < 20; k++) {
    const a0 = (k - 0.5) / 20 * Math.PI * 2 - Math.PI / 2, a1 = (k + 0.5) / 20 * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = k % 2 ? '#d8cca8' : '#1a1814';
    ctx.beginPath(); ctx.moveTo(256, 256); ctx.arc(256, 256, 200, a0, a1); ctx.closePath(); ctx.fill();
    for (const [r0, r1] of rings) {
      ctx.fillStyle = k % 2 ? '#5a2a1e' : '#2a4a32';
      ctx.beginPath(); ctx.arc(256, 256, r0, a0, a1); ctx.arc(256, 256, r1, a1, a0, true); ctx.closePath(); ctx.fill();
    }
  }
  ctx.fillStyle = '#2a4a32'; ctx.beginPath(); ctx.arc(256, 256, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a2a1e'; ctx.beginPath(); ctx.arc(256, 256, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8bca0'; ctx.font = `bold 26px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  nums.forEach((n, k) => { const a = k / 20 * Math.PI * 2 - Math.PI / 2; ctx.fillText(String(n), 256 + Math.cos(a) * 226, 256 + Math.sin(a) * 226); });
  srand(460);
  for (let i = 0; i < 300; i++) softDot(ctx, 256 + R(-200, 200), 256 + R(-200, 200), R(1, 3), 'rgba(0,0,0,0.5)');
  grain(ctx, 512, 512, 0.08);
  return toTex(c);
}

export function clockFace(hours = 12) {
  const [c, ctx] = cv(256, 256);
  ctx.fillStyle = '#e4dcc4'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a241c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#1e1a14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${hours === 12 ? 'italic ' : ''}${hours === 12 ? 24 : 15}px ${SERIF}`;
  for (let h = 1; h <= hours; h++) {
    const a = h / hours * Math.PI * 2 - Math.PI / 2;
    const r = hours === 12 ? 94 : 100;
    const label = hours === 12 ? ['I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][h - 1] : String(h);
    ctx.fillText(label, 128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    ctx.fillRect(128 + Math.cos(a) * 112 - 1.5, 128 + Math.sin(a) * 112 - 1.5, 3, 3);
  }
  srand(470); softDot(ctx, 90, 170, 60, 'rgba(120,96,50,0.18)');
  grain(ctx, 256, 256, 0.05);
  return toTex(c);
}

// Printed and handwritten paper: notices, labels, signs. English, since
// they belong to Oceania.
export function notice(lines, o = {}) {
  srand(500 + lines.join('').length * 7);
  const w = o.w || 512, h = o.h || 360;
  const [c, ctx] = cv(w, h);
  ctx.fillStyle = o.bg || '#d8cfb4'; ctx.fillRect(0, 0, w, h);
  if (o.rule) { ctx.fillStyle = o.rule; ctx.fillRect(0, 0, w, h * 0.08); ctx.fillRect(0, h * 0.92, w, h * 0.08); }
  ctx.fillStyle = o.fg || '#1c1a16'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const font = o.hand ? HAND : o.type ? TYPE : SANS;
  const n = lines.length;
  lines.forEach((t, i) => {
    let size = (o.size || 60) * (i === 0 && o.big ? 1.4 : 1);
    ctx.font = `${o.hand ? '' : 'bold '}${size}px ${font}`;
    while (ctx.measureText(t).width > w * 0.88 && size > 10) { size -= 2; ctx.font = `${o.hand ? '' : 'bold '}${size}px ${font}`; }
    ctx.save(); ctx.translate(w / 2, h * (0.5 + (i - (n - 1) / 2) * (o.lh || 0.2))); if (o.hand) ctx.rotate(R(-0.04, 0.04));
    ctx.fillText(t, 0, 0); ctx.restore();
  });
  for (let i = 0; i < 6; i++) softDot(ctx, R(0, w), R(0, h), R(20, 80), 'rgba(110,86,50,0.12)');
  grain(ctx, w, h, 0.09);
  if (o.torn) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(w, h); ctx.lineTo(w * 0.8, h); ctx.lineTo(w * 0.86, h * 0.9); ctx.lineTo(w * 0.83, h * 0.82); ctx.lineTo(w, h * 0.7); ctx.fill();
  }
  return toTex(c);
}

export function banner(title, sub, o = {}) {
  srand(520 + title.length);
  const [c, ctx] = cv(256, 512);
  ctx.fillStyle = o.bg || '#7a1610'; ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#e4d8b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.beginPath(); ctx.arc(128, 170, 70, 0, Math.PI * 2); ctx.lineWidth = 10; ctx.strokeStyle = '#e4d8b8'; ctx.stroke();
  ctx.font = `bold 60px ${SANS}`; ctx.fillText(o.emblem || 'IS', 128, 172);
  let size = 52; ctx.font = `bold ${size}px ${SANS}`;
  while (ctx.measureText(title).width > 230) { size -= 2; ctx.font = `bold ${size}px ${SANS}`; }
  ctx.fillText(title, 128, 320);
  ctx.font = `bold 26px ${SANS}`; ctx.fillText(sub, 128, 380);
  for (let x = 0; x < 256; x += 32) { ctx.fillStyle = '#e4d8b8'; ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x + 16, 470); ctx.lineTo(x + 32, 512); ctx.fill(); }
  mottle(ctx, 256, 512, 3, 0.3, [40, 10, 8]);
  grain(ctx, 256, 512, 0.08);
  return toTex(c);
}

export function newspaper() {
  srand(540);
  const [c, ctx] = cv(512, 680);
  ctx.fillStyle = '#d4ccb4'; ctx.fillRect(0, 0, 512, 680);
  ctx.fillStyle = '#1a1814'; ctx.textAlign = 'center';
  ctx.font = `bold 56px ${SERIF}`; ctx.fillText('The Times', 256, 62);
  ctx.fillRect(20, 76, 472, 3); ctx.fillRect(20, 84, 472, 1);
  ctx.font = `bold 26px ${SANS}`; ctx.fillText('VICTORY IN AFRICA', 256, 120);
  ctx.textAlign = 'left';
  for (let col = 0; col < 3; col++) {
    for (let y = 150; y < 660; y += 11) {
      if (rnd() < 0.06) { y += 14; continue; }
      ctx.fillStyle = 'rgba(30,28,24,0.55)';
      ctx.fillRect(24 + col * 160, y, R(110, 148), 4);
    }
  }
  // the chess problem box
  ctx.strokeStyle = '#1a1814'; ctx.lineWidth = 2; ctx.strokeRect(350, 480, 130, 130);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if ((i + j) % 2) { ctx.fillStyle = '#4a463e'; ctx.fillRect(352 + i * 15.75, 482 + j * 15.75, 15.75, 15.75); }
  grain(ctx, 512, 680, 0.08);
  return toTex(c);
}

export function label(text, sub, o = {}) {
  const [c, ctx] = cv(256, 128);
  ctx.fillStyle = o.bg || '#e6e2d6'; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = o.fg || '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 40px ${SANS}`; ctx.fillText(text, 128, sub ? 50 : 64);
  if (sub) { ctx.font = `20px ${SANS}`; ctx.fillText(sub, 128, 92); }
  srand(560); grain(ctx, 256, 128, 0.08);
  return toTex(c);
}

export function exerciseBook(sd = 0) {
  srand(570 + sd);
  const [c, ctx] = cv(128, 160);
  ctx.fillStyle = ['#6a7a8a', '#8a7a5a', '#7a5a5a'][sd % 3]; ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = '#e8e0cc'; ctx.fillRect(20, 30, 88, 40);
  ctx.fillStyle = '#222'; ctx.font = `bold 11px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('SPIES', 64, 44); ctx.fillText('EXERCISE BOOK', 64, 60);
  grain(ctx, 128, 160, 0.12);
  return toTex(c);
}

// Glass: alpha carries grime; colour is a dull brownish grey.
export function dirtyGlass(heavy = 0) {
  srand(600 + heavy * 10);
  const [c, ctx] = cv(256, 256);
  const img = ctx.createImageData(256, 256); const d = img.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const e = Math.min(x, 255 - x, y, 255 - y) / 255;
    const n = fbm(x / 40, y / 40, 4, 8);
    const streak = fbm(x / 6, y / 90, 2, 64) * 0.4;
    let a = 0.04 + (1 - Math.min(1, e * 6)) * 0.35 + Math.max(0, n - 0.45) * 0.5 + streak * 0.15 + (y / 255) * 0.08;
    a = heavy ? 0.42 + n * 0.4 + (1 - Math.min(1, e * 4)) * 0.2 - (Math.abs(Math.sin(x * 0.05 + y * 0.02)) < 0.06 ? 0.25 : 0) : a;
    const i = (y * 256 + x) * 4;
    d[i] = 150; d[i + 1] = 146; d[i + 2] = 134; d[i + 3] = Math.max(0, Math.min(1, a)) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c);
}

export function puff() {
  srand(620);
  const [c, ctx] = cv(128, 128);
  for (let i = 0; i < 26; i++) softDot(ctx, 64 + R(-22, 22), 64 + R(-22, 22), R(18, 40), 'rgba(255,255,255,0.13)');
  return toTex(c, { srgb: false });
}

// ---------------------------------------------------------------- views

// Painted views through windows. The plane is 30 m x 20 m; `horizon` is the
// fraction of height (from the bottom) where the viewer's eye level falls.
const VW = 1024, VH = 640;

function sky(ctx, night, hy, warm = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  if (night) { g.addColorStop(0, '#04060b'); g.addColorStop(0.7, '#0c111b'); g.addColorStop(1, '#1d2230'); }
  else {
    g.addColorStop(0, warm ? '#8ea3b8' : '#8fa6ba');
    g.addColorStop(0.6, warm ? '#c8c6bc' : '#bcc6cc');
    g.addColorStop(1, warm ? '#e8d6b8' : '#dfe2de');
  }
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, hy + 2);
  if (!night) {
    // thin cloud bands
    for (let i = 0; i < 40; i++) {
      const y = R(10, hy * 0.75);
      ctx.save(); ctx.translate(R(0, VW), y); ctx.scale(R(4, 9), 1);
      softDot(ctx, 0, 0, R(14, 30), 'rgba(250,250,246,0.14)');
      ctx.restore();
    }
  }
}

// haze toward the horizon: mixes a layer drawn at distance `dist` (0..1)
function hazeColor(night, base, dist, warm = 0) {
  const h = night ? [24, 28, 38] : warm ? [214, 204, 186] : [206, 210, 208];
  const k = Math.min(1, dist);
  return `rgb(${base[0] + (h[0] - base[0]) * k | 0},${base[1] + (h[1] - base[1]) * k | 0},${base[2] + (h[2] - base[2]) * k | 0})`;
}

function litWindow(ctx, x, y, w, h, night, p) {
  if (night) {
    if (rnd() < p) { ctx.fillStyle = `rgba(${R(200, 255) | 0},${R(150, 190) | 0},${R(70, 110) | 0},${R(0.5, 0.95)})`; ctx.fillRect(x, y, w, h); }
    else { ctx.fillStyle = 'rgba(2,3,5,0.8)'; ctx.fillRect(x, y, w, h); }
  } else {
    ctx.fillStyle = rnd() < 0.15 ? 'rgba(150,140,120,0.9)' : `rgba(${R(30, 60) | 0},${R(36, 64) | 0},${R(44, 70) | 0},0.92)`;
    ctx.fillRect(x, y, w, h);
  }
}

// a row of buildings: roofs with chimneys, facades with window grids
function roofline(ctx, o) {
  const { night, y0, hMin, hMax, wMin, wMax, dist, chim = 0.5, base = [70, 66, 60], win = true, warm = 0, pitch = 0.4 } = o;
  let x = -20;
  while (x < VW + 20) {
    const w = R(wMin, wMax), h = R(hMin, hMax);
    const top = y0 - h;
    const col = hazeColor(night, night ? [6, 7, 10] : base.map((v) => v * R(0.85, 1.15)), dist, warm);
    ctx.fillStyle = col;
    ctx.fillRect(x, top, w + 1, VH - top);
    // pitched roof
    if (rnd() < pitch) {
      ctx.beginPath(); ctx.moveTo(x - 2, top); ctx.lineTo(x + w * 0.5, top - h * R(0.12, 0.25)); ctx.lineTo(x + w + 2, top); ctx.fill();
    }
    // chimney stacks with pots
    if (rnd() < chim) {
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const cx = x + R(0.1, 0.8) * w, cw = R(6, 14) * (1.2 - dist), ch = R(10, 26) * (1.2 - dist);
        ctx.fillRect(cx, top - ch, cw, ch + 2);
        for (let p = 0; p < 3; p++) ctx.fillRect(cx + p * cw / 3 + 1, top - ch - 4 * (1.2 - dist), cw / 4, 5 * (1.2 - dist));
      }
    }
    if (win && h > 12) {
      const ww = Math.max(2, (wMax / 12) * (1.1 - dist)), wh = ww * 1.5;
      for (let wy = top + wh; wy < Math.min(VH, y0 + 200) - wh; wy += wh * 2.1) {
        for (let wx = x + ww; wx < x + w - ww; wx += ww * 2.4) litWindow(ctx, wx, wy, ww, wh, night, 0.12);
      }
    }
    x += w + R(0, 6);
  }
}

function pyramid(ctx, cx, base, w, h, night, dist) {
  const tiers = 6;
  for (let t = 0; t < tiers; t++) {
    const k0 = t / tiers, k1 = (t + 1) / tiers;
    const w0 = w * (1 - k0 * 0.86), w1 = w * (1 - k1 * 0.86);
    const y0 = base - h * k0, y1 = base - h * k1;
    const lit = night ? [40, 44, 52] : [236, 236, 230];
    const shade = night ? [22, 24, 30] : [196, 198, 196];
    ctx.fillStyle = hazeColor(night, lit, dist);
    ctx.beginPath(); ctx.moveTo(cx - w0 / 2, y0); ctx.lineTo(cx - w1 / 2, y1); ctx.lineTo(cx + w1 * 0.1, y1); ctx.lineTo(cx + w0 * 0.1, y0); ctx.fill();
    ctx.fillStyle = hazeColor(night, shade, dist);
    ctx.beginPath(); ctx.moveTo(cx + w0 * 0.1, y0); ctx.lineTo(cx + w1 * 0.1, y1); ctx.lineTo(cx + w1 / 2, y1); ctx.lineTo(cx + w0 / 2, y0); ctx.fill();
    // terrace ledge line and window bands
    ctx.fillStyle = hazeColor(night, night ? [10, 10, 14] : [150, 150, 150], dist);
    ctx.fillRect(cx - w1 / 2, y1, w1, 1.5);
    if (night) for (let i = 0; i < w0 / 7; i++) if (rnd() < 0.3) { ctx.fillStyle = 'rgba(200,190,160,0.5)'; ctx.fillRect(cx - w0 / 2 + i * 7 + 2, y0 - (y0 - y1) * 0.5, 2, 2); }
  }
}

function searchlights(ctx, hy) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = R(0, VW), a = R(-0.5, 0.5);
    const g = ctx.createLinearGradient(x, hy, x + Math.sin(a) * 500, hy - 500);
    g.addColorStop(0, 'rgba(120,140,160,0.14)'); g.addColorStop(1, 'rgba(120,140,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 3, hy); ctx.lineTo(x + Math.sin(a) * 600 - 40, hy - 600); ctx.lineTo(x + Math.sin(a) * 600 + 40, hy - 600); ctx.lineTo(x + 3, hy); ctx.fill();
  }
  ctx.restore();
}

function facade(ctx, x, top, w, bottom, night, o = {}) {
  const base = o.base || [92, 90, 84];
  ctx.fillStyle = hazeColor(night, night ? [10, 11, 14] : base, o.dist || 0.05);
  ctx.fillRect(x, top, w, bottom - top);
  const ww = o.ww || 26, wh = o.wh || 40, gx = o.gx || 54, gy = o.gy || 74;
  for (let y = top + 24; y < bottom - wh; y += gy) {
    for (let wx = x + 18; wx < x + w - ww; wx += gx) {
      litWindow(ctx, wx, y, ww, wh, night, o.lit ?? 0.15);
      if (!night) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wx, y + wh, ww, 3); }
    }
  }
  // soot streaks
  if (!night) for (let i = 0; i < 30; i++) {
    const sx = x + R(0, w); const g = ctx.createLinearGradient(0, top, 0, top + R(60, 200));
    g.addColorStop(0, 'rgba(30,28,24,0.25)'); g.addColorStop(1, 'rgba(30,28,24,0)');
    ctx.fillStyle = g; ctx.fillRect(sx, top, R(4, 18), 200);
  }
}

function poster(ctx, art, x, y, w, night) {
  if (night || !art) return;
  ctx.save();
  ctx.fillStyle = '#c8bc9c'; ctx.fillRect(x, y, w, w * 1.4);
  ctx.beginPath(); ctx.rect(x + w * 0.04, y + w * 0.04, w * 0.92, w * 1.08); ctx.clip();
  ctx.fillStyle = '#242a2c'; ctx.fillRect(x, y, w, w * 1.2);
  art.drawBB(ctx, x + w / 2, y + w * 0.58, w * 0.34);
  ctx.restore();
  ctx.fillStyle = '#7a1a12'; ctx.fillRect(x + w * 0.04, y + w * 1.14, w * 0.92, w * 0.22);
  ctx.fillStyle = '#e6dcc0'; ctx.font = `bold ${w * 0.1 | 0}px ${SANS}`; ctx.textAlign = 'center';
  ctx.fillText('BIG BROTHER', x + w / 2, y + w * 1.24); ctx.font = `bold ${w * 0.07 | 0}px ${SANS}`;
  ctx.fillText('IS WATCHING YOU', x + w / 2, y + w * 1.32);
}

const VIEWS = {
  // Winston's window, seventh floor, looking east over the avenue
  city(ctx, night, art, hy) {
    sky(ctx, night, hy);
    if (night) searchlights(ctx, hy);
    pyramid(ctx, 190, hy + 6, 300, 170, night, 0.45);
    roofline(ctx, { night, y0: hy + 20, hMin: 6, hMax: 26, wMin: 20, wMax: 50, dist: 0.6, chim: 0.7 });
    roofline(ctx, { night, y0: hy + 60, hMin: 10, hMax: 50, wMin: 40, wMax: 90, dist: 0.35, chim: 0.6, base: [74, 64, 56] });
    roofline(ctx, { night, y0: hy + 130, hMin: 20, hMax: 70, wMin: 60, wMax: 130, dist: 0.18, chim: 0.5, base: [66, 58, 52] });
    // the house-front immediately opposite, with its poster
    facade(ctx, 520, hy - 70, 520, VH, night, { base: [104, 100, 92], ww: 30, wh: 46, gx: 66, gy: 86 });
    poster(ctx, art, 700, hy - 40, 130, night);
  },
  // Victory Avenue seen through the glass doors at street level
  street(ctx, night, art, hy) {
    sky(ctx, night, hy);
    facade(ctx, -10, hy - 330, 640, hy + 40, night, { base: [118, 116, 110], ww: 22, wh: 34, gx: 46, gy: 64, dist: 0.12 });
    facade(ctx, 640, hy - 250, 400, hy + 40, night, { base: [96, 94, 90], ww: 22, wh: 34, gx: 46, gy: 64, dist: 0.15 });
    poster(ctx, art, 420, hy - 200, 110, night);
    // pavement opposite, the road, our pavement
    ctx.fillStyle = night ? '#07080a' : '#5c5a56'; ctx.fillRect(0, hy + 40, VW, 30);
    ctx.fillStyle = night ? '#050607' : '#3c3c3c'; ctx.fillRect(0, hy + 70, VW, VH);
    ctx.fillStyle = night ? '#08090a' : '#6a6864'; ctx.fillRect(0, hy + 230, VW, VH);
    if (night) { softDot(ctx, 300, hy - 30, 120, 'rgba(255,190,110,0.25)'); softDot(ctx, 300, hy + 100, 200, 'rgba(255,190,110,0.12)'); }
    // a lamp post
    ctx.fillStyle = night ? '#030304' : '#1c1c1c'; ctx.fillRect(296, hy - 60, 6, 130); ctx.fillRect(282, hy - 66, 34, 8);
  },
  // a narrow cobbled prole street, terrace opposite
  prole(ctx, night, art, hy) {
    sky(ctx, night, hy, 0);
    roofline(ctx, { night, y0: hy - 40, hMin: 10, hMax: 40, wMin: 40, wMax: 80, dist: 0.45, chim: 0.9, base: [70, 56, 48] });
    // terrace opposite: sooty brick, cardboard in windows
    ctx.fillStyle = hazeColor(night, night ? [8, 7, 7] : [84, 56, 44], 0.05); ctx.fillRect(0, hy - 260, VW, 360);
    for (let x = 20; x < VW; x += 180) {
      for (const y of [hy - 210, hy - 80]) {
        litWindow(ctx, x, y, 70, 90, night, 0.25);
        if (!night && rnd() < 0.4) { ctx.fillStyle = '#7a6448'; ctx.fillRect(x + 6, y + 6, 58, 40); }
        ctx.fillStyle = night ? '#0a0909' : '#3a2a20'; ctx.fillRect(x - 4, y + 90, 78, 6);
      }
      ctx.fillStyle = night ? '#060505' : '#2a201a'; ctx.fillRect(x + 100, hy - 60, 46, 110);
    }
    for (let i = 0; i < 40; i++) { const sx = R(0, VW); ctx.fillStyle = 'rgba(20,16,14,0.2)'; ctx.fillRect(sx, hy - 260, R(3, 10), R(50, 200)); }
    // timber shoring across one house
    ctx.strokeStyle = night ? '#050404' : '#3a2c22'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(560, hy + 100); ctx.lineTo(700, hy - 140); ctx.stroke();
    ctx.fillStyle = night ? '#060606' : '#4a4640'; ctx.fillRect(0, hy + 100, VW, VH);
    for (let y = hy + 104; y < VH; y += 9) for (let x = (y % 18); x < VW; x += 18) { ctx.fillStyle = `rgba(0,0,0,${R(0.1, 0.3)})`; ctx.fillRect(x, y, 16, 1.5); }
    if (night) softDot(ctx, 820, hy - 120, 160, 'rgba(255,180,100,0.18)');
  },
  // behind the junk shop: chimney-pots beyond the yard walls
  yard(ctx, night, art, hy) {
    sky(ctx, night, hy, 1);
    for (let k = 0; k < 4; k++) {
      roofline(ctx, { night, y0: hy + 30 + k * 40, hMin: 6 + k * 6, hMax: 20 + k * 10, wMin: 30 + k * 12, wMax: 60 + k * 20,
        dist: 0.55 - k * 0.14, chim: 1, base: [76, 58, 48], warm: 1, pitch: 0.9, win: k > 1 });
    }
    // smoke from a few chimneys
    if (!night) for (let i = 0; i < 6; i++) {
      const x = R(80, 940), y = hy + R(-10, 40);
      for (let k = 0; k < 10; k++) softDot(ctx, x + k * 9 + R(-4, 4), y - k * 14, 10 + k * 3, 'rgba(200,196,188,0.08)');
    }
  },
  // the Inner Party quarter: trees and white blocks
  inner(ctx, night, art, hy) {
    sky(ctx, night, hy);
    facade(ctx, 40, hy - 200, 360, hy + 200, night, { base: [196, 196, 190], ww: 34, wh: 50, gx: 64, gy: 84, dist: 0.25, lit: 0.45 });
    facade(ctx, 620, hy - 260, 420, hy + 200, night, { base: [200, 200, 194], ww: 34, wh: 50, gx: 64, gy: 84, dist: 0.2, lit: 0.5 });
    for (let i = 0; i < 9; i++) {
      const x = R(0, VW), y = hy + R(40, 120);
      for (let k = 0; k < 30; k++) softDot(ctx, x + R(-60, 60), y + R(-90, 10), R(16, 40), night ? 'rgba(4,6,5,0.9)' : `rgba(${R(50, 70) | 0},${R(62, 80) | 0},${R(40, 52) | 0},0.85)`);
      ctx.fillStyle = night ? '#030403' : '#2a241e'; ctx.fillRect(x - 4, y, 8, 140);
    }
    ctx.fillStyle = night ? '#050506' : '#6a6a66'; ctx.fillRect(0, hy + 200, VW, VH);
  },
  // the side street by the café, the chestnut tree's branches
  square(ctx, night, art, hy) {
    sky(ctx, night, hy, 1);
    facade(ctx, -20, hy - 260, 520, hy + 60, night, { base: [150, 146, 136], dist: 0.15 });
    roofline(ctx, { night, y0: hy - 30, hMin: 10, hMax: 60, wMin: 50, wMax: 110, dist: 0.4, base: [90, 86, 80], warm: 1 });
    ctx.strokeStyle = night ? '#030303' : '#2a221c';
    const branch = (x, y, a, l, w) => {
      if (w < 1) return;
      const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (w < 4 && !night) for (let k = 0; k < 4; k++) softDot(ctx, x2 + R(-20, 20), y2 + R(-20, 20), R(10, 24), 'rgba(70,84,50,0.7)');
      branch(x2, y2, a + R(-0.6, -0.1), l * 0.75, w * 0.68);
      branch(x2, y2, a + R(0.1, 0.6), l * 0.75, w * 0.68);
    };
    branch(860, VH, -1.75, 180, 30);
    ctx.fillStyle = night ? '#050505' : '#5a5854'; ctx.fillRect(0, hy + 60, 760, VH);
  },
  // London from high up in the Ministry: roofs to the horizon, the other pyramids
  ministry(ctx, night, art, hy) {
    sky(ctx, night, hy);
    if (night) searchlights(ctx, hy);
    pyramid(ctx, 180, hy + 4, 160, 90, night, 0.6);
    pyramid(ctx, 860, hy + 6, 150, 84, night, 0.62);
    for (let k = 0; k < 6; k++) {
      roofline(ctx, { night, y0: hy + 10 + k * 45, hMin: 3 + k * 4, hMax: 10 + k * 12, wMin: 12 + k * 10, wMax: 30 + k * 22,
        dist: 0.7 - k * 0.12, chim: 0.6, base: [80, 74, 68] });
    }
  },
  // the back court of the block
  court(ctx, night, art, hy) {
    sky(ctx, night, hy);
    facade(ctx, -20, hy - 300, 1080, VH, night, { base: [110, 108, 100], ww: 26, wh: 40, gx: 58, gy: 80, dist: 0.08, lit: 0.2 });
    ctx.strokeStyle = night ? 'rgba(0,0,0,0)' : 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const y = hy - 100 + i * 60; ctx.beginPath(); ctx.moveTo(100, y); ctx.quadraticCurveTo(500, y + 30, 900, y); ctx.stroke();
      if (!night) for (let k = 0; k < 8; k++) { ctx.fillStyle = ['#c8c4b8', '#8a8478', '#6a6a72'][k % 3]; ctx.fillRect(150 + k * 90 + R(-10, 10), y + 10, R(18, 30), R(24, 40)); } }
  },
};

export function view(kind, night, art, horizon = 0.39) {
  srand(700 + kind.length * 13 + (night ? 1 : 0));
  const [c, ctx] = cv(VW, VH);
  const hy = Math.round(VH * (1 - horizon));
  (VIEWS[kind] || VIEWS.city)(ctx, night, art, hy);
  // aerial perspective and a soft camera blur: the glass is never clean
  ctx.filter = 'blur(1.2px)'; ctx.drawImage(c, 0, 0); ctx.filter = 'none';
  return toTex(c, { aniso: 4 });
}

// ---------------------------------------------------------------- surfaces

// Anisotropic tileable value noise (separate periods per axis).
function vn2(x, y, px, py) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const h = (i, j) => {
    i = ((i % px) + px) % px; j = ((j % py) + py) % py;
    let n = i * 374761393 + j * 668265263 + 1013904223;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Distemper and gloss paint: a light neutral grey with soft blotches, brush
// marks and specks, tinted by the material colour. Tileable, 512 px.
export function paintNeutral(sd = 1) {
  srand(800 + sd);
  const S = 512;
  const [c, ctx] = cv(S, S);
  const img = ctx.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm(x / 128, y / 128, 4, 4);
      const m = fbm(x / 32 + 7, y / 32 + 3, 3, 16);
      const brush = vn2(x / 4, y / 64, 128, 8) * 0.6 + vn2(x / 8, y / 128, 64, 4) * 0.4;
      let v = 0.86 + (n - 0.5) * 0.16 + (m - 0.5) * 0.05 + (brush - 0.5) * 0.035;
      if (rnd() < 0.0015) v -= R(0.08, 0.25);
      const i = (y * S + x) * 4;
      d[i] = v * 255; d[i + 1] = v * 252; d[i + 2] = v * 244; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c, { repeat: true });
}

// Normal map from a height function (wraps at the edges, so it tiles).
function normalFrom(hf, S, strength) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = hf(x, y);
  const [c, ctx] = cv(S, S);
  const img = ctx.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const l = h[y * S + ((x - 1 + S) % S)], r = h[y * S + ((x + 1) % S)];
      const u = h[((y - 1 + S) % S) * S + x], b = h[((y + 1) % S) * S + x];
      let nx = (l - r) * strength, ny = (b - u) * strength, nz = 1;
      const k = 1 / Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      d[i] = (nx * k * 0.5 + 0.5) * 255; d[i + 1] = (ny * k * 0.5 + 0.5) * 255; d[i + 2] = (nz * k * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c, { srgb: false, repeat: true });
}

// Plaster / paper bump: fine orange-peel, trowel undulation and pits.
export function plasterBump() {
  srand(820);
  const pits = [];
  for (let i = 0; i < 220; i++) pits.push([R(0, 512), R(0, 512), R(1, 3.5)]);
  return normalFrom((x, y) => {
    let v = fbm(x / 8, y / 8, 3, 64) * 0.5 + fbm(x / 64, y / 64, 3, 8) * 1.6;
    return v;
  }, 512, 2.2);
}

// Woven fabric / carpet pile.
export function pileBump() {
  srand(830);
  return normalFrom((x, y) => vn2(x / 2, y / 2, 128, 128) * 0.6 + fbm(x / 16, y / 16, 3, 32) * 0.5 + ((x + y) % 4 < 2 ? 0.08 : 0), 256, 1.6);
}

// Winston's wallpaper: a cheap utility paper, grey-green ground with a
// small trellis and faded four-petal motifs. One tile = one 0.53 m strip.
export function paperUtility() {
  srand(840);
  const S = 512;
  const [c, ctx] = cv(S, S);
  ctx.fillStyle = '#a19d84'; ctx.fillRect(0, 0, S, S);
  // printed trellis, slightly misregistered
  const n = 8, step = S / n;
  ctx.lineWidth = 2.2;
  for (const [ox, col] of [[1.5, 'rgba(120,124,100,0.55)'], [0, 'rgba(96,100,82,0.6)']]) {
    ctx.strokeStyle = col;
    for (let k = -n; k <= 2 * n; k++) {
      ctx.beginPath(); ctx.moveTo(k * step + ox, 0); ctx.lineTo(k * step + S + ox, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k * step + ox, 0); ctx.lineTo(k * step - S + ox, S); ctx.stroke();
    }
  }
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = i * step + (j % 2 ? step / 2 : 0), y = j * step;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        ctx.fillStyle = 'rgba(132,104,84,0.75)';
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6.5, 3.2, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(92,86,70,0.8)'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // strip seam: a dark line of grime and a lighter overlap
  ctx.fillStyle = 'rgba(40,36,28,0.35)'; ctx.fillRect(0, 0, 2, S);
  ctx.fillStyle = 'rgba(220,214,190,0.25)'; ctx.fillRect(2, 0, 3, S);
  mottle(ctx, S, S, 2, 0.35, [120, 106, 72], 2);
  mottle(ctx, S, S, 4, 0.18, [70, 64, 50], 4);
  grain(ctx, S, S, 0.05);
  return toTex(c, { repeat: true });
}

// Parsons' wallpaper: a faded regency stripe, cream and dull green.
export function paperStripe() {
  srand(850);
  const S = 512;
  const [c, ctx] = cv(S, S);
  ctx.fillStyle = '#b6ad8c'; ctx.fillRect(0, 0, S, S);
  const bands = [[0, 60, '#7a8064'], [60, 20, '#c4ba98'], [80, 8, '#6a7056'], [88, 80, '#b8ae8e'], [168, 8, '#6a7056'], [176, 20, '#c4ba98'], [196, 60, '#7a8064']];
  for (let rep = 0; rep < 2; rep++) for (const [x, w, col] of bands) { ctx.fillStyle = col; ctx.fillRect(rep * 256 + x, 0, w, S); }
  for (let y = 0; y < S; y += 32) { ctx.fillStyle = 'rgba(80,70,50,0.12)'; ctx.fillRect(0, y, S, 2); }
  ctx.fillStyle = 'rgba(40,36,28,0.4)'; ctx.fillRect(0, 0, 2, S);
  mottle(ctx, S, S, 2, 0.45, [128, 110, 70], 2);
  mottle(ctx, S, S, 6, 0.2, [60, 56, 44], 6);
  grain(ctx, S, S, 0.06);
  return toTex(c, { repeat: true });
}

// The junk shop: a dark Victorian paper, olive and umber leaves, nearly gone
// brown with a century of gas and tobacco.
export function paperVictorian() {
  srand(860);
  const S = 512;
  const [c, ctx] = cv(S, S);
  ctx.fillStyle = '#5a4c34'; ctx.fillRect(0, 0, S, S);
  const leaf = (x, y, s, a, col) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.bezierCurveTo(18, -16, 18, 16, 0, 34); ctx.bezierCurveTo(-18, 16, -18, -16, 0, -30); ctx.fill();
    ctx.restore();
  };
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const x = i * 128 + (j % 2) * 64, y = j * 128 + 64;
      for (let k = 0; k < 6; k++) leaf(x + Math.cos(k) * 30, y + Math.sin(k * 1.3) * 30, 0.9, k * 1.05, k % 2 ? '#6a5c3a' : '#4e4630');
      ctx.fillStyle = '#7a5a36'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(40,32,20,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.quadraticCurveTo(x + 30, y, x, y - 60); ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(20,16,10,0.4)'; ctx.fillRect(0, 0, 2, S);
  mottle(ctx, S, S, 2, 0.4, [50, 38, 22], 2);
  mottle(ctx, S, S, 5, 0.25, [90, 70, 40], 5);
  grain(ctx, S, S, 0.06);
  return toTex(c, { repeat: true });
}

// Plain marbled linoleum, worn paler where people walk (low frequency).
export function linoPlain(base = [92, 70, 52]) {
  srand(870 + base[0]);
  const S = 512;
  const [c, ctx] = cv(S, S);
  const img = ctx.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const w = vn2(x / 32 + fbm(x / 64, y / 64, 3, 8) * 3, y / 128, 16, 4);
      const n = fbm(x / 32, y / 32, 4, 16);
      const k = 0.82 + (w - 0.5) * 0.3 + (n - 0.5) * 0.2;
      const i = (y * S + x) * 4;
      d[i] = base[0] * k; d[i + 1] = base[1] * k; d[i + 2] = base[2] * k; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  grain(ctx, S, S, 0.03);
  return toTex(c, { repeat: true });
}

// Wall-to-wall carpet pile with a faint shading of wear.
export function carpet(base = [26, 34, 62]) {
  srand(880 + base[2]);
  const S = 256;
  const [c, ctx] = cv(S, S);
  const img = ctx.createImageData(S, S); const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm(x / 32, y / 32, 4, 8), f = rnd();
      const k = 0.85 + (n - 0.5) * 0.25 + (f - 0.5) * 0.18;
      const i = (y * S + x) * 4;
      d[i] = base[0] * k; d[i + 1] = base[1] * k; d[i + 2] = base[2] * k; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c, { repeat: true });
}

// Book spines for shelves: 16 spines across one texture, cloth and leather.
export function bookSpines(sd = 0) {
  srand(890 + sd);
  const [c, ctx] = cv(512, 256);
  let x = 0;
  const cols = ['#4a2a22', '#283a2c', '#2a2c40', '#5a4a30', '#6a5a46', '#3a2a24', '#1c1c1e', '#7a6a50', '#4c3a3a', '#30302a'];
  while (x < 512) {
    const w = R(18, 40);
    ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
    ctx.fillRect(x, 0, w, 256);
    ctx.fillStyle = 'rgba(200,170,90,0.55)';
    for (const y of [R(20, 34), R(200, 226)]) ctx.fillRect(x + 3, y, w - 6, 3);
    if (rnd() < 0.7) { ctx.fillStyle = 'rgba(210,180,100,0.5)'; ctx.fillRect(x + w * 0.3, R(60, 90), w * 0.4, R(30, 70)); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, 0, 2, 256);
    x += w;
  }
  mottle(ctx, 512, 256, 3, 0.3, [30, 24, 18], 3);
  grain(ctx, 512, 256, 0.08);
  return toTex(c);
}

// Aged mirror silvering: dark foxing spots and edge loss. Used as a colour
// map on a metallic surface, so dark means no reflection.
export function mirrorAged() {
  srand(900);
  const S = 256;
  const [c, ctx] = cv(S, S);
  ctx.fillStyle = '#cfcfc8'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) softDot(ctx, R(0, S), R(0, S), R(2, 10), `rgba(40,36,30,${R(0.2, 0.6)})`);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(30,26,20,0.5)'); g.addColorStop(0.12, 'rgba(30,26,20,0)'); g.addColorStop(0.88, 'rgba(30,26,20,0)'); g.addColorStop(1, 'rgba(30,26,20,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  mottle(ctx, S, S, 3, 0.3, [60, 56, 48], 3);
  return toTex(c);
}

// Etched / frosted pub glass: alpha is the frosting.
export function frosted(text) {
  srand(910);
  const [c, ctx] = cv(512, 256);
  ctx.fillStyle = 'rgba(214,214,206,0.82)'; ctx.fillRect(0, 0, 512, 256);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, 480, 224);
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(256, 128, 60 + k * 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  if (text) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.font = `bold 54px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 150);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 40; i++) softDot(ctx, R(0, 512), R(0, 256), R(10, 40), 'rgba(120,110,90,0.08)');
  return toTex(c);
}

// A soft vertical gradient for light shafts and steam (white, alpha falls off).
export function shaft() {
  const [c, ctx] = cv(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.15, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.25, 'rgba(0,0,0,0)'); h.addColorStop(0.75, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256);
  return toTex(c, { srgb: false });
}

// Washing on the line: a sheet, a shirt, nappies. Greyish whites.
export function laundry(kind) {
  srand(920 + kind.length);
  const [c, ctx] = cv(128, 128);
  const base = { sheet: '#d2cfc4', shirt: '#9a9c9e', nappy: '#dedad0', apron: '#8a7a68', vest: '#c6c0b0' }[kind] || '#ccc';
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 30; i++) softDot(ctx, R(0, 128), R(0, 128), R(8, 30), 'rgba(90,84,70,0.1)');
  for (let y = 0; y < 128; y += 3) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(0, y, 128, 1); }
  if (kind === 'shirt') { ctx.fillStyle = 'rgba(40,40,44,0.5)'; for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 3, 128); }
  grain(ctx, 128, 128, 0.06);
  return toTex(c);
}
