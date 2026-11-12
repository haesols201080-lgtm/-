// Procedural signage atlas: neon shop signs, vertical blades, corp logos and billboards, drawn with Canvas2D.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

export const CORPS = [
  { id: 'helion', name: 'HELION', ko: '헬리온', tag: '빛은 권리다', color: '#ffc45a', alt: '#ff7a1a' },
  { id: 'vanta', name: 'VANTA', ko: '반타 중공업', tag: '강철은 약속을 지킨다', color: '#ff5a3c', alt: '#ffb199' },
  { id: 'aether', name: 'AETHER', ko: '에테르 물류', tag: '하늘을 나르는 길', color: '#58d6ff', alt: '#b7f3ff' },
  { id: 'meridian', name: 'MERIDIAN', ko: '메리디안 은행', tag: '당신의 럭스, 우리의 정오', color: '#7df9d0', alt: '#e8fff8' },
  { id: 'verdant', name: 'VERDANT', ko: '버던트 바이오', tag: '내일의 식탁을 기른다', color: '#9dff6a', alt: '#ff4fd8' },
  { id: 'lumina', name: 'LUMINA', ko: '루미나', tag: '밤은 끝나지 않는다', color: '#ff3fa4', alt: '#a56bff' },
  { id: 'hive', name: 'HIVE', ko: '하이브 주거공사', tag: '모두에게 한 칸의 빛', color: '#ffd9a0', alt: '#ff9966' },
  { id: 'archive', name: 'ARCHIVE', ko: '아카이브', tag: '기억은 가장 오래된 화폐', color: '#c9b8ff', alt: '#7fd4ff' },
];

const H_WORDS = ['라면', '국수', '수리점', '전당포', '약국', '여관', '포차', '야시장', '만두', '환전', '의체 수리', '부품', '고물상', '충전소', '산소 바', '기억 매입', '꿈 대여', '24시', '럭스 대출', '합성육', '찻집', '문신', '노래방', '클론 보험',
  'OPEN', 'NOODLE', 'HOTEL', 'BAR', 'SYNTH', 'O2', 'LUX', 'CYBER', 'ORBIT', 'NOVA', 'ZEN', 'DREAM', 'PAWN', 'ARCADE', 'CLINIC', 'TEA'];
const V_WORDS = ['라면', '국수', '약국', '여관', '술', '차', '빛', '환전', '의체', '부품', '만두', '산소', '기억', '꿈', '충전', '수리', '전당', '합성육', '찻집', '야시장', '노래방', '문신', '대출', '보험'];
const NEONS = ['#ff3fa4', '#5ff2e6', '#ffb347', '#ff5a3c', '#7d7bff', '#9dff6a', '#ffe66b', '#58d6ff', '#ff4fd8', '#ffffff'];

