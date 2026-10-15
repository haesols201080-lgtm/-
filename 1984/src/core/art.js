// Everything printed or broadcast in Oceania, painted on canvases: the Big
// Brother poster, the slogans on the Ministry of Truth, the telescreen
// programmes, shop signs and the St Clement Danes engraving.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function texFrom(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let seed = 1;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

function paperGrain(ctx, w, h, amt = 0.08, dark = '#000') {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 255 * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function stains(ctx, w, h, n, color) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * w * 0.25;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const SANS = '"Oswald","Arial Narrow","Helvetica Neue",Arial,sans-serif';
const SERIF = '"Libre Caslon Text","Times New Roman",Georgia,serif';

// ---------------------------------------------------------------- faces

// Big Brother: a man of about forty-five, heavy black moustache, ruggedly
// handsome. Drawn in a unit space: face about 1.6 wide, 2.2 tall.
export function drawBB(ctx, cx, cy, s, pal = {}) {
  const P = {
    skin: pal.skin || '#d4ad86', shade: pal.shade || '#9c7452', deep: pal.deep || '#5e4130',
    hair: pal.hair || '#141110', coat: pal.coat || '#24282a', light: pal.light || '#f0d6b2',
  };
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // shoulders and tunic
  ctx.fillStyle = P.coat;
  ctx.beginPath();
  ctx.moveTo(-2.6, 3.4); ctx.bezierCurveTo(-2.4, 1.9, -1.4, 1.55, -0.55, 1.35);
  ctx.lineTo(0.55, 1.35); ctx.bezierCurveTo(1.4, 1.55, 2.4, 1.9, 2.6, 3.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.moveTo(-2.4, 3.4); ctx.bezierCurveTo(-2.2, 2.1, -1.3, 1.7, -0.6, 1.5); ctx.lineTo(-0.45, 3.4); ctx.fill();
  // collar
  ctx.fillStyle = '#1a1d1f';
  ctx.beginPath(); ctx.moveTo(-0.62, 1.25); ctx.lineTo(0, 2.0); ctx.lineTo(0.62, 1.25); ctx.lineTo(0.75, 1.55); ctx.lineTo(0, 2.25); ctx.lineTo(-0.75, 1.55); ctx.closePath(); ctx.fill();
  // neck
  ctx.fillStyle = P.shade;
  ctx.beginPath(); ctx.moveTo(-0.45, 0.8); ctx.lineTo(-0.5, 1.5); ctx.lineTo(0, 1.95); ctx.lineTo(0.5, 1.5); ctx.lineTo(0.45, 0.8); ctx.fill();
  // ears
  for (const sx of [-1, 1]) {
    ctx.fillStyle = sx < 0 ? P.skin : P.shade;
    ctx.beginPath(); ctx.ellipse(sx * 0.8, 0.05, 0.13, 0.28, sx * 0.15, 0, Math.PI * 2); ctx.fill();
  }
  // face silhouette: cranium plus a strong jaw
  const face = () => {
    ctx.beginPath();
    ctx.moveTo(0, -1.12);
    ctx.bezierCurveTo(0.6, -1.12, 0.84, -0.7, 0.82, -0.15);
    ctx.bezierCurveTo(0.8, 0.35, 0.72, 0.62, 0.55, 0.88);
    ctx.bezierCurveTo(0.38, 1.08, 0.18, 1.16, 0, 1.16);
    ctx.bezierCurveTo(-0.18, 1.16, -0.38, 1.08, -0.55, 0.88);
    ctx.bezierCurveTo(-0.72, 0.62, -0.8, 0.35, -0.82, -0.15);
    ctx.bezierCurveTo(-0.84, -0.7, -0.6, -1.12, 0, -1.12);
    ctx.closePath();
  };
  face();
  const g = ctx.createLinearGradient(-0.9, -0.6, 0.9, 0.6);
  g.addColorStop(0, P.light); g.addColorStop(0.45, P.skin); g.addColorStop(1, P.shade);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); face(); ctx.clip();
  // form shadow on the right of the face
  ctx.fillStyle = 'rgba(70,40,25,0.35)';
  ctx.beginPath(); ctx.moveTo(0.25, -1.2); ctx.bezierCurveTo(0.55, -0.4, 0.45, 0.4, 0.15, 1.2); ctx.lineTo(1, 1.2); ctx.lineTo(1, -1.2); ctx.fill();
  // jaw shadow under the cheekbones
  ctx.fillStyle = 'rgba(70,40,25,0.25)';
  ctx.beginPath(); ctx.ellipse(-0.5, 0.45, 0.18, 0.4, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.5, 0.45, 0.2, 0.42, -0.2, 0, Math.PI * 2); ctx.fill();
  // brow ridge shadow and eye sockets
  ctx.fillStyle = 'rgba(60,35,20,0.32)';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.34, -0.18, 0.25, 0.15, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // hair: black, combed back with a side parting
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.moveTo(-0.84, -0.12);
  ctx.bezierCurveTo(-0.95, -0.95, -0.55, -1.42, 0.05, -1.4);
  ctx.bezierCurveTo(0.65, -1.38, 0.98, -0.95, 0.85, -0.12);
  ctx.bezierCurveTo(0.78, -0.45, 0.72, -0.62, 0.6, -0.72);
  ctx.bezierCurveTo(0.3, -0.86, -0.1, -0.84, -0.32, -0.92);
  ctx.bezierCurveTo(-0.55, -0.78, -0.72, -0.55, -0.84, -0.12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.025;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(-0.3 + i * 0.12, -0.95); ctx.bezierCurveTo(-0.2 + i * 0.12, -1.2, 0.1 + i * 0.1, -1.3, 0.4 + i * 0.08, -1.25); ctx.stroke();
  }
  // eyebrows: heavy
  ctx.fillStyle = P.hair;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 0.1, -0.3); ctx.bezierCurveTo(sx * 0.25, -0.42, sx * 0.48, -0.44, sx * 0.62, -0.34);
    ctx.lineTo(sx * 0.6, -0.28); ctx.bezierCurveTo(sx * 0.45, -0.34, sx * 0.25, -0.33, sx * 0.12, -0.24); ctx.closePath(); ctx.fill();
  }
  // eyes: dark, looking straight out of the picture
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#e8dccb';
    ctx.beginPath(); ctx.moveTo(sx * 0.16, -0.15);
    ctx.bezierCurveTo(sx * 0.25, -0.24, sx * 0.44, -0.24, sx * 0.53, -0.14);
    ctx.bezierCurveTo(sx * 0.42, -0.08, sx * 0.26, -0.08, sx * 0.16, -0.15); ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.arc(sx * 0.335, -0.155, 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(sx * 0.335, -0.155, 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(sx * 0.335 - 0.025, -0.175, 0.012, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.deep; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(sx * 0.14, -0.15); ctx.bezierCurveTo(sx * 0.25, -0.26, sx * 0.44, -0.26, sx * 0.55, -0.14); ctx.stroke();
    ctx.lineWidth = 0.015;
    ctx.beginPath(); ctx.moveTo(sx * 0.2, -0.05); ctx.bezierCurveTo(sx * 0.3, -0.02, sx * 0.42, -0.03, sx * 0.5, -0.07); ctx.stroke();
  }
  // nose
  ctx.strokeStyle = P.deep; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(0.08, -0.12); ctx.bezierCurveTo(0.12, 0.05, 0.16, 0.2, 0.17, 0.3); ctx.stroke();
  ctx.fillStyle = 'rgba(70,40,25,0.35)';
  ctx.beginPath(); ctx.moveTo(0.06, -0.1); ctx.bezierCurveTo(0.14, 0.1, 0.2, 0.25, 0.18, 0.33); ctx.lineTo(0.05, 0.36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.deep;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.09, 0.37, 0.05, 0.022, sx * 0.3, 0, Math.PI * 2); ctx.fill(); }
  // nasolabial folds
  ctx.strokeStyle = 'rgba(80,45,28,0.6)'; ctx.lineWidth = 0.025;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 0.22, 0.3); ctx.bezierCurveTo(sx * 0.36, 0.45, sx * 0.42, 0.6, sx * 0.4, 0.75); ctx.stroke(); }
  // the heavy black moustache
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.moveTo(0, 0.42);
  ctx.bezierCurveTo(0.12, 0.38, 0.3, 0.39, 0.42, 0.47);
  ctx.bezierCurveTo(0.5, 0.56, 0.5, 0.68, 0.44, 0.72);
  ctx.bezierCurveTo(0.36, 0.64, 0.2, 0.6, 0, 0.61);
  ctx.bezierCurveTo(-0.2, 0.6, -0.36, 0.64, -0.44, 0.72);
  ctx.bezierCurveTo(-0.5, 0.68, -0.5, 0.56, -0.42, 0.47);
  ctx.bezierCurveTo(-0.3, 0.39, -0.12, 0.38, 0, 0.42);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.012;
  for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * 0.06, 0.44); ctx.lineTo(i * 0.075, 0.6); ctx.stroke(); }
  // lips: a calm, closed mouth
  ctx.strokeStyle = P.deep; ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.moveTo(-0.22, 0.68); ctx.bezierCurveTo(-0.1, 0.7, 0.1, 0.7, 0.22, 0.68); ctx.stroke();
  ctx.fillStyle = 'rgba(120,60,45,0.5)';
  ctx.beginPath(); ctx.moveTo(-0.17, 0.71); ctx.bezierCurveTo(-0.05, 0.79, 0.05, 0.79, 0.17, 0.71); ctx.closePath(); ctx.fill();
  // chin cleft
  ctx.strokeStyle = 'rgba(80,45,28,0.45)'; ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.moveTo(0, 0.95); ctx.lineTo(0, 1.05); ctx.stroke();
  ctx.restore();
}

