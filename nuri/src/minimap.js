// Minimap + full map, drawn as a field map in the notebook: pen contour lines from the terrain, blue ink for water,
// dashed paths and dotted animal tracks, small circles for trees, hachures on the outcrop and the glade bank. Only
// where the robot has been is drawn in (saved with the game); the rest of the page stays blank. The minimap is the
// same drawing cut round; it turns with the camera. Markers: the objective (circled in red, pinned to the rim when it
// is off the map), friends already found, the robot, and, once the light scanner is unlocked, nearby crystals.
import { WORLD, PATH, PATH2, PATH3, TRAILS, REGIONS, GLADE_RIDGE, OUTCROP } from './layout.js';

const PX = 4;                    // base map pixels per metre
const HALF = WORLD.size / 2;
const FOG = 48;                  // fog grid cells per side (2 m cells)

export class Minimap {
  constructor({ world, gameplay, player, orbit, quests, ui }) {
    Object.assign(this, { world, gameplay, player, orbit, quests, ui });
    this.cv = document.getElementById('minimap'); this.g = this.cv.getContext('2d');
    this.big = document.getElementById('bigmap-c'); this.bg = this.big.getContext('2d');
    this.base = this.bake();
    this.fog = new Uint8Array(FOG * FOG);           // 1 = explored
    this.fogCv = document.createElement('canvas'); this.fogCv.width = this.fogCv.height = FOG;
    this.fogG = this.fogCv.getContext('2d');
    this.t = 0; this.open = false;
    this.cv.addEventListener('click', () => this.show(true));
    this.cv.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); this.show(true); }, { passive: false });
    document.getElementById('bm-close').onclick = () => this.show(false);
    document.getElementById('bigmap').addEventListener('click', (e) => { if (e.target.id === 'bigmap') this.show(false); });
    this.inked = document.createElement('canvas'); this.inked.width = this.inked.height = this.base.width;
    this.paintFog();
  }

  // ---------------------------------------------------------------- base map
  bake() {
    const T = this.world.terrain, N = WORLD.size * PX;
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const img = g.createImageData(N, N), d = img.data;
    const H = new Float32Array((N + 1) * (N + 1)), Wt = new Uint8Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = -HALF + i / PX, z = -HALF + j / PX, k = j * (N + 1) + i; H[k] = T.heightAt(x, z); Wt[k] = T.isWater(x, z) ? 1 : 0; }
    const band = (h) => Math.floor((h + 2) / 0.32);
    const put = (o, r, g2, b, a) => { const A = a / 255, B = d[o + 3] / 255, out = A + B * (1 - A); if (out <= 0) return;
      d[o] = (r * A + d[o] * B * (1 - A)) / out; d[o + 1] = (g2 * A + d[o + 1] * B * (1 - A)) / out; d[o + 2] = (b * A + d[o + 2] * B * (1 - A)) / out; d[o + 3] = out * 255; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * (N + 1) + i, o = (j * N + i) * 4;
      if (Wt[k]) {
        // water: a pale blue wash with engraver's lines, a firm blue shore line
        put(o, 92, 132, 170, 70);
        if (j % 4 === 0) put(o, 60, 100, 145, 55);
        if (!Wt[k + 1] || !Wt[k + N + 1] || !Wt[k - 1] || !Wt[k - N - 1]) put(o, 40, 80, 125, 215);
        continue;
      }
      // contour lines in brown ink; every fifth one heavier
      const b0 = band(H[k]), b1 = band(H[k + 1]), b2 = band(H[k + N + 1]);
      if (b0 !== b1 || b0 !== b2) { const major = Math.max(b0, b1, b2) % 5 === 0; put(o, 92, 68, 46, major ? 150 : 72); }
    }
    g.putImageData(img, 0, 0);
    const P = (x, z) => [(x + HALF) * PX, (z + HALF) * PX];
    const line = (pts, w, col, dash) => { g.beginPath(); pts.forEach(([x, z], k) => { const [px, pz] = P(x, z); k ? g.lineTo(px, pz) : g.moveTo(px, pz); });
      g.setLineDash(dash || []); g.lineWidth = w * PX; g.strokeStyle = col; g.lineCap = g.lineJoin = 'round'; g.stroke(); g.setLineDash([]); };
    const INK = 'rgba(52,38,26,.88)';
    for (const p of [PATH, PATH2, PATH3]) { line(p, 0.95, 'rgba(236,226,200,.9)'); line(p, 0.28, INK, [7, 4]); }
    for (const p of TRAILS) line(p, 0.22, 'rgba(70,50,32,.7)', [1.5, 4]);
    // trees: small pen circles with a dot for the trunk
    for (const t of this.world.treeSpots) {
      const [px, pz] = P(t.x, t.z), r = (t.hero ? 1.5 : 1.0) * t.s * PX;
      g.strokeStyle = 'rgba(58,70,44,.62)'; g.lineWidth = 1.1; g.beginPath(); g.arc(px, pz, r, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(58,52,40,.7)'; g.beginPath(); g.arc(px, pz, 0.9, 0, Math.PI * 2); g.fill();
    }
    // rocks: hatched blobs
    for (const r of this.world.rocks) { if (r.r < 0.25) continue; const [px, pz] = P(r.x, r.z), rr = Math.max(2, r.r * PX);
      g.fillStyle = 'rgba(96,84,70,.35)'; g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.arc(px, pz, rr, 0, Math.PI * 2); g.fill(); g.stroke(); }
    for (const l of this.world.logs) { line([[l.x1, l.z1], [l.x2, l.z2]], l.r * 2, 'rgba(120,90,60,.35)'); line([[l.x1, l.z1], [l.x2, l.z2]], 0.12, INK); }
    // the outcrop and the glade bank: hachures (short strokes down the slope)
    { const [ox, oz] = P(OUTCROP.x, OUTCROP.z); g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.ellipse(ox, oz, 7 * PX, 5.6 * PX, 0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1; for (let a = 0; a < Math.PI * 2; a += 0.09) { const c1 = Math.cos(a), s1 = Math.sin(a); g.beginPath(); g.moveTo(ox + c1 * 7 * PX, oz + s1 * 5.6 * PX); g.lineTo(ox + c1 * 8.6 * PX, oz + s1 * 7 * PX); g.stroke(); } }
    for (let i = 0; i + 1 < GLADE_RIDGE.length; i++) {
      const [ax, az] = GLADE_RIDGE[i], [bx, bz] = GLADE_RIDGE[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (let t = 0; t < L; t += 0.7) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, [p1, q1] = P(x - nx * 0.6, z - nz * 0.6), [p2, q2] = P(x + nx * 0.6, z + nz * 0.6);
        g.strokeStyle = 'rgba(52,38,26,.65)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p1, q1); g.lineTo(p2, q2); g.stroke(); }
    }
    // the garden fence at the north edge
    line([[-1.6, -37.2], [2.6, -37.2]], 0.16, INK);
    for (let x = -1.6; x <= 2.6; x += 0.5) line([[x, -37.6], [x, -36.8]], 0.1, INK);
    return c;
  }

  // ---------------------------------------------------------------- fog of war
  reveal(x, z, R = 9) {
    let changed = false;
    const ci = (x + HALF) / 2, cj = (z + HALF) / 2, rc = R / 2;
    for (let j = Math.floor(cj - rc); j <= Math.ceil(cj + rc); j++) for (let i = Math.floor(ci - rc); i <= Math.ceil(ci + rc); i++) {
      if (i < 0 || j < 0 || i >= FOG || j >= FOG) continue;
      if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > rc * rc) continue;
      if (!this.fog[j * FOG + i]) { this.fog[j * FOG + i] = 1; changed = true; }
    }
    if (changed) this.paintFog();
    return changed;
  }
  paintFog() {
    const img = this.fogG.createImageData(FOG, FOG);
    for (let k = 0; k < FOG * FOG; k++) img.data[k * 4 + 3] = this.fog[k] ? 255 : 0;
    this.fogG.putImageData(img, 0, 0);
    // what has been seen is drawn in: the base drawing kept only where the mask is (soft edges from the scaling)
    if (!this.inked) return;
    const g = this.inked.getContext('2d'), N = this.inked.width;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, N, N); g.drawImage(this.base, 0, 0);
    g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true; g.drawImage(this.fogCv, 0, 0, N, N);
    g.globalCompositeOperation = 'source-over';
  }
  explored() { let n = 0; for (const v of this.fog) n += v; return n / this.fog.length; }
  saveFog() { let s = ''; for (let k = 0; k < this.fog.length; k += 8) { let b = 0; for (let q = 0; q < 8; q++) b |= (this.fog[k + q] || 0) << q; s += String.fromCharCode(b); } return btoa(s); }
  loadFog(str) {
    if (!str) return;
    try { const s = atob(str); for (let k = 0; k < s.length; k++) { const b = s.charCodeAt(k); for (let q = 0; q < 8; q++) this.fog[k * 8 + q] = (b >> q) & 1; } this.paintFog(); } catch (e) { /* corrupt save: start unexplored */ }
  }

  // ---------------------------------------------------------------- drawing
  markers() {
    const gp = this.gameplay, out = [];
    const tgt = this.quests?.target; if (tgt) out.push({ kind: 'target', x: tgt.x, z: tgt.z });
    for (const c of gp.companions) if (c.found) out.push({ kind: 'friend', x: c.pos.x, z: c.pos.z, col: ['#ffc34d', '#7fb0c8', '#efe6d6'][c.kind] });
    const scan = gp.unlocked?.('wide') ? 24 : gp.unlocked?.('scan') ? 12 : 0;
    if (scan) { const p = this.player.pos; for (const s of gp.shards) if (!s.got && (s.mesh.position.x - p.x) ** 2 + (s.mesh.position.z - p.z) ** 2 < scan * scan) out.push({ kind: 'shard', x: s.mesh.position.x, z: s.mesh.position.z }); }
    return out;
  }
  drawMarker(g, m, x, y, s, rim) {
    g.save(); g.translate(x, y);
    if (m.kind === 'target') {
      // circled in red pen, with a cross
      g.strokeStyle = '#a63d2c'; g.lineWidth = 2.2 * s; g.beginPath(); g.ellipse(0, 0, 8 * s, 7 * s, 0.3, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 2 * s; g.beginPath(); g.moveTo(-3.5 * s, -3.5 * s); g.lineTo(3.5 * s, 3.5 * s); g.moveTo(3.5 * s, -3.5 * s); g.lineTo(-3.5 * s, 3.5 * s); g.stroke();
    } else if (m.kind === 'friend') { g.fillStyle = m.col; g.strokeStyle = '#2b2219'; g.lineWidth = 1.5 * s; g.fillRect(-5 * s, -4 * s, 10 * s, 8 * s); g.strokeRect(-5 * s, -4 * s, 10 * s, 8 * s); }
    else if (m.kind === 'shard') { g.fillStyle = '#2f8ea8'; g.beginPath(); g.moveTo(0, -3.6 * s); g.lineTo(2.4 * s, 0); g.lineTo(0, 3.6 * s); g.lineTo(-2.4 * s, 0); g.closePath(); g.fill(); }
    g.restore();
  }
  drawPlayer(g, x, y, ang, s) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#2b2219'; g.strokeStyle = 'rgba(236,226,200,.95)'; g.lineWidth = 1.5 * s;
    g.beginPath(); g.moveTo(0, -9 * s); g.lineTo(6.5 * s, 7 * s); g.lineTo(0, 3.5 * s); g.lineTo(-6.5 * s, 7 * s); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  drawMini() {
    const g = this.g, W = this.cv.width, R = W / 2, view = 24, k = R / view;       // 24 m radius
    const p = this.player.pos, yaw = this.orbit.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rot = -Math.PI / 2 - Math.atan2(fz, fx);
    g.clearRect(0, 0, W, W);
    g.save(); g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    const pg = g.createRadialGradient(R, R, R * 0.2, R, R, R); pg.addColorStop(0, '#efe5cc'); pg.addColorStop(1, '#ddd0b0');
    g.fillStyle = pg; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(rot); g.scale(k, k); g.translate(-p.x, -p.z);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.inked, -HALF, -HALF, WORLD.size, WORLD.size);
    g.restore();
    // markers in screen space (rotated), the objective pinned to the rim
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (const m of this.markers()) {
      let dx = (m.x - p.x) * k, dz = (m.z - p.z) * k;
      let x = dx * cs - dz * sn, y = dx * sn + dz * cs;
      const d = Math.hypot(x, y), lim = R - 12;
      if (d > lim) { if (m.kind !== 'target') continue; x *= lim / d; y *= lim / d; }
      this.drawMarker(g, m, R + x, R + y, W / 128);
    }
    // facing (sin yaw, cos yaw) on the canvas, turned with the map; the arrow is drawn pointing up
    this.drawPlayer(g, R, R, Math.atan2(Math.cos(this.player.yaw), Math.sin(this.player.yaw)) + rot + Math.PI / 2, W / 128);
    // north, written in red at the edge (the leather ring is drawn over the rim by the page)
    const na = rot - Math.PI / 2, nx = R + Math.cos(na) * (R - 22), ny = R + Math.sin(na) * (R - 22);
    g.fillStyle = '#a63d2c'; g.font = `${Math.round(W / 9)}px 'Nanum Pen Script', serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
  }
  drawBig() {
    const g = this.bg, W = this.big.width, k = W / WORLD.size;
    g.clearRect(0, 0, W, W);
    g.imageSmoothingEnabled = true; g.drawImage(this.inked, 0, 0, W, W);
    const P = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of REGIONS) {
      if (!this.gameplay.save.regions.includes(r.id)) continue;
      const [x, y] = P(r.x, r.z);
      g.font = "30px 'Nanum Pen Script', serif"; g.lineWidth = 5; g.strokeStyle = 'rgba(236,226,200,.85)'; g.strokeText(r.name, x, y - 16); g.fillStyle = '#3a2a1c'; g.fillText(r.name, x, y - 16);
    }
    for (const m of this.markers()) { const [x, y] = P(m.x, m.z); this.drawMarker(g, m, x, y, 1.6); }
    const [px, py] = P(this.player.pos.x, this.player.pos.z);
    this.drawPlayer(g, px, py, Math.atan2(Math.cos(this.player.yaw), Math.sin(this.player.yaw)) + Math.PI / 2, 1.5);
    document.getElementById('bm-explored').textContent = `숲의 ${Math.round(this.explored() * 100)}%를 그렸다. 동력 결정 ${this.gameplay.save.shards.length} / ${this.gameplay.totalShards}.`;
  }
  show(on) {
    this.open = on;
    document.getElementById('bigmap').classList.toggle('hidden', !on);
    if (on) this.drawBig();
  }
  update(dt) {
    this.t += dt;
    const p = this.player.pos;
    if (this.reveal(p.x, p.z)) this.gameplay.save.explored = this.saveFog();
    if (this.t > 1 / 15) { this.t = 0; this.drawMini(); }
  }
}
