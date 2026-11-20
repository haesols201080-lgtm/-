// The UNDERGROWTH mark. The Korean wordmark stands on a ground line; a fern frond grows up beside it and arches
// back over its last syllables; SV-7 stands at the foot of the stem with a field scale bar reading 35 cm.
// Drawing units are centimetres at the robot's scale (100 units = 1em of the wordmark), so the frond is a frond
// and the robot is the robot: the premise of the game in one picture. The frond is generated, not hand-drawn.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
const f1 = (v) => +v.toFixed(1);

// cubic bezier point / tangent
const bz = (p, t) => { const u = 1 - t; return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]; };
const bzd = (p, t) => { const u = 1 - t; return [3 * u * u * (p[1][0] - p[0][0]) + 6 * u * t * (p[2][0] - p[1][0]) + 3 * t * t * (p[3][0] - p[2][0]), 3 * u * u * (p[1][1] - p[0][1]) + 6 * u * t * (p[2][1] - p[1][1]) + 3 * t * t * (p[3][1] - p[2][1])]; };

function frond(bx) {
  // the stipe rises from the ground beside the last syllable and the blade arches back over the word
  const P = [[bx, 2], [bx + 10, -126], [bx - 52, -218], [bx - 196, -170]];
  let leaves = '';
  const N = 31;
  for (let i = 0; i < N; i++) for (const side of [-1, 1]) {
    // pinnae alternate along the rachis, longest a third of the way up, tapering to a fine tip
    const u = (i + (side === 1 ? 0.5 : 0)) / N, t = 0.14 + 0.84 * u;
    if (t > 0.985) continue;
    const [x, y] = bz(P, t), [dx, dy] = bzd(P, t), th = Math.atan2(dy, dx);
    const len = 3 + 43 * Math.pow(Math.sin(Math.PI * (0.16 + 0.84 * u)), 0.8) * (1.1 - 0.72 * u);
    const a = th + side * (1.28 - 0.55 * u);
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len + len * 0.3;            // pinnae hang a little
    const nx = -(ey - y) / len, ny = (ex - x) / len, w = len * 0.115, bend = len * 0.12 * side;
    // a slim curved blade: base -> tip along one edge, back along the other
    const c1x = x + (ex - x) * 0.35 + nx * (w + bend), c1y = y + (ey - y) * 0.35 + ny * (w + bend);
    const c2x = x + (ex - x) * 0.75 + nx * (w * 0.6 + bend), c2y = y + (ey - y) * 0.75 + ny * (w * 0.6 + bend);
    const c3x = x + (ex - x) * 0.75 - nx * (w * 0.5 - bend), c3y = y + (ey - y) * 0.75 - ny * (w * 0.5 - bend);
    const c4x = x + (ex - x) * 0.35 - nx * (w * 0.8 - bend), c4y = y + (ey - y) * 0.35 - ny * (w * 0.8 - bend);
    leaves += `M${f1(x)} ${f1(y)}C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(ex)} ${f1(ey)}C${f1(c3x)} ${f1(c3y)} ${f1(c4x)} ${f1(c4y)} ${f1(x)} ${f1(y)}Z`;
  }
  const stem = `M${P[0][0]} ${P[0][1]}C${P[1][0]} ${P[1][1]} ${P[2][0]} ${P[2][1]} ${P[3][0]} ${P[3][1]}`;
  // a young frond still curled up (a fiddlehead) beside the stem: growth, literally
  const cx = bx + 19, cy = -36;
  let crozier = `M${bx + 13} 3C${bx + 13} -12 ${bx + 24} -20 ${bx + 25} -30`;
  for (let k = 0; k <= 40; k++) {
    const s2 = k / 40, ang = -0.1 - s2 * Math.PI * 2.6, r = 7.2 * (1 - 0.82 * s2);
    crozier += `L${f1(cx + Math.cos(ang) * r - 0.6)} ${f1(cy - Math.sin(ang) * r + 0.4)}`;
  }
  return { leaves, stem, crozier };
}