export class SignAtlas {
  constructor(size = 2048, seed = 20491) {
    this.size = size; const S = size / 2048;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
    const rng = new RNG(seed);
    this.h = []; this.v = []; this.sq = []; this.bb = []; this.corp = {}; this.wide = [];
    const font = (px, w = 800) => `${w} ${px}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR","Malgun Gothic","Segoe UI",sans-serif`;
    const rect = (x, y, w, h) => ({ u0: x / size, v0: 1 - (y + h) / size, u1: (x + w) / size, v1: 1 - y / size, aspect: w / h });
    const glowText = (txt, x, y, px, col, o = {}) => {
      g.save(); g.font = font(px, o.weight || 800); g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
      if (o.maxW) { const m = g.measureText(txt).width; if (m > o.maxW) { g.font = font(px * o.maxW / m, o.weight || 800); } }
      g.shadowColor = col; g.shadowBlur = px * 0.35; g.fillStyle = col;
      if (o.stroke) { g.lineWidth = px * 0.07; g.strokeStyle = col; g.strokeText(txt, x, y); g.shadowBlur = px * 0.2; g.strokeText(txt, x, y); g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.lineWidth = px * 0.025; g.strokeStyle = '#fff'; g.strokeText(txt, x, y); }
      else { g.fillText(txt, x, y); g.shadowBlur = px * 0.12; g.fillStyle = o.core || '#fff'; g.globalAlpha = o.coreA ?? 0.55; g.fillText(txt, x, y); }
      g.restore();
    };
    const frame = (x, y, w, h, col, lw, r = 0) => { g.save(); g.strokeStyle = col; g.lineWidth = lw; g.shadowColor = col; g.shadowBlur = lw * 3; g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke(); g.restore(); };

    // ---- A: horizontal shop signs 512x128, 4 x 6 ----
    const hw = 512 * S, hh = 128 * S;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
      const x = c * hw, y = r * hh, i = r * 4 + c;
      const word = H_WORDS[i % H_WORDS.length], col = rng.pick(NEONS), col2 = rng.pick(NEONS);
      g.save(); g.beginPath(); g.rect(x, y, hw, hh); g.clip();
      const style = rng.i(0, 4), pad = 10 * S;
      if (style === 0) { // neon tube text + frame
        frame(x + pad, y + pad, hw - 2 * pad, hh - 2 * pad, col2, 4 * S, 14 * S);
        glowText(word, x + hw / 2, y + hh / 2 + 2 * S, 74 * S, col, { stroke: /[A-Z0-9]/.test(word), maxW: hw - 60 * S });
      } else if (style === 1) { // light box
        const gr = g.createLinearGradient(x, y, x, y + hh); gr.addColorStop(0, col); gr.addColorStop(1, col2);
        g.fillStyle = gr; g.globalAlpha = 0.85; g.fillRect(x + pad, y + pad, hw - 2 * pad, hh - 2 * pad); g.globalAlpha = 1;
        g.font = font(70 * S, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#060608';
        let tw = g.measureText(word).width; if (tw > hw - 70 * S) g.font = font(70 * S * (hw - 70 * S) / tw, 900);
        g.fillText(word, x + hw / 2, y + hh / 2 + 3 * S);
      } else if (style === 2) { // split: icon + text
        g.save(); g.shadowColor = col2; g.shadowBlur = 18 * S; g.strokeStyle = col2; g.lineWidth = 6 * S; g.beginPath(); g.arc(x + 70 * S, y + hh / 2, 36 * S, 0, 6.283); g.stroke();
        g.beginPath(); g.moveTo(x + 50 * S, y + hh / 2); g.lineTo(x + 90 * S, y + hh / 2); g.moveTo(x + 70 * S, y + hh / 2 - 20 * S); g.lineTo(x + 70 * S, y + hh / 2 + 20 * S); g.stroke(); g.restore();
        glowText(word, x + hw / 2 + 50 * S, y + hh / 2 + 2 * S, 66 * S, col, { maxW: hw - 170 * S });
      } else if (style === 3) { // LED matrix
        glowText(word, x + hw / 2, y + hh / 2 + 2 * S, 78 * S, col, { maxW: hw - 50 * S, coreA: 0.2 });
        g.fillStyle = '#000'; for (let yy = 0; yy < hh; yy += 5 * S) g.fillRect(x, y + yy, hw, 2 * S); for (let xx = 0; xx < hw; xx += 5 * S) g.fillRect(x + xx, y, 2 * S, hh);
      } else { // double line with small caption
        glowText(word, x + hw / 2, y + hh * 0.42, 62 * S, col, { maxW: hw - 50 * S });
        glowText(rng.pick(['KAIROS-9', 'SINCE 2171', '24H · LUX OK', 'LEVEL 0', '下層 · 침전층', 'NO CREDIT']), x + hw / 2, y + hh * 0.82, 20 * S, col2, { weight: 600, coreA: 0.3 });
        g.fillStyle = col2; g.globalAlpha = 0.7; g.fillRect(x + 40 * S, y + hh * 0.68, hw - 80 * S, 2 * S); g.globalAlpha = 1;
      }
      g.restore();
      this.h.push(rect(x + 2, y + 2, hw - 4, hh - 4));
    }
    // ---- B: vertical blade signs 128x512, 16 ----
    const vy = 768 * S, vw = 128 * S, vh = 512 * S;
    for (let c = 0; c < 16; c++) {
      const x = c * vw, y = vy; const word = V_WORDS[c % V_WORDS.length], col = rng.pick(NEONS), col2 = rng.pick(NEONS);
      g.save(); g.beginPath(); g.rect(x, y, vw, vh); g.clip();
      const style = rng.i(0, 2);
      if (style === 1) { g.fillStyle = col; g.globalAlpha = 0.8; g.fillRect(x + 12 * S, y + 12 * S, vw - 24 * S, vh - 24 * S); g.globalAlpha = 1; }
      else frame(x + 10 * S, y + 10 * S, vw - 20 * S, vh - 20 * S, col2, 4 * S, 10 * S);
      const chars = [...word]; const n = chars.length; const ch = Math.min(110 * S, (vh - 60 * S) / n);
      for (let i = 0; i < n; i++) {
        const cy = y + vh / 2 + (i - (n - 1) / 2) * ch;
        if (style === 1) { g.font = font(ch * 0.82, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#050507'; g.fillText(chars[i], x + vw / 2, cy); }
        else glowText(chars[i], x + vw / 2, cy, ch * 0.82, col);
      }
      g.restore();
      this.v.push(rect(x + 2, y + 2, vw - 4, vh - 4));
    }
    // ---- C: square logos 256x256, 8 (corp sigils) ----
    const sy = 1280 * S, sw = 256 * S;
    CORPS.forEach((cp, i) => {
      const x = i * sw, y = sy, cx = x + sw / 2, cy = y + sw / 2 - 14 * S;
      g.save(); g.beginPath(); g.rect(x, y, sw, sw); g.clip();
      g.shadowColor = cp.color; g.shadowBlur = 22 * S; g.strokeStyle = cp.color; g.fillStyle = cp.color; g.lineWidth = 9 * S; g.lineJoin = 'round';
      const R = 70 * S;
      g.beginPath();
      if (i === 0) { g.arc(cx, cy, R * 0.55, 0, 6.283); g.fill(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.moveTo(cx + Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75); g.lineTo(cx + Math.cos(a) * R * 1.15, cy + Math.sin(a) * R * 1.15); } g.stroke(); }
      else if (i === 1) { g.moveTo(cx - R, cy - R * 0.8); g.lineTo(cx, cy + R); g.lineTo(cx + R, cy - R * 0.8); g.stroke(); g.beginPath(); g.moveTo(cx - R * 0.45, cy - R * 0.8); g.lineTo(cx, cy + R * 0.1); g.lineTo(cx + R * 0.45, cy - R * 0.8); g.stroke(); }
      else if (i === 2) { for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(cx, cy, R, R * 0.38, k * Math.PI / 3, 0, 6.283); g.stroke(); } }
      else if (i === 3) { g.arc(cx, cy, R, 0, 6.283); g.stroke(); g.beginPath(); g.moveTo(cx, cy - R * 1.2); g.lineTo(cx, cy + R * 1.2); g.stroke(); g.beginPath(); g.arc(cx, cy, R * 0.3, 0, 6.283); g.fill(); }
      else if (i === 4) { g.moveTo(cx, cy + R); g.bezierCurveTo(cx - R * 1.5, cy, cx - R * 0.3, cy - R * 1.3, cx, cy - R * 0.2); g.bezierCurveTo(cx + R * 0.3, cy - R * 1.3, cx + R * 1.5, cy, cx, cy + R); g.stroke(); }
      else if (i === 5) { for (let k = 0; k < 5; k++) { const a = -1.571 + k * 2.513; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); g.stroke(); }
      else if (i === 6) { for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.5236; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); g.stroke(); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + 0.5236; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); } g.closePath(); g.fill(); }
      else { g.rect(cx - R * 0.8, cy - R, R * 1.6, R * 2); g.stroke(); g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(cx - R * 0.5, cy - R * 0.6 + k * R * 0.4); g.lineTo(cx + R * 0.5, cy - R * 0.6 + k * R * 0.4); } g.stroke(); }
      g.restore();
      glowText(cp.name, cx, y + sw - 34 * S, 34 * S, cp.color, { weight: 700, maxW: sw - 30 * S });
      const r = rect(x + 2, y + 2, sw - 4, sw - 4); this.sq.push(r); this.corp[cp.id] = { logo: r };
    });
    // ---- D: billboards 512x256, 8 ----
    const by = 1536 * S, bw = 512 * S, bh = 256 * S;
    const slogans = [['더 높이, 더 밝게', 'ASCEND'], ['고도는 계급이다', 'ALTITUDE LICENSE'], ['LUXADE', '한 모금의 햇빛'], ['당신의 기억을 삽니다', 'ARCHIVE'], ['구름 위 분양 개시', 'ZENITH RESIDENCE'], ['오늘도 비', '우산은 HIVE 마트'], ['SKY WHALE', '루미나 홀로쇼'], ['빛 한 줄기의 가격', '1 LUX = 1 LUX']];
    for (let i = 0; i < 8; i++) {
      const x = (i % 4) * bw, y = by + Math.floor(i / 4) * bh; const cp = CORPS[i % CORPS.length];
      g.save(); g.beginPath(); g.rect(x, y, bw, bh); g.clip();
      const gr = g.createLinearGradient(x, y, x + bw, y + bh); gr.addColorStop(0, cp.color); gr.addColorStop(0.55, '#08080c'); gr.addColorStop(1, cp.alt);
      g.globalAlpha = 0.5; g.fillStyle = gr; g.fillRect(x, y, bw, bh); g.globalAlpha = 1;
      // abstract motif
      g.strokeStyle = cp.alt; g.lineWidth = 2 * S; g.globalAlpha = 0.6;
      const mot = i % 4;
      for (let k = 0; k < 14; k++) {
        g.beginPath();
        if (mot === 0) g.arc(x + bw * 0.78, y + bh * 0.5, (k + 1) * 14 * S, 0, 6.283);
        else if (mot === 1) { g.moveTo(x + bw * 0.55 + k * 18 * S, y); g.lineTo(x + bw * 0.4 + k * 18 * S, y + bh); }
        else if (mot === 2) { g.moveTo(x, y + bh - k * 14 * S); g.bezierCurveTo(x + bw * 0.3, y + bh - k * 26 * S, x + bw * 0.6, y + bh - k * 4 * S, x + bw, y + bh - k * 20 * S); }
        else g.rect(x + bw * 0.62 + k * 5 * S, y + bh * 0.12 + k * 5 * S, bw * 0.3 - k * 10 * S, bh * 0.76 - k * 10 * S);
        g.stroke();
      }
      g.globalAlpha = 1;
      glowText(slogans[i][0], x + bw * 0.06, y + bh * 0.4, 50 * S, '#ffffff', { align: 'left', maxW: bw * 0.86, coreA: 0.9 });
      glowText(slogans[i][1], x + bw * 0.06, y + bh * 0.68, 24 * S, cp.color, { align: 'left', weight: 600, maxW: bw * 0.8 });
      glowText(cp.name, x + bw * 0.94, y + bh * 0.88, 20 * S, cp.alt, { align: 'right', weight: 700 });
      g.restore();
      this.bb.push(rect(x + 2, y + 2, bw - 4, bh - 4));
    }
    // ---- wide corp name strips reuse horizontal region rows via extra draw: rows 0..? (already used) → pack corp wordmarks into C row 2 (y 1280+256.. is billboards) ----
    // corp wordmarks: overwrite last 8 horizontal slots? keep separate: draw into region below billboards is full, so reuse h signs 16..23 as wordmarks
    for (let i = 0; i < 8; i++) {
      const idx = 16 + i, c = idx % 4, r = Math.floor(idx / 4), x = c * hw, y = r * hh, cp = CORPS[i];
      g.fillStyle = '#000'; g.fillRect(x, y, hw, hh);
      g.save(); g.beginPath(); g.rect(x, y, hw, hh); g.clip();
      glowText(cp.name, x + hw / 2, y + hh * 0.44, 76 * S, cp.color, { weight: 300, maxW: hw - 40 * S, coreA: 0.8 });
      glowText(cp.ko, x + hw / 2, y + hh * 0.84, 22 * S, cp.alt, { weight: 600, coreA: 0.4 });
      g.restore();
      this.corp[cp.id].word = this.h[idx]; this.wide.push(this.h[idx]);
    }
    this.h.length = 16; // generic shop signs only

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4;
    this.texture = tex; this.canvas = cv;
  }
  pickH(rng) { return rng.pick(this.h); }
  pickV(rng) { return rng.pick(this.v); }
  pickBB(rng) { return rng.pick(this.bb); }
  pickLogo(rng) { return rng.pick(this.sq); }
}
