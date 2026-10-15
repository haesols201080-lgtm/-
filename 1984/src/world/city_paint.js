// Canvas-painted textures for the streets: the poster atlas (with torn,
// sun-bleached and pasted-over variants), litter and ground decals, weeds of
// the bomb sites, washing on the lines, lamp glows and flags. Painted once.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, rng } from './city_util.js';

const SANS = '"Oswald","Arial Narrow","Helvetica Neue",Arial,sans-serif';
const SERIF = '"Libre Caslon Text","Times New Roman",Georgia,serif';

function grain(ctx, w, h, amt, r) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * 255 * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function stain(ctx, x, y, rad, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

// A ragged line between two points, for paper tears.
function ragged(ctx, pts, r, amp = 10, step = 9) {
  const [x0, y0] = pts[0];
  ctx.moveTo(x0, y0);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let k = 1; k <= n; k++) {
      const t = k / n, j = k === n ? 0 : (r() - 0.5) * amp;
      ctx.lineTo(ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j);
    }
  }
}

// ---------------------------------------------------------------- posters

// Cells of the poster atlas (4 x 2). Every poster quad is 1 x 1.4.
export const POSTER = { bb: 0, ingsoc: 1, enemy: 2, notice: 3, bb_torn: 4, ingsoc_torn: 5, enemy_torn: 6, bb_faded: 7 };
const PW = 512, PH = 717;