function robot(g, rx) {
  const ink = 'var(--ink, #ECEAE4)';
  el('rect', { x: rx - 9, y: -3, width: 7, height: 3, rx: 1, fill: ink }, g);           // feet
  el('rect', { x: rx + 2, y: -3, width: 7, height: 3, rx: 1, fill: ink }, g);
  el('rect', { x: rx - 6.5, y: -9, width: 3.5, height: 6.5, fill: ink }, g);           // legs
  el('rect', { x: rx + 3, y: -9, width: 3.5, height: 6.5, fill: ink }, g);
  el('rect', { x: rx - 8, y: -20.5, width: 16, height: 12, rx: 2.5, fill: ink }, g);   // body
  el('rect', { x: rx - 11, y: -33, width: 22, height: 13.5, rx: 3.5, fill: ink }, g);   // head
  el('rect', { x: rx - 9.5, y: -30.5, width: 14, height: 8.5, rx: 2.2, fill: 'var(--visor, #E5A93F)' }, g); // visor, looking at the frond
  el('line', { x1: rx + 4, y1: -33, x2: rx + 6.5, y2: -40, stroke: ink, 'stroke-width': 1.3 }, g);          // antenna
  el('circle', { cx: rx + 6.8, cy: -41, r: 1.7, fill: ink }, g);
  // field scale bar: ground to the top of the head
  const sx = rx + 19;
  el('path', { d: `M${sx - 3} 0H${sx + 3}M${sx} 0V-33M${sx - 3} -33H${sx + 3}`, stroke: 'var(--ink-2, rgba(236,234,228,.66))', 'stroke-width': 1.1, fill: 'none' }, g);
  const t = el('text', { x: sx + 6, y: -13, 'font-size': 10.5, fill: 'var(--ink-2, rgba(236,234,228,.66))', 'font-family': "'Courier Prime', 'Courier New', monospace", 'font-weight': 500 }, g);
  t.textContent = '35';
  const u = el('text', { x: sx + 6, y: -3, 'font-size': 8.5, fill: 'var(--ink-3, rgba(236,234,228,.4))', 'font-family': "'Courier Prime', 'Courier New', monospace" }, g);
  u.textContent = 'cm';
  return sx + 22;
}

export function mountLogo(host, { sub = 'UNDERGROWTH' } = {}) {
  host.textContent = '';
  const svg = el('svg', { xmlns: NS, role: 'img', 'aria-label': `언더그로스 ${sub}` }, host);
  const word = el('text', { x: 0, y: 0, 'font-size': 100, 'font-weight': 600, 'letter-spacing': -2, fill: 'var(--ink, #ECEAE4)',
    'font-family': "'Hahmlet', 'Noto Serif KR', 'Nanum Myeongjo', serif" }, svg);
  word.textContent = '언더그로스';
  const layout = () => {
    for (const n of [...svg.childNodes]) if (n !== word) n.remove();
    let tw = 500; try { tw = word.getComputedTextLength() || tw; } catch { /* not laid out yet */ }
    const bx = tw + 10, rx = bx + 48;
    const { leaves, stem, crozier } = frond(bx);
    const g = el('g', {}, svg);
    el('path', { d: stem, stroke: 'var(--ink, #ECEAE4)', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, g);
    el('path', { d: crozier, stroke: 'var(--ink, #ECEAE4)', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    el('path', { d: leaves, fill: 'var(--ink, #ECEAE4)', opacity: 0.94 }, g);
    const end = robot(g, rx);
    el('line', { x1: -4, y1: 6, x2: end, y2: 6, stroke: 'var(--ink-3, rgba(236,234,228,.4))', 'stroke-width': 1.2 }, svg);   // the ground
    const s = el('text', { x: 0, y: 34, 'font-size': 13.5, 'letter-spacing': 5.2, fill: 'var(--ink-2, rgba(236,234,228,.66))',
      'font-family': "'Courier Prime', 'Courier New', monospace", 'font-weight': 500 }, svg);
    s.textContent = sub;
    const W = end + 8, top = -224, H = 264;
    svg.setAttribute('viewBox', `-6 ${top} ${W + 6} ${H}`);
    svg.style.width = `${(W + 6) / 100}em`; svg.style.height = `${H / 100}em`;
  };
  layout();
  // re-measure once the display face has arrived (the fallback face has other widths)
  document.fonts?.ready.then(layout);
  document.fonts?.addEventListener?.('loadingdone', layout);
}
