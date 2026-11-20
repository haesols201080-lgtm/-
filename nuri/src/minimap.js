// Minimap + full map. The base map is painted once from the world itself (hill shading from the terrain, water,
// paths, tree crowns, rocks, logs, the outcrop and the glade bank); the minimap turns with the camera, and a fog of
// war clears where the robot has been (saved with the game). Markers: the current objective (pinned to the rim when
// it is off the map), friends already found, the robot, and — once the light scanner is unlocked — nearby shards.
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
    this.paintFog();
  }

  // ---------------------------------------------------------------- base map
  bake() {
    const T = this.world.terrain, N = WORLD.size * PX;
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const img = g.createImageData(N, N), d = img.data;
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = T.heightAt(-HALF + i / PX, -HALF + j / PX);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -HALF + (i + 0.5) / PX, z = -HALF + (j + 0.5) / PX, o = (j * N + i) * 4;
      const h = H[j * (N + 1) + i], hx = H[j * (N + 1) + i + 1] - h, hz = H[(j + 1) * (N + 1) + i] - h;
      // light from the north-west
      const shade = Math.max(0.55, Math.min(1.35, 1 - (hx * 0.7 + hz * 0.7) * PX * 1.6));
      let r = 74, gg = 70, b = 50;
      if (T.isWater(x, z)) { const dep = Math.min(1, (T.waterY - h) * 2.5); r = 52 - dep * 20; gg = 104 - dep * 25; b = 128 - dep * 10; }
      else { const hk = Math.min(1, Math.max(0, (h + 0.2) / 3)); r += hk * 18; gg += hk * 12; b += hk * 6; }
      d[o] = r * shade; d[o + 1] = gg * shade; d[o + 2] = b * shade; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (x, z) => [(x + HALF) * PX, (z + HALF) * PX];
    const line = (pts, w, col) => { g.beginPath(); pts.forEach(([x, z], k) => { const [px, pz] = P(x, z); k ? g.lineTo(px, pz) : g.moveTo(px, pz); });
      g.lineWidth = w * PX; g.strokeStyle = col; g.lineCap = g.lineJoin = 'round'; g.stroke(); };
    for (const p of TRAILS) { g.setLineDash([3, 4]); line(p, 0.35, 'rgba(176,150,108,.55)'); g.setLineDash([]); }
    for (const p of [PATH, PATH2, PATH3]) { line(p, 1.6, 'rgba(40,30,20,.55)'); line(p, 1.1, 'rgba(196,170,124,.95)'); }
    // tree crowns
    for (const t of this.world.treeSpots) {
      const [px, pz] = P(t.x, t.z), r = (t.hero ? 2.8 : 2.1) * t.s * PX;
      const gr = g.createRadialGradient(px - r * 0.25, pz - r * 0.25, r * 0.1, px, pz, r);
      gr.addColorStop(0, 'rgba(74,104,62,.92)'); gr.addColorStop(1, 'rgba(28,48,30,.85)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, pz, r, 0, Math.PI * 2); g.fill();
    }
    // rocks, logs, outcrop, the glade bank
    for (const r of this.world.rocks) { if (r.r < 0.25) continue; const [px, pz] = P(r.x, r.z); g.fillStyle = 'rgba(150,148,138,.95)'; g.beginPath(); g.arc(px, pz, Math.max(2, r.r * PX), 0, Math.PI * 2); g.fill(); }
    for (const l of this.world.logs) line([[l.x1, l.z1], [l.x2, l.z2]], l.r * 2, 'rgba(110,80,52,.95)');
    { const [px, pz] = P(OUTCROP.x, OUTCROP.z); g.fillStyle = 'rgba(132,128,120,.95)'; g.beginPath(); g.ellipse(px, pz, 7.5 * PX, 6 * PX, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,58,52,.8)'; g.lineWidth = 2; g.stroke(); }
    line(GLADE_RIDGE, 2.4, 'rgba(96,88,70,.9)');
    // the garden fence at the north edge
    line([[-1.6, -37.2], [2.6, -37.2]], 0.3, 'rgba(220,210,190,.9)');
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
    for (let k = 0; k < FOG * FOG; k++) { img.data[k * 4] = 10; img.data[k * 4 + 1] = 14; img.data[k * 4 + 2] = 12; img.data[k * 4 + 3] = this.fog[k] ? 0 : 175; }
    this.fogG.putImageData(img, 0, 0);
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
      g.rotate(Math.PI / 4); g.fillStyle = 'rgba(255,210,122,.3)'; g.strokeStyle = '#ffd27a'; g.lineWidth = 2.5 * s;
      g.fillRect(-6 * s, -6 * s, 12 * s, 12 * s); g.strokeRect(-6 * s, -6 * s, 12 * s, 12 * s);
    } else if (m.kind === 'friend') { g.fillStyle = m.col; g.strokeStyle = '#1a2622'; g.lineWidth = 1.5 * s; g.fillRect(-5 * s, -4 * s, 10 * s, 8 * s); g.strokeRect(-5 * s, -4 * s, 10 * s, 8 * s); }
    else if (m.kind === 'shard') { g.fillStyle = '#7ff0ff'; g.shadowColor = '#5fe6ff'; g.shadowBlur = 6 * s; g.beginPath(); g.arc(0, 0, 2.6 * s, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  drawPlayer(g, x, y, ang, s) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5 * s;
    g.beginPath(); g.moveTo(0, -9 * s); g.lineTo(6.5 * s, 7 * s); g.lineTo(0, 3.5 * s); g.lineTo(-6.5 * s, 7 * s); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  drawMini() {
    const g = this.g, W = this.cv.width, R = W / 2, view = 24, k = R / view;       // 24 m radius
    const p = this.player.pos, yaw = this.orbit.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rot = -Math.PI / 2 - Math.atan2(fz, fx);
    g.clearRect(0, 0, W, W);
    g.save(); g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#0b100e'; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(rot); g.scale(k, k); g.translate(-p.x, -p.z);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.base, -HALF, -HALF, WORLD.size, WORLD.size);
    g.drawImage(this.fogCv, -HALF, -HALF, WORLD.size, WORLD.size);
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
    // rim + north mark
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 3; g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.stroke();
    const na = rot - Math.PI / 2, nx = R + Math.cos(na) * (R - 13), ny = R + Math.sin(na) * (R - 13);
    g.fillStyle = 'rgba(10,14,12,.7)'; g.beginPath(); g.arc(nx, ny, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd27a'; g.font = `bold ${Math.round(W / 14)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
  }
  drawBig() {
    const g = this.bg, W = this.big.width, k = W / WORLD.size;
    g.clearRect(0, 0, W, W);
    g.drawImage(this.base, 0, 0, W, W);
    g.imageSmoothingEnabled = true; g.drawImage(this.fogCv, 0, 0, W, W);
    const P = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of REGIONS) {
      if (!this.gameplay.save.regions.includes(r.id)) continue;
      const [x, y] = P(r.x, r.z);
      g.font = 'bold 15px system-ui'; g.lineWidth = 4; g.strokeStyle = 'rgba(8,12,10,.85)'; g.strokeText(r.name, x, y - 14); g.fillStyle = '#f4f1e8'; g.fillText(r.name, x, y - 14);
    }
    for (const m of this.markers()) { const [x, y] = P(m.x, m.z); this.drawMarker(g, m, x, y, 1.6); }
    const [px, py] = P(this.player.pos.x, this.player.pos.z);
    this.drawPlayer(g, px, py, Math.atan2(Math.cos(this.player.yaw), Math.sin(this.player.yaw)) + Math.PI / 2, 1.5);
    document.getElementById('bm-explored').textContent = `탐험한 숲 ${Math.round(this.explored() * 100)}% · 동력 결정 ${this.gameplay.save.shards.length} / ${this.gameplay.totalShards}`;
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