function eastasian(ctx, w, h) {
  // the new enemy of Hate Week: a looming soldier, all helmet and bayonet
  const g = ctx.createRadialGradient(w / 2, h * 0.42, 30, w / 2, h * 0.42, h * 0.7);
  g.addColorStop(0, '#d6c08a'); g.addColorStop(1, '#5c4a2c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(w / 2, h * 0.47); ctx.scale(w / 512, h / 717);
  ctx.fillStyle = '#17140f';
  ctx.beginPath(); ctx.ellipse(0, -205, 92, 50, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-120, -210, 240, 16);
  ctx.beginPath(); ctx.ellipse(0, -160, 58, 66, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-150, -90); ctx.lineTo(150, -90); ctx.lineTo(178, 250); ctx.lineTo(-178, 250); ctx.fill();
  ctx.save(); ctx.rotate(-0.55);
  ctx.fillRect(-40, -150, 300, 22); ctx.fillRect(250, -146, 120, 8);
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#7e1810'; ctx.fillRect(0, h - 150, w, 150);
  ctx.fillStyle = '#efe6cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 46px ${SANS}`; ctx.fillText('EASTASIA', w / 2, h - 104);
  ctx.font = `bold 58px ${SANS}`; ctx.fillText('THE ENEMY', w / 2, h - 48);
}

function notice(ctx, w, h, r) {
  ctx.fillStyle = '#d9d2bb'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7e1810'; ctx.fillRect(18, 18, w - 36, 64);
  ctx.fillStyle = '#efe6cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 34px ${SANS}`; ctx.fillText('MINISTRY OF PLENTY', w / 2, 52);
  ctx.fillStyle = '#1a1814';
  ctx.font = `bold 50px ${SERIF}`;
  ['CHOCOLATE', 'RATION', 'RAISED TO', '20 GRAMMES'].forEach((t, i) => ctx.fillText(t, w / 2, 150 + i * 62));
  ctx.font = `22px ${SERIF}`;
  ctx.fillText('A GREAT VICTORY FOR THE NINTH', w / 2, 420);
  ctx.fillText('THREE-YEAR PLAN', w / 2, 448);
  ctx.fillStyle = 'rgba(30,28,24,0.55)';
  for (let i = 0; i < 9; i++) ctx.fillRect(56, 492 + i * 20, (w - 112) * (0.6 + r() * 0.4), 7);
  ctx.fillStyle = '#7e1810'; ctx.fillRect(18, h - 34, w - 36, 12);
}

function drawPosterCell(ctx, kind, srcs, r) {
  const w = PW, h = PH;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const base = kind.replace(/_(torn|faded)$/, '');
  if (base === 'notice') notice(ctx, w, h, r);
  else if (base === 'enemy' && srcs.enemy === 'eastasia') eastasian(ctx, w, h);
  else if (srcs[base]) ctx.drawImage(srcs[base], 0, 0, w, h);
  if (kind.endsWith('_faded')) {
    // a summer of sun and rain: bleached, the red gone pink
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(150,140,120,0.55)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 7; i++) {
      const x = r() * w;
      const g = ctx.createLinearGradient(x, 0, x + 20, h);
      g.addColorStop(0, 'rgba(60,50,35,0.0)'); g.addColorStop(0.5, 'rgba(60,50,35,0.18)'); g.addColorStop(1, 'rgba(60,50,35,0.3)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 14 + r() * 26, h);
    }
  }
  // paste wrinkles, glue runs and soot along the bottom
  for (let i = 0; i < 6; i++) stain(ctx, r() * w, r() * h, 40 + r() * 120, 'rgba(70,58,38,0.16)');
  const sg = ctx.createLinearGradient(0, h * 0.75, 0, h);
  sg.addColorStop(0, 'rgba(20,18,14,0)'); sg.addColorStop(1, 'rgba(20,18,14,0.35)');
  ctx.fillStyle = sg; ctx.fillRect(0, h * 0.75, w, h * 0.25);
  if (kind.endsWith('_torn')) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    if (base === 'bb') {
      // ripped from the lower left, a strip hanging
      ragged(ctx, [[0, h * 0.42], [w * 0.35, h * 0.58], [w * 0.52, h * 0.9], [w * 0.62, h], [0, h]], r, 26);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ragged(ctx, [[w, 0], [w * 0.8, 0], [w * 0.88, h * 0.1], [w, h * 0.16]], r, 12); ctx.closePath(); ctx.fill();
    } else if (base === 'ingsoc') {
      ragged(ctx, [[w, 0], [w * 0.55, 0], [w * 0.7, h * 0.12], [w * 0.62, h * 0.24], [w * 0.86, h * 0.36], [w, h * 0.5]], r, 20);
      ctx.closePath(); ctx.fill();
    } else {
      ragged(ctx, [[0, 0], [w, 0], [w, h * 0.3], [w * 0.7, h * 0.45], [w * 0.5, h * 0.38], [w * 0.2, h * 0.62], [0, h * 0.55]], r, 30);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ragged(ctx, [[w * 0.6, h], [w * 0.8, h * 0.8], [w, h * 0.86], [w, h]], r, 16); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-atop';
    // the white of the torn paper fibres along the edges
    ctx.globalCompositeOperation = 'source-over';
  }
  grain(ctx, w, h, 0.07, r);
  ctx.restore();
}

export function posterAtlas(G) {
  const art = G.art;
  const src = (f) => { try { const t = f(); return t && t.image; } catch (e) { return null; } };
  const srcs = { bb: src(art.posterBB), ingsoc: src(art.posterIngsoc), enemy: src(art.posterEurasian), enemyKind: 'eurasia' };
  const [c, ctx] = makeCanvas(PW * 4, PH * 2);
  const cell = makeCanvas(PW, PH);
  const r = rng(1984);
  const paint = (kind) => {
    const i = POSTER[kind];
    drawPosterCell(cell[1], kind, srcs, r);
    const x = (i % 4) * PW, y = Math.floor(i / 4) * PH;
    ctx.clearRect(x, y, PW, PH);
    ctx.drawImage(cell[0], x, y);
  };
  for (const k of Object.keys(POSTER)) paint(k);
  const tex = canvasTexture(c);
  tex.generateMipmaps = true;
  const rect = (kind) => {
    const i = POSTER[kind];
    // a texel inset keeps neighbouring cells from bleeding in at mip levels
    const u = (i % 4) / 4, v = 1 - (Math.floor(i / 4) + 1) / 2;
    return [u + 0.002, v + 0.002, 0.25 - 0.004, 0.5 - 0.004];
  };
  const setEnemy = (kind) => {
    srcs.enemy = kind === 'eastasia' ? 'eastasia' : src(art.posterEurasian);
    paint('enemy'); paint('enemy_torn');
    tex.needsUpdate = true;
  };
  return { tex, rect, setEnemy };
}

// ---------------------------------------------------------------- ground clutter

// 4 x 4 cells of 256 px. Cut-out decals (alpha-tested) and soft stains.
export const DECAL = {
  newspaper: 0, crumpled: 1, scrap: 2, packet: 3, butts: 4, leaves: 5, cabbage: 6, glass: 7,
  manhole: 8, grate: 9, oil: 10, damp: 11, soot: 12, tar: 13, rag: 14, coupon: 15,
};

export function decalAtlas() {
  const S = 256;
  const [c, ctx] = makeCanvas(S * 4, S * 4);
  const r = rng(77);
  const at = (i, f) => { ctx.save(); ctx.translate((i % 4) * S, Math.floor(i / 4) * S); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); f(); ctx.restore(); };
  const paper = (col) => { ctx.fillStyle = col; };
  at(DECAL.newspaper, () => {
    ctx.translate(128, 128); ctx.rotate(0.2);
    paper('#c9c2ad'); ctx.beginPath(); ragged(ctx, [[-90, -70], [95, -78], [100, 72], [-96, 80]], r, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2824'; ctx.font = `bold 20px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('THE TIMES', 0, -48);
    ctx.fillStyle = 'rgba(40,38,34,0.6)';
    for (let col = 0; col < 3; col++) for (let k = 0; k < 9; k++) ctx.fillRect(-82 + col * 58, -30 + k * 11, 50 * (0.6 + r() * 0.4), 4);
    ctx.strokeStyle = 'rgba(80,70,50,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(4, 78); ctx.stroke();
  });
  at(DECAL.crumpled, () => {
    for (let i = 0; i < 3; i++) {
      const x = 60 + r() * 140, y = 60 + r() * 140, rad = 18 + r() * 18;
      const g = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, rad);
      g.addColorStop(0, '#e2dccb'); g.addColorStop(1, '#8c8676');
      ctx.fillStyle = g; ctx.beginPath(); ragged(ctx, [[x - rad, y], [x, y - rad], [x + rad, y], [x, y + rad], [x - rad, y]], r, 9, 6); ctx.fill();
    }
  });
  at(DECAL.scrap, () => {
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(40 + r() * 176, 40 + r() * 176); ctx.rotate(r() * 6);
      paper(['#cfc8b2', '#b8b09a', '#d9d2bc'][i % 3]); ctx.beginPath(); ragged(ctx, [[-30, -18], [32, -22], [28, 20], [-26, 16]], r, 7, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(40,38,34,0.5)'; for (let k = 0; k < 3; k++) ctx.fillRect(-22, -10 + k * 8, 40, 3);
      ctx.restore();
    }
  });
  at(DECAL.packet, () => {
    ctx.translate(128, 128); ctx.rotate(-0.4);
    ctx.fillStyle = '#7a2a1c'; ctx.fillRect(-46, -30, 92, 60);
    ctx.fillStyle = '#d8cfb4'; ctx.fillRect(-46, -8, 92, 16);
    ctx.fillStyle = '#2a201a'; ctx.font = `bold 11px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('VICTORY CIGARETTES', 0, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-46, 18, 92, 12);
  });
  at(DECAL.butts, () => {
    for (let i = 0; i < 14; i++) {
      ctx.save(); ctx.translate(30 + r() * 196, 30 + r() * 196); ctx.rotate(r() * 6);
      ctx.fillStyle = '#d8d2c2'; ctx.fillRect(-9, -2.5, 13, 5);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(4, -2.5, 5, 5);
      ctx.fillStyle = '#222'; ctx.fillRect(-10, -2.5, 2, 5);
      ctx.restore();
    }
  });
  at(DECAL.leaves, () => {
    for (let i = 0; i < 22; i++) {
      ctx.save(); ctx.translate(20 + r() * 216, 20 + r() * 216); ctx.rotate(r() * 6);
      ctx.fillStyle = ['#5a3e1e', '#6e4a22', '#4a3a20', '#7a5a2a'][i % 4];
      ctx.beginPath(); ctx.ellipse(0, 0, 14 + r() * 8, 6 + r() * 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.restore();
    }
  });
  at(DECAL.cabbage, () => {
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(50 + r() * 156, 50 + r() * 156); ctx.rotate(r() * 6);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
      g.addColorStop(0, '#b8c08a'); g.addColorStop(1, '#5a6a3a');
      ctx.fillStyle = g; ctx.beginPath(); ragged(ctx, [[-34, 0], [-10, -30], [26, -24], [34, 6], [8, 30], [-26, 22], [-34, 0]], r, 8, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(230,235,200,0.5)'; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k * 1.3) * 28, Math.sin(k * 1.3) * 24); ctx.stroke(); }
      ctx.restore();
    }
  });
  at(DECAL.glass, () => {
    for (let i = 0; i < 18; i++) {
      const x = 40 + r() * 176, y = 40 + r() * 176, s = 4 + r() * 12;
      ctx.fillStyle = `rgba(${170 + r() * 40},${190 + r() * 30},${180 + r() * 30},0.9)`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s * 0.3); ctx.lineTo(x + s * 0.4, y + s); ctx.closePath(); ctx.fill();
    }
  });
  at(DECAL.manhole, () => {
    ctx.translate(128, 128);
    ctx.fillStyle = '#26241f'; ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3730'; ctx.beginPath(); ctx.arc(0, 0, 108, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#211f1a'; ctx.lineWidth = 6;
    for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * 22, -100 + Math.abs(k) * 6); ctx.lineTo(k * 22, 100 - Math.abs(k) * 6); ctx.stroke(); }
    ctx.fillStyle = '#4c483f'; ctx.font = `bold 18px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('L.C.C.', 0, 6);
    stain(ctx, 30, 40, 80, 'rgba(90,60,30,0.35)');
  });
  at(DECAL.grate, () => {
    ctx.fillStyle = '#1e1c18'; ctx.fillRect(48, 70, 160, 116);
    ctx.fillStyle = '#3e3a32'; ctx.fillRect(56, 78, 144, 100);
    ctx.fillStyle = '#0c0b09'; for (let k = 0; k < 8; k++) ctx.fillRect(64 + k * 17, 84, 9, 88);
    stain(ctx, 128, 128, 100, 'rgba(30,26,20,0.4)');
  });
  at(DECAL.oil, () => {
    for (let i = 0; i < 4; i++) stain(ctx, 70 + r() * 116, 70 + r() * 116, 50 + r() * 60, 'rgba(10,9,8,0.55)');
    stain(ctx, 128, 128, 30, 'rgba(40,30,50,0.3)');
  });
  at(DECAL.damp, () => {
    for (let i = 0; i < 6; i++) stain(ctx, 50 + r() * 156, 50 + r() * 156, 40 + r() * 70, 'rgba(14,13,11,0.32)');
  });
  at(DECAL.soot, () => {
    for (let i = 0; i < 5; i++) stain(ctx, 60 + r() * 136, 60 + r() * 136, 50 + r() * 60, 'rgba(6,6,6,0.5)');
  });
  at(DECAL.tar, () => {
    ctx.fillStyle = 'rgba(12,12,12,0.85)';
    ctx.beginPath(); ragged(ctx, [[30, 40], [210, 30], [228, 200], [40, 220], [30, 40]], r, 22, 10); ctx.fill();
  });
  at(DECAL.rag, () => {
    ctx.translate(128, 128); ctx.rotate(0.7);
    ctx.fillStyle = '#4a4636'; ctx.beginPath(); ragged(ctx, [[-70, -30], [60, -48], [80, 30], [-50, 52], [-70, -30]], r, 18, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-60 + k * 20, -40); ctx.lineTo(-50 + k * 22, 44); ctx.stroke(); }
  });
  at(DECAL.coupon, () => {
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.translate(40 + r() * 176, 40 + r() * 176); ctx.rotate(r() * 6);
      ctx.fillStyle = '#c6b88e'; ctx.fillRect(-18, -11, 36, 22);
      ctx.fillStyle = '#7e1810'; ctx.fillRect(-18, -11, 36, 5);
      ctx.restore();
    }
  });
  grain(ctx, S * 4, S * 4, 0.06, r);
  const tex = canvasTexture(c);
  const rect = (i) => [(i % 4) / 4 + 0.002, 1 - (Math.floor(i / 4) + 1) / 4 + 0.002, 0.246, 0.246];
  return { tex, rect };
}

