// Signage atlas v2. Real Korean signboard typography (bundled OFL fonts) laid out the way street signs
// actually are: flex panel signs, channel letters, 돌출간판 blades, pharmacy crosses, LED tickers,
// large format ads and infrastructure stencils. Drawn once into a canvas → one texture.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { SHOPS, BLADES, ADS, TICKERS, DECALS, NOTICES, BRANDS } from '../data/signs.js';

export const CORPS = Object.entries(BRANDS).filter(([id]) => id !== 'gov').map(([id, b]) => ({ id, ...b }));

const FONT_FILES = [
  ['NS Black', 'sign-black.woff2', '400'], ['NS Dohyeon', 'sign-dohyeon.woff2', '400'], ['NS Jua', 'sign-jua.woff2', '400'],
  ['NS Myeongjo', 'sign-myeongjo.woff2', '800'], ['NS Brush', 'sign-brush.woff2', '400'],
  ['NS Tech', 'tech-500.woff2', '500'], ['NS Tech', 'tech-800.woff2', '800'], ['NS Mono', 'mono-600.woff2', '600'],
  ['NS UI', 'ui-400.woff2', '400'], ['NS UI', 'ui-700.woff2', '700'],
];
let fontsReady = null;
export function loadFonts() {
  if (fontsReady) return fontsReady;
  const base = new URL('../../assets/fonts/', import.meta.url).href;
  fontsReady = Promise.all(FONT_FILES.map(async ([fam, file, weight]) => {
    try { const ff = new FontFace(fam, `url(${base}${file})`, { weight }); await ff.load(); document.fonts.add(ff); }
    catch (e) { console.warn('[NS] font failed', file, e.message); }
  }));
  return fontsReady;
}

const HUES = {
  red: { bg: '#cf2a1d', fg: '#ffffff', ac: '#ffe14d', glow: [1.0, 0.25, 0.18] },
  yellow: { bg: '#ffd21f', fg: '#17171a', ac: '#d42b1e', glow: [1.0, 0.82, 0.2] },
  blue: { bg: '#1454ba', fg: '#ffffff', ac: '#8fdcff', glow: [0.25, 0.5, 1.0] },
  green: { bg: '#0d8a4c', fg: '#ffffff', ac: '#e0ff8a', glow: [0.2, 0.95, 0.5] },
  white: { bg: '#f1f1ec', fg: '#15151a', ac: '#d42b1e', glow: [1.0, 0.97, 0.9] },
  orange: { bg: '#f27717', fg: '#ffffff', ac: '#1c1c1c', glow: [1.0, 0.5, 0.12] },
  cream: { bg: '#eee0c0', fg: '#2a1a12', ac: '#a8261c', glow: [1.0, 0.86, 0.6] },
  dark: { bg: '#17120e', fg: '#ecdcb8', ac: '#c8402c', glow: [1.0, 0.7, 0.4] },
  gold: { bg: '#181206', fg: '#ffcf5a', ac: '#ffcf5a', glow: [1.0, 0.75, 0.3] },
  pink: { bg: '#0b0b10', fg: '#ff4fae', ac: '#5ff2e6', glow: [1.0, 0.2, 0.6] },
  cyan: { bg: '#0b0b10', fg: '#5ff2e6', ac: '#ff4fae', glow: [0.2, 0.95, 0.9] },
  amber: { bg: '#0b0b10', fg: '#ffb347', ac: '#ff5a3c', glow: [1.0, 0.62, 0.18] },
  violet: { bg: '#0b0b10', fg: '#a58bff', ac: '#ff4fae', glow: [0.6, 0.4, 1.0] },
};
const KFONT = ['NS Black', 'NS Dohyeon', 'NS Jua'];

export class SignAtlas {
  static async create(size = 4096, seed = 20491) { await loadFonts(); return new SignAtlas(size, seed); }