// Emmanuel Goldstein: lean face, fuzzy aureole of white hair, small goatee,
// spectacles near the end of a long thin nose. Sheep-like.
export function drawGoldstein(ctx, cx, cy, s, sheep = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.lineCap = 'round';
  // aureole
  ctx.strokeStyle = '#e6e2d8';
  for (let i = 0; i < 260; i++) {
    const a = (i / 260) * Math.PI * 2 + Math.sin(i) * 0.1;
    if (Math.sin(a) > 0.55) continue;
    const r0 = 0.75, r1 = 1.05 + rnd() * 0.35;
    ctx.lineWidth = 0.02 + rnd() * 0.03;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0 * 0.9, Math.sin(a) * r0 - 0.25);
    ctx.quadraticCurveTo(Math.cos(a + 0.2) * r1, Math.sin(a + 0.2) * r1 - 0.25, Math.cos(a) * r1 * 1.05, Math.sin(a) * r1 - 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath(); ctx.moveTo(-2.2, 3.2); ctx.bezierCurveTo(-2, 1.9, -1, 1.5, -0.4, 1.35); ctx.lineTo(0.4, 1.35); ctx.bezierCurveTo(1, 1.5, 2, 1.9, 2.2, 3.2); ctx.fill();
  ctx.fillStyle = '#b89c84';
  ctx.beginPath(); ctx.moveTo(-0.32, 0.8); ctx.lineTo(-0.34, 1.5); ctx.lineTo(0.34, 1.5); ctx.lineTo(0.32, 0.8); ctx.fill();
  // long lean face
  const g = ctx.createLinearGradient(-0.7, 0, 0.7, 0);
  g.addColorStop(0, '#e2c8ae'); g.addColorStop(1, '#a8876c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -1.05);
  ctx.bezierCurveTo(0.55, -1.05, 0.7, -0.5, 0.66, 0.0);
  ctx.bezierCurveTo(0.62, 0.55, 0.38, 1.1, 0, 1.25);
  ctx.bezierCurveTo(-0.38, 1.1, -0.62, 0.55, -0.66, 0.0);
  ctx.bezierCurveTo(-0.7, -0.5, -0.55, -1.05, 0, -1.05);
  ctx.fill();
  // goatee
  ctx.fillStyle = '#ddd8cc';
  ctx.beginPath(); ctx.moveTo(-0.16, 0.95); ctx.quadraticCurveTo(0, 1.55, 0.16, 0.95); ctx.quadraticCurveTo(0, 1.05, -0.16, 0.95); ctx.fill();
  // eyes, mild and silly
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#efe6d8'; ctx.beginPath(); ctx.ellipse(sx * 0.25, -0.12, 0.12, 0.06, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2e22'; ctx.beginPath(); ctx.arc(sx * 0.25, -0.11, 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8d4cc'; ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(sx * 0.1, -0.3); ctx.quadraticCurveTo(sx * 0.25, -0.38 + sheep * 0.1, sx * 0.42, -0.28); ctx.stroke();
  }
  // long thin nose
  ctx.strokeStyle = '#6a4c38'; ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.moveTo(0.02, -0.1); ctx.bezierCurveTo(0.07, 0.15, 0.12, 0.45 + sheep * 0.2, 0.06, 0.58 + sheep * 0.2); ctx.stroke();
  // spectacles perched near the end of the nose
  ctx.strokeStyle = '#111'; ctx.lineWidth = 0.03;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 0.2, 0.18, 0.15, 0.1, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-0.05, 0.17); ctx.lineTo(0.05, 0.17); ctx.stroke();
  // mouth, bleating
  ctx.fillStyle = '#4a2a22';
  ctx.beginPath(); ctx.ellipse(0, 0.8, 0.13 + sheep * 0.05, 0.05 + 0.06 * Math.abs(Math.sin(performance.now() / 120)), 0, 0, Math.PI * 2); ctx.fill();
  if (sheep > 0.5) {
    // the face changes into that of a sheep
    ctx.globalAlpha = (sheep - 0.5) * 2;
    ctx.fillStyle = '#e8e4dc';
    ctx.beginPath(); ctx.ellipse(0, 0.1, 0.62, 1.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2420';
    ctx.beginPath(); ctx.ellipse(0, 0.55, 0.32, 0.5, 0, 0, Math.PI * 2); ctx.fill();
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.ellipse(sx * 0.75, -0.35, 0.35, 0.12, sx * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8b070'; ctx.beginPath(); ctx.ellipse(sx * 0.22, 0.05, 0.08, 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(sx * 0.22 - 0.06, 0.035, 0.12, 0.03);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function soldierSilhouette(ctx, cx, cy, s, color = '#111') {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = color;
  // helmet and body of an advancing infantryman
  ctx.beginPath(); ctx.ellipse(0, -1.55, 0.36, 0.25, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-0.42, -1.58, 0.84, 0.08);
  ctx.beginPath(); ctx.ellipse(0, -1.32, 0.24, 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-0.55, -1.0); ctx.lineTo(0.55, -1.0); ctx.lineTo(0.45, 0.2); ctx.lineTo(-0.45, 0.2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-0.45, 0.15); ctx.lineTo(-0.55, 1.6); ctx.lineTo(-0.25, 1.6); ctx.lineTo(-0.05, 0.4); ctx.lineTo(0.15, 1.6); ctx.lineTo(0.45, 1.6); ctx.lineTo(0.4, 0.15); ctx.fill();
  // sub-machine gun held forward
  ctx.save(); ctx.rotate(-0.25);
  ctx.fillRect(-0.9, -0.55, 1.6, 0.14); ctx.fillRect(0.6, -0.52, 0.5, 0.06); ctx.fillRect(-0.2, -0.45, 0.12, 0.35);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- posters

export function posterBB() {
  seed = 11;
  const [c, ctx] = canvas(720, 1008);
  ctx.fillStyle = '#d8ccb0'; ctx.fillRect(0, 0, 720, 1008);
  const bg = ctx.createLinearGradient(0, 0, 0, 800);
  bg.addColorStop(0, '#30373a'); bg.addColorStop(1, '#151a1c');
  ctx.fillStyle = bg; ctx.fillRect(24, 24, 672, 800);
  ctx.save(); ctx.beginPath(); ctx.rect(24, 24, 672, 800); ctx.clip();
  drawBB(ctx, 360, 400, 235);
  ctx.restore();
  // caption band
  ctx.fillStyle = '#8a1a12'; ctx.fillRect(24, 836, 672, 148);
  ctx.fillStyle = '#efe6cc';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 66px ${SANS}`;
  ctx.fillText('BIG BROTHER', 360, 880);
  ctx.font = `bold 46px ${SANS}`;
  ctx.fillText('IS WATCHING YOU', 360, 942);
  stains(ctx, 720, 1008, 10, 'rgba(90,70,40,0.18)');
  paperGrain(ctx, 720, 1008, 0.1);
  return texFrom(c);
}

export function posterIngsoc() {
  seed = 12;
  const [c, ctx] = canvas(512, 720);
  ctx.fillStyle = '#7e1810'; ctx.fillRect(0, 0, 512, 720);
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath(); ctx.arc(256, 300, 170, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7e1810';
  ctx.beginPath(); ctx.arc(256, 300, 140, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.font = `bold 120px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('IS', 256, 300);
  ctx.font = `bold 118px ${SANS}`;
  ctx.fillText('INGSOC', 256, 590);
  stains(ctx, 512, 720, 8, 'rgba(0,0,0,0.25)');
  paperGrain(ctx, 512, 720, 0.12);
  // torn corner
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.moveTo(512, 0); ctx.lineTo(380, 0); ctx.lineTo(420, 40); ctx.lineTo(400, 70); ctx.lineTo(470, 110); ctx.lineTo(512, 160); ctx.fill();
  return texFrom(c);
}

export function posterEurasian() {
  seed = 13;
  const [c, ctx] = canvas(512, 720);
  ctx.fillStyle = '#c8b894'; ctx.fillRect(0, 0, 512, 720);
  const g = ctx.createRadialGradient(256, 300, 40, 256, 300, 420);
  g.addColorStop(0, '#d8c290'); g.addColorStop(1, '#6e5a3a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 600);
  soldierSilhouette(ctx, 256, 330, 160, '#1c1a16');
  ctx.fillStyle = '#7e1810'; ctx.fillRect(0, 600, 512, 120);
  ctx.fillStyle = '#efe6cc'; ctx.font = `bold 56px ${SANS}`; ctx.textAlign = 'center';
  ctx.fillText('THE ENEMY', 256, 678);
  paperGrain(ctx, 512, 720, 0.12);
  return texFrom(c);
}

export function posterSpiral() {
  seed = 14;
  const [c, ctx] = canvas(2048, 128);
  ctx.fillStyle = '#d6cbb0'; ctx.fillRect(0, 0, 2048, 128);
  ctx.fillStyle = '#7e1810'; ctx.fillRect(0, 0, 2048, 14); ctx.fillRect(0, 114, 2048, 14);
  ctx.fillStyle = '#1c1a18'; ctx.font = `bold 74px ${SANS}`; ctx.textBaseline = 'middle';
  ctx.fillText('BIG BROTHER IS WATCHING YOU  ✶  WAR IS PEACE  ✶  ', 20, 66);
  paperGrain(ctx, 2048, 128, 0.12);
  return texFrom(c);
}

export function slogans() {
  seed = 15;
  const [c, ctx] = canvas(2048, 768);
  ctx.fillStyle = '#d9d8d2'; ctx.fillRect(0, 0, 2048, 768);
  ctx.fillStyle = '#2b2b2b';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = ['WAR IS PEACE', 'FREEDOM IS SLAVERY', 'IGNORANCE IS STRENGTH'];
  lines.forEach((t, i) => {
    let size = 150;
    ctx.font = `${size}px ${SERIF}`;
    while (ctx.measureText(t).width > 1900) { size -= 4; ctx.font = `${size}px ${SERIF}`; }
    ctx.fillText(t, 1024, 128 + i * 256);
  });
  stains(ctx, 2048, 768, 14, 'rgba(60,55,45,0.12)');
  paperGrain(ctx, 2048, 768, 0.05);
  return texFrom(c);
}

export function engraving() {
  seed = 16;
  const [c, ctx] = canvas(512, 384);
  ctx.fillStyle = '#e4d8bc'; ctx.fillRect(0, 0, 512, 384);
  ctx.strokeStyle = '#3a2c1c'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(256, 192, 220, 165, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(256, 192, 218, 163, 0, 0, Math.PI * 2); ctx.clip();
  // hatched sky
  for (let y = 30; y < 360; y += 4) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(480, y + 10); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // St Clement Danes: oblong body, tall stepped steeple
  ctx.fillStyle = '#e4d8bc';
  ctx.fillRect(150, 200, 240, 120); ctx.strokeRect(150, 200, 240, 120);
  ctx.beginPath(); ctx.moveTo(150, 200); ctx.lineTo(270, 160); ctx.lineTo(390, 200); ctx.closePath(); ctx.fill(); ctx.stroke();
  const tiers = [[230, 110, 60, 90], [237, 70, 46, 40], [244, 40, 32, 30]];
  for (const [x, y, w, h] of tiers) { ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
  ctx.beginPath(); ctx.moveTo(244, 40); ctx.lineTo(260, -10); ctx.lineTo(276, 40); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(175 + i * 38, 255, 10, Math.PI, 0); ctx.lineTo(185 + i * 38, 290); ctx.lineTo(165 + i * 38, 290); ctx.closePath(); ctx.stroke(); }
  for (let x = 152; x < 390; x += 3) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x, 320); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.fillStyle = '#3a2c1c'; ctx.font = `italic 16px ${SERIF}`; ctx.textAlign = 'center';
  ctx.fillText('St. Clement Danes', 256, 372);
  stains(ctx, 512, 384, 6, 'rgba(120,90,40,0.2)');
  paperGrain(ctx, 512, 384, 0.06);
  return texFrom(c);
}

export function sign(text, opts = {}) {
  seed = text.length * 7 + 3;
  const [c, ctx] = canvas(1024, 96);
  ctx.fillStyle = opts.bg || '#2a2018'; ctx.fillRect(0, 0, 1024, 96);
  ctx.fillStyle = opts.fg || '#c9b98a';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 64;
  ctx.font = `${opts.italic ? 'italic ' : ''}bold ${size}px ${opts.serif ? SERIF : SANS}`;
  while (ctx.measureText(text).width > 960) { size -= 3; ctx.font = `bold ${size}px ${opts.serif ? SERIF : SANS}`; }
  ctx.fillText(text, 512, 52);
  stains(ctx, 1024, 96, 6, 'rgba(0,0,0,0.35)');
  paperGrain(ctx, 1024, 96, 0.14);
  return texFrom(c);
}

// ---------------------------------------------------------------- telescreen

// One broadcast for all telescreens. Programmes change with the time of day
// and with the story (the Hate, the Physical Jerks, Hate Week).
class Telescreen {
  constructor() {
    [this.canvas, this.ctx] = canvas(512, 320);
    this.texture = texFrom(this.canvas);
    this.mode = 'figures';
    this.t = 0;
    this.acc = 0;
    this.caption = '';
    this.hate = 0;          // 0..1 progress through the Two Minutes Hate
    this.jerk = 0;          // instructor pose
    this.enemy = 'EURASIA';
  }

  set(mode, caption = '') { this.mode = mode; this.caption = caption; this.t = 0; }

  update(dt) {
    this.t += dt; this.acc += dt;
    if (this.acc < 1 / 12) return;
    this.acc = 0;
    const ctx = this.ctx, W = 512, H = 320;
    ctx.save();
    ctx.fillStyle = '#0d1412'; ctx.fillRect(0, 0, W, H);
    const m = this.mode;
    if (m === 'bb') this.drawBB();
    else if (m === 'figures') this.drawFigures();
    else if (m === 'music') this.drawMarch();
    else if (m === 'hate') this.drawHate();
    else if (m === 'jerks') this.drawJerks();
    else if (m === 'news') this.drawNews();
    else if (m === 'slogans') this.drawSlogans();
    else if (m === 'off') { ctx.fillStyle = '#050706'; ctx.fillRect(0, 0, W, H); }
    // monochrome phosphor tint, scanlines and flicker
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = m === 'hate' ? '#c8d4c8' : '#a8c4b8'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const v = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 320);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  drawBB() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, '#3a4440'); g.addColorStop(1, '#141a18');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 320);
    drawBB(ctx, 256, 150 + Math.sin(this.t * 0.4) * 2, 92 + this.t * 0.4, { coat: '#1e2422' });
    ctx.fillStyle = '#e8e8e0'; ctx.font = `bold 26px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText(this.caption || 'BIG BROTHER IS WATCHING YOU', 256, 302);
  }

  drawFigures() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a2420'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#d8e0d8'; ctx.font = `bold 22px ${SANS}`; ctx.textAlign = 'left';
    ctx.fillText('MINISTRY OF PLENTY', 24, 40);
    ctx.font = `18px ${SANS}`;
    const rows = ['PIG-IRON', 'BOOTS (PAIRS)', 'SAUCEPANS', 'TRACTORS', 'CHOCOLATE RATION', 'NINTH THREE-YEAR PLAN'];
    const base = Math.floor(this.t * 0.5);
    for (let i = 0; i < 5; i++) {
      const r = rows[(base + i) % rows.length];
      const y = 80 + i * 44;
      ctx.fillText(r, 24, y);
      const pct = 98 + ((base + i) * 37) % 60;
      ctx.fillText(`+${pct}%`, 400, y);
      ctx.fillRect(24, y + 10, Math.min(460, pct * 3), 6);
    }
    ctx.fillText(this.caption || 'OVERFULFILMENT', 24, 300);
  }

  drawMarch() {
    const ctx = this.ctx;
    ctx.fillStyle = '#2a332e'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#4a564e'; ctx.fillRect(0, 230, 512, 90);
    for (let row = 0; row < 3; row++) {
      for (let i = -1; i < 9; i++) {
        const x = ((i * 70 + this.t * 60 + row * 23) % 700) - 80;
        const s = 26 + row * 10;
        soldierSilhouette(ctx, x, 150 + row * 40 + Math.sin(this.t * 6 + i) * 2, s / 40 * 0.9 * 40 / 40 * (s / 40) * 1.0, '#0e1210');
      }
    }
    ctx.fillStyle = '#d8e0d8'; ctx.font = `bold 24px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText(this.caption || 'OCEANIA, \'TIS FOR THEE', 256, 40);
  }

  drawHate() {
    const ctx = this.ctx, p = this.hate;
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 512, 320);
    if (p < 0.82) {
      // marching columns behind Goldstein's head
      for (let row = 0; row < 4; row++) {
        for (let i = -1; i < 10; i++) {
          const x = ((i * 58 + this.t * 40 * (row + 1) * 0.5) % 640) - 60;
          soldierSilhouette(ctx, x, 120 + row * 55, 14 + row * 6, `rgba(10,10,10,${0.4 + row * 0.15})`);
        }
      }
      const sheep = p > 0.6 ? Math.min(1, (p - 0.6) / 0.12) : 0;
      if (p < 0.72) drawGoldstein(ctx, 256, 150, 80, sheep);
      else soldierSilhouette(ctx, 256, 170, 30 + (p - 0.72) * 900, '#060606');
    } else if (p < 0.94) {
      const g = ctx.createRadialGradient(256, 160, 20, 256, 160, 300);
      g.addColorStop(0, '#4a524c'); g.addColorStop(1, '#101412');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 320);
      drawBB(ctx, 256, 175, 128, { coat: '#1a1e1c' });
    } else {
      ctx.fillStyle = '#e0e4e0'; ctx.fillRect(0, 0, 512, 320);
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = `bold 40px ${SANS}`;
      ['WAR IS PEACE', 'FREEDOM IS SLAVERY', 'IGNORANCE IS STRENGTH'].forEach((s, i) => ctx.fillText(s, 256, 100 + i * 70));
    }
  }

  drawJerks() {
    // a youngish woman, scrawny but muscular, in tunic and gym-shoes
    const ctx = this.ctx;
    ctx.fillStyle = '#3a4440'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#56625a'; ctx.fillRect(0, 250, 512, 70);
    const ph = this.jerk;
    ctx.save(); ctx.translate(256, 0);
    ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 14; ctx.lineCap = 'round';
    const bend = Math.max(0, Math.sin(ph * Math.PI * 2)) * (this.jerkKind === 'toes' ? 1 : 0);
    const hip = [0, 175]; const shoulder = [Math.sin(bend * 1.3) * 60, 95 + bend * 70];
    ctx.beginPath(); ctx.moveTo(-18, 250); ctx.lineTo(hip[0] - 10, hip[1]); ctx.lineTo(hip[0] + 10, hip[1]); ctx.lineTo(18, 250); ctx.stroke();
    ctx.strokeStyle = '#d0d4cc'; ctx.lineWidth = 26;
    ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(shoulder[0], shoulder[1]); ctx.stroke();
    ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 11;
    const armA = this.jerkKind === 'toes' ? 1.6 + bend : (Math.sin(ph * Math.PI * 2) > 0 ? 0.0 : Math.PI / 2);
    for (const sx of [-1, 1]) {
      const ex = shoulder[0] + sx * Math.cos(armA - Math.PI / 2 * (this.jerkKind === 'toes' ? 0 : 1)) * 45;
      const ey = shoulder[1] + Math.sin(armA) * 45 * (this.jerkKind === 'toes' ? 1 : -0.2);
      const hx = shoulder[0] + sx * (this.jerkKind === 'toes' ? 6 : (Math.sin(ph * Math.PI * 2) > 0 ? 90 : 30));
      const hy = this.jerkKind === 'toes' ? 240 * bend + (1 - bend) * 40 : (Math.sin(ph * Math.PI * 2) > 0 ? shoulder[1] : shoulder[1] - 40);
      ctx.beginPath(); ctx.moveTo(shoulder[0] + sx * 14, shoulder[1]); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    }
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.arc(shoulder[0] + Math.sin(bend) * 20, shoulder[1] - 34 + bend * 20, 20, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f0f0e8'; ctx.font = `bold 26px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText(this.caption || 'THIRTY TO FORTY GROUP!', 256, 34);
  }

  drawNews() {
    const ctx = this.ctx;
    ctx.fillStyle = '#20282a'; ctx.fillRect(0, 0, 512, 320);
    // a map of Africa with arrows, as in the novel's last chapter
    ctx.fillStyle = '#5a6a62';
    ctx.beginPath(); ctx.moveTo(200, 60); ctx.lineTo(320, 60); ctx.lineTo(360, 110); ctx.lineTo(330, 190); ctx.lineTo(290, 270); ctx.lineTo(260, 280); ctx.lineTo(240, 190); ctx.lineTo(190, 140); ctx.lineTo(170, 90); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
    const k = (this.t * 0.3) % 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(420, 120 + i * 40); ctx.lineTo(420 - k * 120, 140 + i * 30); ctx.stroke();
    }
    ctx.fillStyle = '#e8e8e0'; ctx.font = `bold 22px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText(this.caption || 'NEWS FROM THE MALABAR FRONT', 256, 304);
  }

  drawSlogans() {
    const ctx = this.ctx;
    ctx.fillStyle = '#d8dcd6'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#121212'; ctx.textAlign = 'center'; ctx.font = `bold 38px ${SANS}`;
    const lines = this.caption ? this.caption.split('\n') : ['WAR IS PEACE', 'FREEDOM IS SLAVERY', 'IGNORANCE IS STRENGTH'];
    lines.forEach((s, i) => ctx.fillText(s, 256, 110 + i * 62 - (lines.length - 3) * 30));
  }
}

export const telescreen = new Telescreen();

// Portrait images for the dialogue box and the diary.
export function portrait(kind) {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#20262a'; ctx.fillRect(0, 0, 256, 256);
  if (kind === 'bb') drawBB(ctx, 128, 130, 60);
  else if (kind === 'goldstein') drawGoldstein(ctx, 128, 120, 60);
  return c.toDataURL();
}