// ---------------------------------------------------------------- weeds

// 4 x 2 cells of 256 x 512: rosebay willow-herb in flower, young willow-herb,
// last year's dead stalks, nettles and dock, rank grass, buddleia, thistle, dandelion.
export const PLANT = { herb: 0, herb_young: 1, stalks: 2, nettle: 3, grass: 4, buddleia: 5, thistle: 6, dandelion: 7 };

export function plantAtlas() {
  const W = 256, Hh = 512;
  const [c, ctx] = makeCanvas(W * 4, Hh * 2);
  const r = rng(31);
  const at = (i, f) => { ctx.save(); ctx.translate((i % 4) * W, Math.floor(i / 4) * Hh); ctx.beginPath(); ctx.rect(0, 0, W, Hh); ctx.clip(); f(); ctx.restore(); };
  const stem = (x, top, bend, col, wid) => {
    ctx.strokeStyle = col; ctx.lineWidth = wid; ctx.beginPath(); ctx.moveTo(x, Hh);
    ctx.quadraticCurveTo(x + bend * 0.5, (Hh + top) / 2, x + bend, top); ctx.stroke();
    return [x + bend, top];
  };
  const leaf = (x, y, a, len, wid, col) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -wid, len, 0); ctx.quadraticCurveTo(len * 0.5, wid, 0, 0); ctx.fill(); ctx.restore();
  };
  const herb = (flower, young) => {
    const n = young ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const x = 30 + r() * 196, top = young ? 250 + r() * 120 : 40 + r() * 120, bend = (r() - 0.5) * 50;
      const [tx, ty] = stem(x, top, bend, '#4a3a2a', 3.5);
      for (let y = Hh - 30; y > ty + 40; y -= 16 + r() * 8) {
        const t = (y - ty) / (Hh - ty), px = x + bend * (1 - t);
        const g = ['#3e5a2a', '#4a6a32', '#56703a'][Math.floor(r() * 3)];
        leaf(px, y, -0.5 - r() * 0.6, 36 + r() * 20, 6, g);
        leaf(px, y + 6, Math.PI + 0.5 + r() * 0.6, 36 + r() * 20, 6, g);
      }
      if (flower) {
        for (let y = ty; y < ty + 110; y += 6) {
          const k = (y - ty) / 110;
          ctx.fillStyle = k < 0.3 ? '#7a2a4a' : ['#b04a7a', '#c25a8a', '#a8406e'][Math.floor(r() * 3)];
          ctx.beginPath(); ctx.arc(tx + (r() - 0.5) * 14 * (0.4 + k), y, 4 + k * 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  };
  at(PLANT.herb, () => herb(true, false));
  at(PLANT.herb_young, () => herb(false, true));
  at(PLANT.stalks, () => {
    for (let i = 0; i < 9; i++) {
      const x = 20 + r() * 216, top = 30 + r() * 200;
      stem(x, top, (r() - 0.5) * 80, ['#6a5a44', '#7a6a50', '#5a4a38'][i % 3], 3);
      ctx.strokeStyle = 'rgba(200,190,170,0.6)'; ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x, top + k * 12); ctx.lineTo(x + (r() - 0.5) * 30, top + k * 12 - 14); ctx.stroke(); }
    }
    for (let i = 0; i < 6; i++) leaf(40 + r() * 176, Hh - 20 - r() * 60, -r() * 3, 50, 10, '#4a6a32');
  });
  at(PLANT.nettle, () => {
    for (let i = 0; i < 7; i++) {
      const x = 30 + r() * 196, top = 240 + r() * 140;
      const [tx, ty] = stem(x, top, (r() - 0.5) * 30, '#3a4a26', 3);
      for (let y = Hh - 20; y > ty; y -= 26) {
        for (const s of [-1, 1]) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(s * 0.9);
          ctx.fillStyle = '#2e4a22'; ctx.beginPath(); ctx.moveTo(0, 0);
          for (let k = 0; k <= 8; k++) ctx.lineTo(k * 5, -10 + (k % 2) * 4 - Math.sin(k / 8 * Math.PI) * 6);
          for (let k = 8; k >= 0; k--) ctx.lineTo(k * 5, 6 + Math.sin(k / 8 * Math.PI) * 4);
          ctx.fill(); ctx.restore();
        }
      }
      leaf(tx, ty, -Math.PI / 2, 24, 7, '#3a5a2a');
    }
    for (let i = 0; i < 3; i++) leaf(60 + r() * 140, Hh - 10, -Math.PI / 2 - (r() - 0.5) * 1.2, 160, 34, '#4a5a2a');
  });
  at(PLANT.grass, () => {
    for (let i = 0; i < 70; i++) {
      const x = 10 + r() * 236, h = 120 + r() * 260;
      ctx.strokeStyle = ['#5a6a3a', '#6a7a44', '#7a7a50', '#8a805a'][i % 4]; ctx.lineWidth = 2 + r() * 2;
      ctx.beginPath(); ctx.moveTo(x, Hh); ctx.quadraticCurveTo(x + (r() - 0.5) * 40, Hh - h * 0.6, x + (r() - 0.5) * 90, Hh - h); ctx.stroke();
    }
  });
  at(PLANT.buddleia, () => {
    for (let i = 0; i < 6; i++) {
      const x = 40 + r() * 176, top = 60 + r() * 100, bend = (r() - 0.5) * 140;
      const [tx, ty] = stem(x, top, bend, '#5a4a38', 4);
      for (let k = 0; k < 9; k++) leaf(x + bend * (k / 9), Hh - (Hh - ty) * (k / 9), (r() - 0.5) * 3, 50, 9, '#506a48');
      for (let k = 0; k < 40; k++) {
        ctx.fillStyle = ['#6a4a8a', '#7a5a9a', '#5a3a7a'][k % 3];
        ctx.beginPath(); ctx.arc(tx + (r() - 0.5) * 18, ty + k * 2.2, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  at(PLANT.thistle, () => {
    for (let i = 0; i < 4; i++) {
      const x = 50 + r() * 156, top = 180 + r() * 150;
      const [tx, ty] = stem(x, top, (r() - 0.5) * 40, '#4a5a3a', 5);
      for (let y = Hh - 30; y > ty + 30; y -= 30) for (const s of [-1, 1]) leaf(x, y, s > 0 ? -0.4 : Math.PI + 0.4, 46, 12, '#5a6a4a');
      ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.arc(tx, ty + 10, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a5a8a'; ctx.fillRect(tx - 10, ty - 8, 20, 12);
    }
  });
  at(PLANT.dandelion, () => {
    for (let i = 0; i < 5; i++) {
      const x = 40 + r() * 176;
      for (let k = 0; k < 7; k++) leaf(x, Hh - 4, -Math.PI / 2 + (k - 3) * 0.45, 70 + r() * 30, 12, '#4a6a30');
      if (r() < 0.7) {
        const [tx, ty] = stem(x + 4, Hh - 120 - r() * 60, (r() - 0.5) * 20, '#5a6a3a', 2.5);
        ctx.fillStyle = '#c8a828'; ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  const tex = canvasTexture(c);
  const rect = (i) => [(i % 4) / 4 + 0.002, 1 - (Math.floor(i / 4) + 1) / 2 + 0.002, 0.246, 0.496];
  return { tex, rect };
}

// ---------------------------------------------------------------- washing

// 4 x 2 cells of 128 x 192, hung from the top edge.
export function washingAtlas() {
  const W = 128, Hh = 192;
  const [c, ctx] = makeCanvas(W * 4, Hh * 2);
  const r = rng(12);
  const at = (i, f) => { ctx.save(); ctx.translate((i % 4) * W, Math.floor(i / 4) * Hh); f(); ctx.restore(); };
  const cloth = (col) => {
    ctx.fillStyle = col;
  };
  // shirt
  at(0, () => { cloth('#b8b4a6'); ctx.beginPath(); ctx.moveTo(30, 4); ctx.lineTo(98, 4); ctx.lineTo(124, 40); ctx.lineTo(104, 54); ctx.lineTo(96, 40); ctx.lineTo(96, 150); ctx.lineTo(32, 150); ctx.lineTo(32, 40); ctx.lineTo(24, 54); ctx.lineTo(4, 40); ctx.closePath(); ctx.fill(); });
  // long johns
  at(1, () => { cloth('#a89a84'); ctx.beginPath(); ctx.moveTo(26, 4); ctx.lineTo(102, 4); ctx.lineTo(100, 186); ctx.lineTo(70, 186); ctx.lineTo(64, 70); ctx.lineTo(58, 186); ctx.lineTo(28, 186); ctx.closePath(); ctx.fill(); });
  // sheet
  at(2, () => { cloth('#cfccc2'); ctx.fillRect(2, 4, 124, 184); });
  // nappies
  at(3, () => { cloth('#d8d4c8'); ctx.fillRect(8, 4, 50, 56); ctx.fillRect(70, 4, 50, 56); });
  // overalls (blue, a Party man lodging with proles is unlikely; these are grey)
  at(4, () => { cloth('#4a4c4e'); ctx.beginPath(); ctx.moveTo(30, 4); ctx.lineTo(98, 4); ctx.lineTo(102, 186); ctx.lineTo(70, 186); ctx.lineTo(64, 96); ctx.lineTo(58, 186); ctx.lineTo(26, 186); ctx.closePath(); ctx.fill(); });
  // apron
  at(5, () => { cloth('#8a8676'); ctx.beginPath(); ctx.moveTo(24, 4); ctx.lineTo(104, 4); ctx.lineTo(112, 150); ctx.lineTo(16, 150); ctx.closePath(); ctx.fill(); });
  // dress
  at(6, () => { cloth('#5a4a44'); ctx.beginPath(); ctx.moveTo(40, 4); ctx.lineTo(88, 4); ctx.lineTo(96, 40); ctx.lineTo(120, 180); ctx.lineTo(8, 180); ctx.lineTo(32, 40); ctx.closePath(); ctx.fill(); });
  // towel and socks
  at(7, () => { cloth('#9a9284'); ctx.fillRect(10, 4, 64, 120); cloth('#3a3632'); ctx.fillRect(84, 4, 16, 70); ctx.fillRect(104, 4, 16, 64); });
  // creases, damp patches, pegs
  for (let i = 0; i < 8; i++) {
    at(i, () => {
      ctx.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 10; k++) {
        const x = r() * W;
        ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; ctx.fillRect(x, 0, 2 + r() * 5, Hh);
      }
      const g = ctx.createLinearGradient(0, 0, 0, Hh);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#6a5a44'; ctx.fillRect(20, 0, 5, 10); ctx.fillRect(W - 26, 0, 5, 10);
    });
  }
  grain(ctx, W * 4, Hh * 2, 0.08, r);
  const tex = canvasTexture(c);
  const rect = (i) => [(i % 4) / 4 + 0.003, 1 - (Math.floor(i / 4) + 1) / 2 + 0.003, 0.244, 0.494];
  return { tex, rect, aspect: Hh / W };
}

// ---------------------------------------------------------------- glows and flags

export function glowTexture(inner = 'rgba(255,214,150,1)', size = 128, falloff = 2.2) {
  const [c, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const m = /rgba?\((\d+),(\d+),(\d+)/.exec(inner.replace(/\s/g, ''));
  const [cr, cg, cb] = m ? [+m[1], +m[2], +m[3]] : [255, 214, 150];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - d);
      const k = (y * size + x) * 4;
      img.data[k] = cr; img.data[k + 1] = cg; img.data[k + 2] = cb;
      img.data[k + 3] = Math.round(255 * Math.pow(a, falloff));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}

export function flagTexture(G) {
  const [c, ctx] = makeCanvas(512, 768);
  const r = rng(5);
  ctx.fillStyle = '#7a1a12'; ctx.fillRect(0, 0, 512, 768);
  ctx.fillStyle = '#1a1614'; ctx.fillRect(0, 0, 512, 40); ctx.fillRect(0, 728, 512, 40);
  if (G.art && G.art.drawBB) {
    ctx.fillStyle = '#1e2224'; ctx.fillRect(56, 90, 400, 470);
    ctx.save(); ctx.beginPath(); ctx.rect(56, 90, 400, 470); ctx.clip();
    G.art.drawBB(ctx, 256, 330, 130, { coat: '#1a1d1f' });
    ctx.restore();
  }
  ctx.fillStyle = '#e8dcc0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 72px ${SANS}`; ctx.fillText('INGSOC', 256, 640);
  for (let i = 0; i < 6; i++) stain(ctx, r() * 512, r() * 768, 80 + r() * 140, 'rgba(0,0,0,0.12)');
  grain(ctx, 512, 768, 0.06, r);
  return canvasTexture(c);
}

export { THREE };