  constructor(size = 4096, seed = 20491) {
    this.size = size; const S = size / 4096;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'); this.g = g;
    g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
    const rng = new RNG(seed);
    this.h = []; this.v = []; this.bb = []; this.sq = []; this.corp = {}; this.wide = []; this.tick = []; this.decal = {}; this.notice = [];
    const rect = (x, y, w, h, extra = {}) => ({ u0: (x + 1) / size, v0: 1 - (y + h - 1) / size, u1: (x + w - 1) / size, v1: 1 - (y + 1) / size, aspect: w / h, ...extra });
    const F = (fam, px, weight = 400) => `${weight} ${Math.max(4, px)}px "${fam}", "NS UI", sans-serif`;
    const fit = (txt, fam, px, maxW, weight = 400) => { g.font = F(fam, px, weight); const w = g.measureText(txt).width; if (w > maxW) px *= maxW / w; g.font = F(fam, px, weight); return px; };
    const clip = (x, y, w, h, fn) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); fn(); g.restore(); };
    const text = (t, x, y, col, o = {}) => {
      g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle';
      if (o.glow) { g.shadowColor = o.glowCol || col; g.shadowBlur = o.glow; }
      if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.stroke; g.strokeStyle = o.strokeCol || '#000'; g.strokeText(t, x, y); }
      g.fillStyle = col; g.fillText(t, x, y); g.shadowBlur = 0;
    };
    // backlight unevenness + grime so panels don't look freshly printed
    const age = (x, y, w, h, amt = 1) => {
      const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, `rgba(0,0,0,${0.28 * amt})`); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.18 * amt})`);
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      for (let i = 0; i < 5; i++) { const sx = x + rng.f(0, w), sw = rng.f(4, 22) * S; const sg = g.createLinearGradient(sx, y, sx, y + h * rng.f(0.3, 1)); sg.addColorStop(0, `rgba(20,14,8,${0.22 * amt})`); sg.addColorStop(1, 'rgba(20,14,8,0)'); g.fillStyle = sg; g.fillRect(sx, y, sw, h); }
      g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 5 * S; g.strokeRect(x + 2.5 * S, y + 2.5 * S, w - 5 * S, h - 5 * S);
    };
    const neonStroke = (drawPath, col, lw) => {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col; g.shadowColor = col;
      g.lineWidth = lw * 2.2; g.globalAlpha = 0.35; g.shadowBlur = lw * 5; drawPath(); g.stroke();
      g.lineWidth = lw; g.globalAlpha = 1; g.shadowBlur = lw * 2; drawPath(); g.stroke();
      g.lineWidth = lw * 0.4; g.strokeStyle = '#fff'; g.globalAlpha = 0.9; g.shadowBlur = 0; drawPath(); g.stroke(); g.restore();
    };
    const neonText = (t, x, y, fam, px, col, o = {}) => {
      g.save(); g.font = F(fam, px, o.weight || 400); g.textAlign = o.align || 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.strokeStyle = col; g.shadowColor = col; g.lineWidth = px * 0.075; g.globalAlpha = 0.4; g.shadowBlur = px * 0.5; g.strokeText(t, x, y);
      g.globalAlpha = 1; g.lineWidth = px * 0.05; g.shadowBlur = px * 0.18; g.strokeText(t, x, y);
      g.strokeStyle = '#fff'; g.lineWidth = px * 0.016; g.shadowBlur = 0; g.globalAlpha = 0.9; g.strokeText(t, x, y); g.restore();
    };
    const phone = () => `${rng.i(2, 9)}${rng.i(0, 9)}${rng.i(0, 9)}-${rng.i(1000, 9999)}`;

    // ------------------------------------------------------------------ horizontal shop signs (512x128)
    const drawShop = (x, y, w, h, row) => {
      const [name, sub, tpl, hue] = row; const H = HUES[hue] || HUES.white; const p = h * 0.12;
      const fam = tpl === 'trad' ? (rng.chance(0.5) ? 'NS Myeongjo' : 'NS Brush') : tpl === 'chain' ? 'NS Jua' : rng.pick(KFONT);
      if (tpl === 'panel' || tpl === 'chain' || tpl === 'cross') {
        const bgc = tpl === 'cross' ? '#f3f4f0' : H.bg;
        const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, bgc); gr.addColorStop(0.5, bgc); gr.addColorStop(1, bgc);
        g.fillStyle = bgc; g.fillRect(x, y, w, h);
        let tx = x + p * 1.4, tw = w - p * 2.8;
        if (tpl === 'cross') { // pharmacy / clinic block
          const bw = h * 1.0; g.fillStyle = H.bg; g.fillRect(x, y, bw, h);
          if (name.includes('약국')) { fit('약', 'NS Black', h * 0.78, bw * 0.8); text('약', x + bw / 2, y + h * 0.54, '#fff', { align: 'center' }); }
          else { g.fillStyle = '#fff'; const c = h * 0.2; g.fillRect(x + bw / 2 - c * 0.32, y + h / 2 - c, c * 0.64, c * 2); g.fillRect(x + bw / 2 - c, y + h / 2 - c * 0.32, c * 2, c * 0.64); }
          tx = x + bw + p; tw = w - bw - p * 2;
        } else if (tpl === 'chain') { // stripe band + round tag
          g.fillStyle = H.ac; g.fillRect(x, y, w, h * 0.1); g.fillRect(x, y + h * 0.9, w, h * 0.1);
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x + h * 0.55, y + h / 2, h * 0.3, 0, 6.283); g.fill();
          fit('24', 'NS Tech', h * 0.3, h * 0.44, 800); text('24', x + h * 0.55, y + h * 0.52, H.bg, { align: 'center' });
          tx = x + h * 1.0; tw = w - h * 1.0 - p;
        } else if (rng.chance(0.45)) { // contrasting end block with phone / category
          const bw = w * 0.2; g.fillStyle = H.ac; g.fillRect(x + w - bw, y, bw, h);
          const lab = rng.chance(0.5) ? '☎' : sub.split(' · ')[0].slice(0, 2);
          const pc = H.ac === '#1c1c1c' || H.ac === '#d42b1e' || H.ac === '#a8261c' ? '#fff' : '#15151a';
          fit(lab, 'NS Dohyeon', h * 0.4, bw * 0.8); text(lab, x + w - bw / 2, y + h * 0.36, pc, { align: 'center' });
          fit(phone(), 'NS Mono', h * 0.2, bw * 0.86, 600); text(phone(), x + w - bw / 2, y + h * 0.74, pc, { align: 'center' });
          tw -= bw;
        }
        const fgc = tpl === 'cross' ? H.bg : H.fg;
        const two = sub && rng.chance(0.8);
        const px = fit(name, fam, h * (two ? 0.56 : 0.66), tw);
        const outline = fgc === '#ffffff' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.0)';
        text(name, tx, y + h * (two ? 0.4 : 0.52), fgc, { stroke: px * 0.07, strokeCol: outline });
        g.font = F(fam, px); const nameW = g.measureText(name).width;
        if (two) { fit(sub, 'NS Dohyeon', h * 0.19, tw); text(sub, tx + px * 0.04, y + h * 0.8, tpl === 'cross' ? '#30343a' : (H.fg === '#ffffff' ? H.ac : H.ac)); }
        else if (nameW < tw * 0.62) { fit(sub, 'NS Dohyeon', h * 0.2, tw - nameW - p); text(sub, tx + nameW + p, y + h * 0.58, tpl === 'cross' ? '#30343a' : H.ac); }
        age(x, y, w, h, 1);
      } else if (tpl === 'trad') {
        g.fillStyle = H.bg; g.fillRect(x, y, w, h);
        if (hue === 'dark' || hue === 'gold') { for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${90 + rng.i(0, 40)},${60 + rng.i(0, 20)},30,${rng.f(0.03, 0.09)})`; g.fillRect(x, y + rng.f(0, h), w, rng.f(1, 5) * S); } }
        g.strokeStyle = H.fg; g.globalAlpha = 0.55; g.lineWidth = 2 * S; g.strokeRect(x + p * 0.6, y + p * 0.6, w - p * 1.2, h - p * 1.2); g.globalAlpha = 1;
        const st = h * 0.34; g.fillStyle = H.ac; g.fillRect(x + p * 1.3, y + h / 2 - st / 2, st, st);
        const seal = name.includes('주점') || name.includes('포차') ? '술' : name.includes('당') ? '금' : name.includes('여관') ? '숙' : '맛';
        fit(seal, 'NS Myeongjo', st * 0.78, st, 800); text(seal, x + p * 1.3 + st / 2, y + h * 0.52, '#fff', { align: 'center' });
        const tx = x + p * 1.9 + st, tw = w - (p * 3 + st);
        const px = fit(name, fam, h * (fam === 'NS Brush' ? 0.74 : 0.56), tw, fam === 'NS Myeongjo' ? 800 : 400);
        text(name, tx, y + h * 0.42, H.fg, hue === 'gold' ? { glow: px * 0.25 } : {});
        fit(sub, 'NS Myeongjo', h * 0.17, tw, 800); text(sub, tx + 2 * S, y + h * 0.82, H.ac);
        age(x, y, w, h, 0.8);
      } else if (tpl === 'channel') {
        const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#14151a'); gr.addColorStop(1, '#08090c'); g.fillStyle = gr; g.fillRect(x, y, w, h);
        const px = fit(name, fam, h * 0.58, w - p * 3);
        g.font = F(fam, px); const nw = g.measureText(name).width;
        text(name, x + w / 2 - nw / 2, y + h * 0.42, '#fff8ea', { glow: px * 0.5, glowCol: H.fg });
        text(name, x + w / 2 - nw / 2, y + h * 0.42, '#fff8ea', { glow: px * 0.15, glowCol: H.fg });
        g.fillStyle = H.fg; g.shadowColor = H.fg; g.shadowBlur = 8 * S; g.fillRect(x + w / 2 - nw / 2, y + h * 0.72, nw, 3 * S); g.shadowBlur = 0;
        fit(sub, 'NS Dohyeon', h * 0.15, w - p * 3); text(sub, x + w / 2, y + h * 0.86, '#a9b0ba', { align: 'center' });
        age(x, y, w, h, 0.5);
      } else if (tpl === 'neon') {
        g.fillStyle = '#07070a'; g.fillRect(x, y, w, h);
        const ic = h * 0.3, icx = x + p + ic, icy = y + h * 0.5;
        const kind = rng.i(0, 2);
        neonStroke(() => { g.beginPath(); if (kind === 0) { g.moveTo(icx - ic * 0.7, icy - ic * 0.7); g.lineTo(icx + ic * 0.7, icy - ic * 0.7); g.lineTo(icx, icy + ic * 0.1); g.closePath(); g.moveTo(icx, icy + ic * 0.1); g.lineTo(icx, icy + ic * 0.8); g.moveTo(icx - ic * 0.4, icy + ic * 0.8); g.lineTo(icx + ic * 0.4, icy + ic * 0.8); } else if (kind === 1) { g.arc(icx, icy - ic * 0.1, ic * 0.75, 0, Math.PI); g.moveTo(icx - ic * 0.9, icy - ic * 0.1); g.lineTo(icx + ic * 0.9, icy - ic * 0.1); g.moveTo(icx - ic * 0.3, icy - ic * 0.5); g.quadraticCurveTo(icx - ic * 0.1, icy - ic * 0.8, icx - ic * 0.3, icy - ic * 1.05); g.moveTo(icx + ic * 0.2, icy - ic * 0.5); g.quadraticCurveTo(icx + ic * 0.4, icy - ic * 0.8, icx + ic * 0.2, icy - ic * 1.05); } else { for (let k = 0; k < 5; k++) { const a = -1.571 + k * 2.513; g[k ? 'lineTo' : 'moveTo'](icx + Math.cos(a) * ic * 0.85, icy + Math.sin(a) * ic * 0.85); } g.closePath(); } }, H.ac, 3.2 * S);
        const tx = x + p * 2 + ic * 2, tw = w - (p * 3 + ic * 2);
        const px = fit(name, fam, h * 0.56, tw); neonText(name, tx, y + h * 0.42, fam, px, H.fg);
        const px2 = fit(sub, 'NS Dohyeon', h * 0.17, tw); neonText(sub, tx, y + h * 0.82, 'NS Dohyeon', px2, H.ac);
      } else { // tech
        g.fillStyle = '#05070a'; g.fillRect(x, y, w, h);
        const grd = g.createLinearGradient(x, y, x + w, y); grd.addColorStop(0, H.fg); grd.addColorStop(1, H.ac);
        g.strokeStyle = H.fg; g.lineWidth = 2 * S; const b = h * 0.16;
        for (const [cx2, cy2, sx, sy] of [[x + p, y + p, 1, 1], [x + w - p, y + p, -1, 1], [x + p, y + h - p, 1, -1], [x + w - p, y + h - p, -1, -1]]) { g.beginPath(); g.moveTo(cx2 + sx * b, cy2); g.lineTo(cx2, cy2); g.lineTo(cx2, cy2 + sy * b); g.stroke(); }
        const tag = rng.pick(['NET-7', 'LV.0', 'ID//' + rng.i(100, 999), 'KRS-9', 'SYS.OK', '24H']);
        g.font = F('NS Tech', h * 0.14, 500); text(tag, x + p * 1.8, y + h * 0.24, H.ac);
        g.font = F('NS Mono', h * 0.15, 600); text(sub, x + w - p * 1.8, y + h * 0.82, '#9aa7b4', { align: 'right' });
        const px = fit(name, 'NS Dohyeon', h * 0.52, w - p * 4);
        g.shadowColor = H.fg; g.shadowBlur = px * 0.35; text(name, x + p * 1.8, y + h * 0.56, grd); g.shadowBlur = 0; text(name, x + p * 1.8, y + h * 0.56, grd);
        g.fillStyle = 'rgba(0,0,0,0.35)'; for (let yy = 0; yy < h; yy += 4 * S) g.fillRect(x, y + yy, w, 1.2 * S);
      }
    };
    const hw = 512 * S, hh = 128 * S;
    SHOPS.forEach((row, i) => {
      const x = (i % 8) * hw, y = Math.floor(i / 8) * hh;
      clip(x, y, hw, hh, () => drawShop(x, y, hw, hh, row));
      this.h.push(rect(x, y, hw, hh, { glow: (HUES[row[3]] || HUES.white).glow, tpl: row[2], name: row[0] }));
    });

    // ------------------------------------------------------------------ vertical blade signs (128x512)
    const vy = 896 * S, vw = 128 * S, vh = 512 * S;
    BLADES.forEach((row, i) => {
      const [name, tag, tpl, hue] = row; const H = HUES[hue] || HUES.white; const x = i * vw, y = vy;
      clip(x, y, vw, vh, () => {
        const lum = tpl === 'neon' || tpl === 'tech' || tpl === 'channel';
        g.fillStyle = lum ? '#08080b' : (tpl === 'cross' ? '#f3f4f0' : H.bg); g.fillRect(x, y, vw, vh);
        const capH = vw * 0.95;
        // top emblem
        if (tpl === 'cross') { g.fillStyle = H.bg; g.fillRect(x, y, vw, capH); g.fillStyle = '#fff'; const c = vw * 0.26; g.fillRect(x + vw / 2 - c * 0.32, y + capH / 2 - c, c * 0.64, c * 2); g.fillRect(x + vw / 2 - c, y + capH / 2 - c * 0.32, c * 2, c * 0.64); }
        else if (lum) neonStroke(() => { g.beginPath(); g.arc(x + vw / 2, y + capH / 2, vw * 0.3, 0, 6.283); }, H.ac, 3 * S);
        else { g.fillStyle = H.ac; g.beginPath(); g.arc(x + vw / 2, y + capH / 2, vw * 0.34, 0, 6.283); g.fill(); const lab = name[0]; const lc = H.ac === '#ffe14d' || H.ac === '#e0ff8a' || H.ac === '#8fdcff' ? '#15151a' : '#fff'; fit(lab, 'NS Black', vw * 0.46, vw * 0.5); text(lab, x + vw / 2, y + capH / 2 + 2 * S, lc, { align: 'center' }); }
        const tagH = tag ? vw * 0.62 : 0;
        const chars = [...name]; const n = chars.length; const area = vh - capH - tagH - vw * 0.2;
        const ch = Math.min(vw * 0.9, area / n);
        const fam = tpl === 'trad' ? 'NS Myeongjo' : rng.pick(KFONT);
        for (let k = 0; k < n; k++) {
          const cy = y + capH + vw * 0.1 + (k + 0.5) * (area / n);
          if (lum) { const px = fit(chars[k], fam, ch * 0.86, vw * 0.8); if (tpl === 'channel') { g.font = F(fam, px); text(chars[k], x + vw / 2, cy, '#fff8ea', { align: 'center', glow: px * 0.45, glowCol: H.fg }); } else neonText(chars[k], x + vw / 2, cy, fam, px, H.fg, { align: 'center' }); }
          else { const px = fit(chars[k], fam, ch * 0.9, vw * 0.84, fam === 'NS Myeongjo' ? 800 : 400); text(chars[k], x + vw / 2, cy, tpl === 'cross' ? H.bg : H.fg, { align: 'center', stroke: H.fg === '#ffffff' && tpl !== 'cross' ? px * 0.06 : 0, strokeCol: 'rgba(0,0,0,0.5)' }); }
        }
        if (tag) { g.fillStyle = lum ? '#111318' : H.ac; g.fillRect(x, y + vh - tagH, vw, tagH); const tc = lum ? H.ac : (H.ac === '#1c1c1c' || H.ac === '#d42b1e' || H.ac === '#a8261c' ? '#fff' : '#15151a'); fit(tag, 'NS Dohyeon', tagH * 0.5, vw * 0.8); text(tag, x + vw / 2, y + vh - tagH / 2 + 2 * S, tc, { align: 'center' }); }
        if (!lum) age(x, y, vw, vh, 0.9); else { g.strokeStyle = '#1b1d22'; g.lineWidth = 6 * S; g.strokeRect(x + 3 * S, y + 3 * S, vw - 6 * S, vh - 6 * S); }
      });
      this.v.push(rect(x, y, vw, vh, { glow: H.glow, tpl }));
    });

    // ------------------------------------------------------------------ large ads (1024x512)
    const ay = 1408 * S, aw = 1024 * S, ah = 512 * S;
    const motif = (kind, x, y, w, h, c1, c2) => {
      g.save(); g.lineWidth = 3 * S; g.strokeStyle = c2; g.fillStyle = c2;
      const cx = x + w * 0.76, cy = y + h * 0.48, R = h * 0.36;
      if (kind === 'sun') { const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8); rg.addColorStop(0, '#fff6d8'); rg.addColorStop(0.25, c1); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x, y, w, h); g.globalAlpha = 0.5; for (let k = 0; k < 36; k++) { const a = k / 36 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7); g.lineTo(cx + Math.cos(a) * R * (1.3 + 0.5 * (k % 2)), cy + Math.sin(a) * R * (1.3 + 0.5 * (k % 2))); g.stroke(); } }
      else if (kind === 'orbit') { for (let k = 0; k < 5; k++) { g.globalAlpha = 0.7 - k * 0.1; g.beginPath(); g.ellipse(cx, cy, R * (0.6 + k * 0.28), R * (0.2 + k * 0.1), -0.5, 0, 6.283); g.stroke(); } g.globalAlpha = 1; g.beginPath(); g.arc(cx, cy, R * 0.22, 0, 6.283); g.fill(); g.beginPath(); g.arc(cx + R * 1.1, cy - R * 0.5, R * 0.06, 0, 6.283); g.fill(); }
      else if (kind === 'beam') { for (let k = 0; k < 9; k++) { g.globalAlpha = 0.25 + 0.08 * k; g.fillRect(x + w * 0.55 + k * w * 0.05, y + h * (0.9 - k * 0.09), w * 0.035, h); } g.globalAlpha = 0.8; g.beginPath(); g.moveTo(x + w * 0.5, y + h); g.lineTo(x + w * 0.78, y + h * 0.12); g.lineTo(x + w * 1.0, y + h); g.stroke(); }
      else if (kind === 'lines') { for (let k = 0; k < 22; k++) { g.globalAlpha = 0.15 + 0.03 * k; g.beginPath(); g.moveTo(x + w * 0.5 + k * w * 0.025, y); g.lineTo(x + w * 0.38 + k * w * 0.025, y + h); g.stroke(); } g.globalAlpha = 1; g.beginPath(); g.arc(cx, cy, R * 0.7, 0, 6.283); g.stroke(); g.beginPath(); g.moveTo(cx, cy - R * 0.9); g.lineTo(cx, cy + R * 0.9); g.stroke(); }
      else if (kind === 'leaf') { for (let k = 0; k < 7; k++) { g.globalAlpha = 0.35 + 0.08 * k; const a = -1.9 + k * 0.32; g.beginPath(); g.moveTo(cx, cy + R); g.quadraticCurveTo(cx + Math.cos(a) * R * 1.5, cy + R + Math.sin(a) * R * 0.6, cx + Math.cos(a) * R * 1.3, cy + R + Math.sin(a) * R * 1.9); g.quadraticCurveTo(cx + Math.cos(a) * R * 0.3, cy + R + Math.sin(a) * R * 1.4, cx, cy + R); g.fill(); } }
      else if (kind === 'rings') { for (let k = 0; k < 9; k++) { g.globalAlpha = 0.8 - k * 0.07; g.strokeStyle = k % 2 ? c1 : c2; g.beginPath(); g.arc(cx, cy, R * (0.2 + k * 0.17), 0.4 * k, 0.4 * k + 4.4); g.stroke(); } }
      else if (kind === 'hex') { g.globalAlpha = 0.55; for (let r = -3; r < 4; r++) for (let q = -3; q < 5; q++) { const hx = cx + (q + (r & 1) * 0.5) * R * 0.34, hy = cy + r * R * 0.3; if (rng.chance(0.3)) continue; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.5236; g[k ? 'lineTo' : 'moveTo'](hx + Math.cos(a) * R * 0.17, hy + Math.sin(a) * R * 0.17); } g.closePath(); rng.chance(0.25) ? g.fill() : g.stroke(); } }
      else if (kind === 'bars') { for (let k = 0; k < 40; k++) { g.globalAlpha = rng.f(0.2, 0.8); const bh = rng.f(0.1, 0.8) * h; g.fillRect(x + w * 0.52 + k * w * 0.012, y + h * 0.9 - bh, w * 0.006, bh); } }
      else if (kind === 'arrow') { g.globalAlpha = 0.85; for (let k = 0; k < 4; k++) { const ox = k * R * 0.5; g.beginPath(); g.moveTo(cx - R + ox, cy + R * 0.7); g.lineTo(cx - R * 0.5 + ox, cy); g.lineTo(cx - R + ox, cy - R * 0.7); g.lineWidth = 14 * S; g.globalAlpha = 0.3 + k * 0.2; g.stroke(); } }
      else if (kind === 'rain') { g.globalAlpha = 0.5; for (let k = 0; k < 90; k++) { const rx = x + rng.f(0.45, 1) * w, ry = y + rng.f(0, 1) * h; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 10 * S, ry + 46 * S); g.stroke(); } g.globalAlpha = 1; g.lineWidth = 10 * S; g.beginPath(); g.arc(cx, cy + R * 0.2, R * 0.8, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(cx, cy + R * 0.2); g.lineTo(cx, cy + R * 1.0); g.arc(cx - R * 0.15, cy + R * 1.0, R * 0.15, 0, Math.PI); g.stroke(); }
      else if (kind === 'can') { const cw2 = R * 0.62, chh = R * 1.9; const lg = g.createLinearGradient(cx - cw2, 0, cx + cw2, 0); lg.addColorStop(0, c1); lg.addColorStop(0.35, '#fff4c8'); lg.addColorStop(0.6, c2); lg.addColorStop(1, '#30103a'); g.fillStyle = lg; g.beginPath(); g.roundRect(cx - cw2, cy - chh / 2, cw2 * 2, chh, cw2 * 0.25); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = F('NS Tech', R * 0.3, 800); g.textAlign = 'center'; g.save(); g.translate(cx, cy); g.rotate(-1.571); g.fillText('LUXADE', 0, R * 0.1); g.restore(); const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 2); rg.addColorStop(0, 'rgba(255,220,120,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x, y, w, h); }
      else if (kind === 'whale') { g.globalAlpha = 0.9; g.beginPath(); g.moveTo(cx - R * 1.5, cy); g.bezierCurveTo(cx - R * 1.2, cy - R * 0.9, cx + R * 0.3, cy - R * 0.9, cx + R * 0.9, cy - R * 0.15); g.bezierCurveTo(cx + R * 1.2, cy - R * 0.35, cx + R * 1.45, cy - R * 0.75, cx + R * 1.7, cy - R * 0.7); g.bezierCurveTo(cx + R * 1.5, cy - R * 0.3, cx + R * 1.55, cy + R * 0.1, cx + R * 1.75, cy + R * 0.3); g.bezierCurveTo(cx + R * 1.4, cy + R * 0.25, cx + R * 1.2, cy + R * 0.1, cx + R * 0.9, cy + R * 0.1); g.bezierCurveTo(cx + R * 0.2, cy + R * 0.6, cx - R * 1.1, cy + R * 0.6, cx - R * 1.5, cy); g.closePath(); const wg = g.createLinearGradient(cx - R * 1.5, cy - R, cx + R * 1.7, cy + R); wg.addColorStop(0, c1); wg.addColorStop(1, c2); g.fillStyle = wg; g.shadowColor = c1; g.shadowBlur = 40 * S; g.fill(); g.shadowBlur = 0; g.globalAlpha = 0.5; g.strokeStyle = '#fff'; g.lineWidth = 2 * S; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(cx - R * 1.2 + k * R * 0.2, cy + R * 0.2); g.quadraticCurveTo(cx - R * 0.8 + k * R * 0.2, cy + R * 0.5, cx - R * 0.2 + k * R * 0.15, cy + R * 0.3); g.stroke(); } }
      g.restore();
    };
    ADS.forEach((row, i) => {
      const [head, sub, brand, mot] = row; const B = BRANDS[brand]; const x = (i % 4) * aw, y = ay + Math.floor(i / 4) * ah;
      clip(x, y, aw, ah, () => {
        const gr = g.createLinearGradient(x, y, x + aw, y + ah); gr.addColorStop(0, '#07080c'); gr.addColorStop(0.55, '#0c0e16'); gr.addColorStop(1, B.alt);
        g.fillStyle = '#07080c'; g.fillRect(x, y, aw, ah); g.globalAlpha = 0.3; g.fillStyle = gr; g.fillRect(x, y, aw, ah); g.globalAlpha = 1;
        motif(mot, x, y, aw, ah, B.color, B.alt);
        const sh = g.createLinearGradient(x, y, x + aw * 0.7, y); sh.addColorStop(0, 'rgba(4,5,8,0.9)'); sh.addColorStop(1, 'rgba(4,5,8,0)'); g.fillStyle = sh; g.fillRect(x, y, aw, ah);
        const px = fit(head, 'NS Black', ah * 0.2, aw * 0.6);
        text(head, x + aw * 0.06, y + ah * 0.42, '#ffffff', { glow: px * 0.25, glowCol: B.color });
        fit(sub, 'NS Dohyeon', ah * 0.075, aw * 0.58); text(sub, x + aw * 0.062, y + ah * 0.6, B.color);
        g.fillStyle = B.color; g.fillRect(x + aw * 0.062, y + ah * 0.68, aw * 0.08, 4 * S);
        g.font = F('NS Tech', ah * 0.07, 800); text(B.name, x + aw * 0.062, y + ah * 0.86, '#fff');
        g.font = F('NS Dohyeon', ah * 0.045); const bw = g.measureText(B.name).width; g.font = F('NS Tech', ah * 0.07, 800); const bw2 = g.measureText(B.name).width; g.font = F('NS Dohyeon', ah * 0.045); text(B.ko, x + aw * 0.062 + bw2 + 16 * S, y + ah * 0.865, '#aeb6c2');
        g.font = F('NS Mono', ah * 0.03, 600); text('KRS-9 / AD-' + (1000 + i * 37) + ' / 광고심의필', x + aw * 0.062, y + ah * 0.14, 'rgba(255,255,255,0.45)');
        // matrix code block
        const q = ah * 0.012, qx = x + aw * 0.9, qy = y + ah * 0.78; g.fillStyle = 'rgba(255,255,255,0.8)'; for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) if (rng.chance(0.5)) g.fillRect(qx + a * q, qy + b * q, q * 0.9, q * 0.9);
      });
      this.bb.push(rect(x, y, aw, ah, { glow: hex(B.color), brand }));
    });

    // ------------------------------------------------------------------ corp sigils + wordmarks (256x256 / 512x128 in the 3456 row)
    const sy = 3456 * S, sw = 256 * S;
    CORPS.forEach((cp, i) => {
      const x = i * sw, y = sy, cx = x + sw / 2, cy = y + sw / 2 - 14 * S;
      clip(x, y, sw, sw, () => {
        g.shadowColor = cp.color; g.shadowBlur = 22 * S; g.strokeStyle = cp.color; g.fillStyle = cp.color; g.lineWidth = 9 * S; g.lineJoin = 'round';
        const R = 70 * S; g.beginPath();
        if (i === 0) { g.arc(cx, cy, R * 0.55, 0, 6.283); g.fill(); g.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.moveTo(cx + Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75); g.lineTo(cx + Math.cos(a) * R * 1.15, cy + Math.sin(a) * R * 1.15); } g.stroke(); }
        else if (i === 1) { g.moveTo(cx - R, cy - R * 0.8); g.lineTo(cx, cy + R); g.lineTo(cx + R, cy - R * 0.8); g.stroke(); g.beginPath(); g.moveTo(cx - R * 0.45, cy - R * 0.8); g.lineTo(cx, cy + R * 0.1); g.lineTo(cx + R * 0.45, cy - R * 0.8); g.stroke(); }
        else if (i === 2) { for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(cx, cy, R, R * 0.38, k * Math.PI / 3, 0, 6.283); g.stroke(); } }
        else if (i === 3) { g.arc(cx, cy, R, 0, 6.283); g.stroke(); g.beginPath(); g.moveTo(cx, cy - R * 1.2); g.lineTo(cx, cy + R * 1.2); g.stroke(); g.beginPath(); g.arc(cx, cy, R * 0.3, 0, 6.283); g.fill(); }
        else if (i === 4) { g.moveTo(cx, cy + R); g.bezierCurveTo(cx - R * 1.5, cy, cx - R * 0.3, cy - R * 1.3, cx, cy - R * 0.2); g.bezierCurveTo(cx + R * 0.3, cy - R * 1.3, cx + R * 1.5, cy, cx, cy + R); g.stroke(); }
        else if (i === 5) { for (let k = 0; k < 5; k++) { const a = -1.571 + k * 2.513; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); g.stroke(); }
        else if (i === 6) { for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.5236; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); g.stroke(); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.5236; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); } g.closePath(); g.fill(); }
        else { g.rect(cx - R * 0.8, cy - R, R * 1.6, R * 2); g.stroke(); g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(cx - R * 0.5, cy - R * 0.6 + k * R * 0.4); g.lineTo(cx + R * 0.5, cy - R * 0.6 + k * R * 0.4); } g.stroke(); }
        g.shadowBlur = 0; g.font = F('NS Tech', 30 * S, 800); text(cp.name, cx, y + sw - 34 * S, cp.color, { align: 'center', glow: 10 * S });
      });
      const r = rect(x, y, sw, sw, { glow: hex(cp.color) }); this.sq.push(r); this.corp[cp.id] = { logo: r, color: hex(cp.color) };
    });
    // wordmarks: 512x128, right half of the logo row (2 rows x 3 cols) + next row
    CORPS.forEach((cp, i) => {
      const x = 2048 * S + (i % 4) * hw, y = sy + Math.floor(i / 4) * hh;
      clip(x, y, hw, hh, () => {
        g.fillStyle = '#06070a'; g.fillRect(x, y, hw, hh);
        const px = fit(cp.name, 'NS Tech', hh * 0.5, hw * 0.86, 800); text(cp.name, x + hw / 2, y + hh * 0.42, cp.color, { align: 'center', glow: px * 0.4 }); text(cp.name, x + hw / 2, y + hh * 0.42, '#fff', { align: 'center' });
        g.font = F('NS Dohyeon', hh * 0.17); text(cp.ko, x + hw / 2, y + hh * 0.84, cp.alt, { align: 'center' });
      });
      const r = rect(x, y, hw, hh, { glow: hex(cp.color) }); this.corp[cp.id].word = r; this.wide.push(r);
    });
    // ------------------------------------------------------------------ LED tickers (4096x128)
    const ty = 3712 * S;
    TICKERS.forEach((t, i) => {
      const y = ty + i * hh; const col = ['#ffb347', '#5ff2e6', '#ff4fae'][i % 3];
      clip(0, y, size, hh, () => {
        g.fillStyle = '#050506'; g.fillRect(0, y, size, hh);
        g.font = F('NS Dohyeon', hh * 0.62); let tx = 0; const tw = g.measureText(t).width;
        g.shadowColor = col; g.shadowBlur = 10 * S; while (tx < size) { text(t, tx, y + hh * 0.54, col); tx += tw; } g.shadowBlur = 0;
        g.fillStyle = '#050506'; for (let yy = 0; yy < hh; yy += 6 * S) g.fillRect(0, y + yy, size, 2 * S); for (let xx = 0; xx < size; xx += 6 * S) g.fillRect(xx, y, 2 * S, hh);
      });
      this.tick.push(rect(0, y, size, hh, { glow: hex(col) }));
    });
    // ------------------------------------------------------------------ stencils + notice plates
    this._stencils(g, S, rect, rng, F, fit, text);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
    this.texture = tex; this.canvas = cv;
  }

  // stencil decals + notice plates live in a dedicated 4096x? band: we shrink the ad block to 3 rows (12 ads) worth of
  // guaranteed space by drawing stencils over the 4th row's last two ad slots.
  _stencils(g, S, rect, rng, F, fit, text) {
    const size = this.size; const x0 = 2048 * S, y0 = (1408 + 512 * 3) * S, W = 2048 * S, H = 512 * S;
    g.fillStyle = '#000'; g.fillRect(x0, y0, W, H);
    this.bb.length = 14; // the last two ad slots are reused
    const t = 256 * S;
    DECALS.forEach((d, i) => {
      const x = x0 + (i % 8) * t, y = y0 + Math.floor(i / 8) * t; if (i >= 8) return;
      g.save(); g.beginPath(); g.rect(x, y, t, t); g.clip();
      const yel = i % 3 === 0; const col = yel ? '#e8b414' : '#e9ebe6';
      const px = fit(d, /[0-9A-Z]/.test(d) ? 'NS Tech' : 'NS Black', t * 0.62, t * 0.8, 800); text(d, x + t / 2, y + t * 0.52, col, { align: 'center' });
      g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 160; k++) { g.globalAlpha = rng.f(0.3, 1); g.beginPath(); g.arc(x + rng.f(0, t), y + rng.f(0, t), rng.f(1, 7) * S, 0, 6.283); g.fill(); }
      g.restore();
      this.decal[d] = rect(x, y, t, t, { glow: [1, 1, 1] });
    });
    // notice plates 512x128 (two rows of four) under the decals
    NOTICES.forEach((n, i) => {
      const w = 512 * S, h = 128 * S; const x = x0 + (i % 4) * w, y = y0 + t + Math.floor(i / 4) * h;
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      const warn = /주의|위험|고압|금지/.test(n);
      g.fillStyle = warn ? '#e8b414' : '#e9ebe6'; g.fillRect(x, y, w, h);
      if (warn) { g.fillStyle = '#16161a'; for (let k = -2; k < 24; k++) { g.beginPath(); g.moveTo(x + k * 44 * S, y + h); g.lineTo(x + k * 44 * S + 22 * S, y + h); g.lineTo(x + k * 44 * S + 22 * S + h * 0.16, y + h * 0.84); g.lineTo(x + k * 44 * S + h * 0.16, y + h * 0.84); g.fill(); } }
      fit(n, 'NS Black', h * 0.46, w * 0.86); text(n, x + w / 2, y + h * (warn ? 0.44 : 0.52), '#16161a', { align: 'center' });
      g.strokeStyle = '#16161a'; g.lineWidth = 5 * S; g.strokeRect(x + 6 * S, y + 6 * S, w - 12 * S, h - 12 * S);
      g.restore();
      this.notice.push(rect(x, y, w, h, { glow: [1, 0.9, 0.6] }));
    });
  }

  pickH(rng) { return rng.pick(this.h); }
  pickV(rng) { return rng.pick(this.v); }
  pickBB(rng) { return rng.pick(this.bb); }
  pickLogo(rng) { return rng.pick(this.sq); }
}
function hex(c) { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
