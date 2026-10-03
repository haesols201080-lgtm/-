// 지도: 높이 함수로 그린 음영 지도 + 걸어 다닌 곳만 걷히는 안개 + 표시(장소·탑·목표·해류·나).
import { heightAt, regionWeights, RC } from '../world/heightfield.js';
import { REGIONS } from '../world/regions.js';
import { PLACES } from '../data/places.js';
import { pavedAt } from '../data/city.js';
import { locate } from '../world/cityplan.js';

const RANGE = 60000; // 지도 반경 (m)
const N = 768; // 바탕 해상도
const FOG_N = 384; // 안개 해상도
const OLD = { range: 24000, n: 256 }; // 옛 저장(대륙만 있던 지도)

// 도시 땅의 쓰임 색 (data/city.js 의 USE 순서: 0 자연 1 주거 2 상업 3 공공 4 산업 5 물류 6 에너지 7 연구 8 교통 9 인공 환경 10 녹지 11 광장 12 농장 13 교외 집)
const USE_COL = [null, [226, 204, 168], [240, 178, 116], [186, 198, 244], [168, 158, 172], [200, 178, 146], [246, 224, 118],
  [150, 214, 236], [214, 214, 226], [140, 214, 186], [104, 168, 104], [236, 232, 240], [172, 192, 106], [214, 200, 168]];
const ROAD_COL = [196, 192, 208];

const lin = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const PAL = REGIONS.map((r) => ({ g: lin(r.pal.grass), r: lin(r.pal.rock) }));

/** 바탕 지도를 몇 줄씩 나눠 그리고, 밝혀진 영역을 기록 */
export class MapData {
  constructor(game) {
    this.game = game;
    this.canvas = document.createElement('canvas');
    this.canvas.width = N; this.canvas.height = N;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(N, N);
    this.H = new Float32Array(N * N);
    this.row = 0;
    this.done = false;
    this.fog = new Uint8Array(FOG_N * FOG_N);
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = FOG_N; this.fogCanvas.height = FOG_N;
    this.fogCtx = this.fogCanvas.getContext('2d');
    this.fogImg = this.fogCtx.createImageData(FOG_N, FOG_N);
    this.fogDirty = true;
    this._w = new Float32Array(RC);
    this.load(game.state.reveal);
  }

  /** 백그라운드에서 조금씩 그리기 */
  step(budgetMs = 1.5) {
    if (this.done) return;
    const t0 = performance.now();
    const cell = (2 * RANGE) / N;
    while (this.row < N && performance.now() - t0 < budgetMs) {
      const j = this.row;
      for (let i = 0; i < N; i++) {
        const x = -RANGE + (i + 0.5) * cell, z = -RANGE + (j + 0.5) * cell;
        this.H[j * N + i] = heightAt(x, z, 0, this._w);
        let b = 0;
        for (let k = 1; k < RC; k++) if (this._w[k] > this._w[b]) b = k;
        this.H[j * N + i] += b * 1e-6; // 지역 정보는 따로 저장할 필요 없이 색에 반영
        this._shade(i, j, b);
      }
      this.row++;
    }
    if (this.row >= N) { this.done = true; this.ctx.putImageData(this.img, 0, 0); }
    else if (this.row % 32 === 0) this.ctx.putImageData(this.img, 0, 0);
  }

  _shade(i, j, region) {
    const H = this.H, d = this.img.data, o = (j * N + i) * 4;
    const h = H[j * N + i];
    const hl = i > 0 ? H[j * N + i - 1] : h, hu = j > 0 ? H[(j - 1) * N + i] : h;
    const cell = (2 * RANGE) / N;
    const sl = Math.hypot(h - hl, h - hu) / cell;
    const shade = Math.max(0.45, Math.min(1.35, 1 + ((h - hl) + (h - hu)) / cell * 2.2));
    let c;
    if (h < 0) {
      const k = Math.min(1, -h / 160);
      c = [24 + 30 * (1 - k), 70 + 70 * (1 - k), 110 + 50 * (1 - k)];
    } else {
      const p = PAL[region];
      c = sl > 0.35 ? p.r : p.g;
      c = c.map((v) => v * shade);
      if (h > 1050 && sl < 0.5) c = [230 * shade, 236 * shade, 248 * shade];
      if (h < 3) c = [214, 196, 150];
    }
    if (h > 1) {
      const x = -RANGE + (i + 0.5) * cell, z = -RANGE + (j + 0.5) * cell;
      const plan = this.game.city && this.game.city.plan;
      if (plan) {
        // 도시: 칸 안 네 점의 쓰임을 섞어 그린다 (길은 밝은 돌색)
        const acc = [0, 0, 0];
        let n = 0;
        for (let q = 0; q < 4; q++) {
          const L = locate(plan, x + ((q & 1) - 0.5) * cell * 0.5, z + ((q >> 1) - 0.5) * cell * 0.5);
          if (!L) { if (this.game.city._inCore(x, z)) { for (let k = 0; k < 3; k++) acc[k] += USE_COL[11][k]; n++; } continue; }
          const col = L.kind === 'block' ? USE_COL[L.B.type] : ROAD_COL;
          if (!col || (L.kind === 'block' && L.B.natural)) continue;
          for (let k = 0; k < 3; k++) acc[k] += col[k];
          n++;
        }
        if (n) c = c.map((v, k) => v + ((acc[k] / n) * shade - v) * (n / 4) * 0.9);
      } else {
        const p = pavedAt(x, z);
        if (p > 0) c = c.map((v, k) => v + ([214, 208, 226][k] * shade - v) * p * 0.85);
      }
    }
    d[o] = Math.min(255, c[0]); d[o + 1] = Math.min(255, c[1]); d[o + 2] = Math.min(255, c[2]); d[o + 3] = 255;
  }

  /** 반경 r(m) 만큼 밝히기 */
  reveal(x, z, r) {
    const s = FOG_N / (2 * RANGE);
    const ci = (x + RANGE) * s, cj = (z + RANGE) * s, rr = r * s;
    const i0 = Math.max(0, Math.floor(ci - rr)), i1 = Math.min(FOG_N - 1, Math.ceil(ci + rr));
    const j0 = Math.max(0, Math.floor(cj - rr)), j1 = Math.min(FOG_N - 1, Math.ceil(cj + rr));
    let changed = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(i - ci, j - cj) / rr;
      if (d > 1) continue;
      const v = Math.round(255 * Math.min(1, (1 - d) * 3));
      const k = j * FOG_N + i;
      if (v > this.fog[k]) { this.fog[k] = v; changed = true; }
    }
    if (changed) this.fogDirty = true;
  }

  revealedAt(x, z) {
    const s = FOG_N / (2 * RANGE);
    const i = Math.floor((x + RANGE) * s), j = Math.floor((z + RANGE) * s);
    if (i < 0 || j < 0 || i >= FOG_N || j >= FOG_N) return 0;
    return this.fog[j * FOG_N + i] / 255;
  }

  fogImage() {
    if (this.fogDirty) {
      const d = this.fogImg.data;
      for (let k = 0; k < this.fog.length; k++) {
        d[k * 4] = 12; d[k * 4 + 1] = 13; d[k * 4 + 2] = 34; d[k * 4 + 3] = 255 - this.fog[k];
      }
      this.fogCtx.putImageData(this.fogImg, 0, 0);
      this.fogDirty = false;
    }
    return this.fogCanvas;
  }

  /** 저장: 0/1 비트 → 길이 부호화 문자열 (앞에 지도 크기 표시) */
  serialize() {
    let out = `R${RANGE / 1000}N${FOG_N}:`, cur = this.fog[0] > 60 ? 1 : 0, run = 0;
    for (let k = 0; k < this.fog.length; k++) {
      const b = this.fog[k] > 60 ? 1 : 0;
      if (b === cur && run < 35000) run++;
      else { out += run.toString(36) + (cur ? '+' : '-'); cur = b; run = 1; }
    }
    out += run.toString(36) + (cur ? '+' : '-');
    return out;
  }

  load(str) {
    if (!str) return;
    try {
      const head = /^R(\d+)N(\d+):/.exec(str);
      const range = head ? +head[1] * 1000 : OLD.range;
      const n = head ? +head[2] : OLD.n;
      const body = head ? str.slice(head[0].length) : str;
      const src = new Uint8Array(n * n);
      let k = 0;
      const re = /([0-9a-z]+)([+-])/g;
      let m;
      while ((m = re.exec(body))) {
        const c = parseInt(m[1], 36), v = m[2] === '+' ? 255 : 0;
        for (let i = 0; i < c && k < src.length; i++) src[k++] = v;
      }
      if (range === RANGE && n === FOG_N) this.fog.set(src);
      else {
        // 크기가 다른 옛 지도 → 새 격자로 옮겨 담기
        for (let j = 0; j < FOG_N; j++) for (let i = 0; i < FOG_N; i++) {
          const x = -RANGE + ((i + 0.5) / FOG_N) * 2 * RANGE, z = -RANGE + ((j + 0.5) / FOG_N) * 2 * RANGE;
          const si = Math.floor(((x + range) / (2 * range)) * n), sj = Math.floor(((z + range) / (2 * range)) * n);
          if (si >= 0 && sj >= 0 && si < n && sj < n) this.fog[j * FOG_N + i] = Math.max(this.fog[j * FOG_N + i], src[sj * n + si]);
        }
      }
      this.fogDirty = true;
    } catch { /* 무시 */ }
  }
}

/** 메뉴의 지도 화면 */
export class MapView {
  constructor(game) {
    this.game = game;
    this.zoom = 1;
    this.cx = 0; this.cz = 0;
    this.canvas = null;
  }

  attach(parent) {
    const g = this.game;
    const c = document.createElement('canvas');
    c.className = 'mapc';
    parent.appendChild(c);
    const legend = document.createElement('div');
    legend.className = 'map-legend glass';
    legend.innerHTML = `<span style="color:#ffd89a">◆</span> 목표 &nbsp; <span style="color:#7ff3e6">●</span> 노래하는 탑 &nbsp; <span style="color:#8a8aa0">●</span> 듣는 탑 &nbsp; <span style="color:#fff">✦</span> 표식 &nbsp; <span style="color:#7fb8ff">◯</span> 시설<br><span style="color:#e2cca8">■</span> 주거 <span style="color:#f0b274">■</span> 상업 <span style="color:#bac6f4">■</span> 공공 <span style="color:#96d6ec">■</span> 연구 <span style="color:#a89eac">■</span> 산업·물류 <span style="color:#f6e076">■</span> 에너지 <span style="color:#8cd6ba">■</span> 인공 환경 <span style="color:#68a868">■</span> 녹지 <span style="color:#acc06a">■</span> 농장 &nbsp; ${g.ui.touch ? '눌러서 표식' : '클릭해서 표식 · 휠로 확대'}`;
    parent.appendChild(legend);
    const tools = document.createElement('div');
    tools.className = 'map-tools';
    tools.innerHTML = `<button class="btn" data-me>내 위치</button><button class="btn" data-clear>표식 지우기</button>`;
    parent.appendChild(tools);
    tools.querySelector('[data-me]').addEventListener('click', () => { this.cx = g.player.pos.x; this.cz = g.player.pos.z; this.draw(); });
    tools.querySelector('[data-clear]').addEventListener('click', () => { g.state.waypoint = null; g.updateWaypoint(); this.draw(); });
    this.canvas = c;
    this.cx = g.player.pos.x; this.cz = g.player.pos.z;
    if (!this._zoomed) { this.zoom = 3.8; this._zoomed = true; }
    const resize = () => {
      const r = parent.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      c.width = r.width * dpr; c.height = r.height * dpr;
      this.dpr = dpr;
      this.draw();
    };
    this._resize = resize;
    addEventListener('resize', resize);
    resize();
    // 끌기·확대·표식
    const pts = new Map();
    let moved = 0, pinch0 = 0, zoom0 = 1;
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = this.zoom; } });
    c.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pts.values()];
        this.zoom = Math.max(0.8, Math.min(30, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch0)));
        moved = 99;
        this.draw();
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      p.x = e.clientX; p.y = e.clientY;
      const mpp = this._mpp();
      this.cx -= dx * mpp * this.dpr; this.cz -= dy * mpp * this.dpr;
      this.draw();
    });
    const up = (e) => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (p && moved < 8 && pts.size === 0) {
        const r = c.getBoundingClientRect();
        const [x, z] = this._toWorld((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr);
        g.state.waypoint = { x, z };
        g.updateWaypoint();
        g.audio.blip({ hz: 880, to: 1320, dur: 0.12, gain: 0.08 });
        this.draw();
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => pts.delete(e.pointerId));
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.8, Math.min(30, this.zoom * (e.deltaY > 0 ? 0.87 : 1.15))); this.draw(); }, { passive: false });
    this._timer = setInterval(() => this.draw(), 500);
  }

  detach() {
    if (this._resize) removeEventListener('resize', this._resize);
    clearInterval(this._timer);
    this.canvas = null;
  }

  _mpp() {
    // 화면 1px(장치) 당 m
    const c = this.canvas;
    return (2 * RANGE) / (Math.min(c.width, c.height) * this.zoom);
  }

  _toScreen(x, z) {
    const c = this.canvas, m = this._mpp();
    return [c.width / 2 + (x - this.cx) / m, c.height / 2 + (z - this.cz) / m];
  }

  _toWorld(sx, sy) {
    const c = this.canvas, m = this._mpp();
    return [this.cx + (sx - c.width / 2) * m, this.cz + (sy - c.height / 2) * m];
  }

  draw() {
    const c = this.canvas;
    if (!c) return;
    const g = this.game, md = g.mapData;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0c0d22';
    ctx.fillRect(0, 0, c.width, c.height);
    const [x0, y0] = this._toScreen(-RANGE, -RANGE);
    const [x1, y1] = this._toScreen(RANGE, RANGE);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(md.canvas, x0, y0, x1 - x0, y1 - y0);
    ctx.drawImage(md.fogImage(), x0, y0, x1 - x0, y1 - y0);
    const dpr = this.dpr;
    // 해류
    ctx.lineWidth = 2 * dpr;
    for (const cur of g.currents.list) {
      if (!cur.enabled) continue;
      ctx.strokeStyle = '#' + cur.mat.uniforms.uColor.value.getHexString() + 'aa';
      ctx.beginPath();
      cur.samples.forEach((p, i) => {
        if (i % 4) return;
        const [sx, sy] = this._toScreen(p.x, p.z);
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    }
    // 빛길
    if (g.transit) {
      const T = g.transit;
      const line = (pts, col, w) => {
        ctx.strokeStyle = col; ctx.lineWidth = w * dpr;
        ctx.beginPath();
        pts.forEach((p, i) => { const [sx, sy] = this._toScreen(p.x, p.z); if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); });
        ctx.stroke();
      };
      line(T.ring.pts, 'rgba(255,210,122,0.75)', 1.6);
      for (const L of T.lines) line(L.path.pts.filter((p, i) => i % 3 === 0 || i === L.path.pts.length - 1), L.open ? 'rgba(255,210,122,0.75)' : 'rgba(160,160,180,0.35)', 1.4);
      for (const S of T.stations) {
        const [sx, sy] = this._toScreen(S.x, S.z);
        ctx.fillStyle = S.open ? '#ffd27a' : '#8a8aa0';
        ctx.fillRect(sx - 3 * dpr, sy - 3 * dpr, 6 * dpr, 6 * dpr);
      }
    }
    // 장소
    ctx.font = `${12 * dpr}px 'Noto Sans KR', sans-serif`;
    ctx.textAlign = 'center';
    for (const p of PLACES) {
      if (p.type === 'lift' || p.type === 'none') continue;
      const known = g.state.discovered[p.id] || md.revealedAt(p.pos[0], p.pos[1]) > 0.5;
      if (!known) continue;
      const [sx, sy] = this._toScreen(p.pos[0], p.pos[1]);
      let col = '#f3efe6';
      if (p.type === 'pylon') { const P = g.structures.pylons.get(p.id); col = P && P.alive ? '#7ff3e6' : '#8a8aa0'; }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, sy, (p.type === 'pylon' ? 5 : p.type === 'vista' ? 3.5 : 4) * dpr, 0, Math.PI * 2);
      ctx.fill();
      if (this.zoom > 4 || ['capital', 'village', 'glasscity', 'bloomcity', 'canyoncity', 'seacity', 'observatory', 'crash', 'district', 'starport', 'riftcity', 'riftcore', 'bones', 'greatear', 'skyforge'].includes(p.type) || (p.type === 'landmark' && this.zoom > 2.7)) {
        ctx.fillStyle = 'rgba(243,239,230,0.9)';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 4 * dpr;
        ctx.fillText(p.name, sx, sy - 9 * dpr);
        ctx.shadowBlur = 0;
      }
    }
    // 쓰임이 있는 건물 (들렀거나 밝혀진 곳) — 가까이 볼수록 많이
    if (g.facilities) {
      const hex = (c) => '#' + c.toString(16).padStart(6, '0');
      ctx.font = `${10 * dpr}px sans-serif`;
      for (const F of g.facilities.list) {
        if (F.y > 20000) continue;
        const visited = g.state.facility.visited[F.id];
        if (!visited && md.revealedAt(F.x, F.z) < 0.5) continue;
        const travel = F.type === 'dock' || F.type === 'rest';
        if (this.zoom < (travel && visited ? 1.6 : 5)) continue;
        const [sx, sy] = this._toScreen(F.x, F.z);
        const r = 7 * dpr;
        ctx.fillStyle = 'rgba(12,13,34,0.75)';
        ctx.strokeStyle = hex(F.info.color);
        ctx.lineWidth = (visited ? 1.6 : 1) * dpr;
        ctx.globalAlpha = visited ? 1 : 0.6;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = hex(F.info.color);
        ctx.fillText(F.info.icon, sx, sy + 3.5 * dpr);
        if (this.zoom > 20) { ctx.fillStyle = 'rgba(243,239,230,0.85)'; ctx.fillText(F.name, sx, sy + 18 * dpr); }
        ctx.globalAlpha = 1;
      }
    }
    // 구역의 보조 랜드마크 (밝혀진 곳만)
    if (g.city && g.city.marks && this.zoom > 2) {
      ctx.font = `${10 * dpr}px sans-serif`;
      for (const M of g.city.marks) {
        if (md.revealedAt(M.x, M.z) < 0.5) continue;
        const [sx, sy] = this._toScreen(M.x, M.z);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(12,13,34,0.75)'; ctx.strokeStyle = M.color; ctx.lineWidth = 1.4 * dpr;
        ctx.fillRect(-4.5 * dpr, -4.5 * dpr, 9 * dpr, 9 * dpr); ctx.strokeRect(-4.5 * dpr, -4.5 * dpr, 9 * dpr, 9 * dpr);
        ctx.restore();
        if (this.zoom > 3.5) { ctx.fillStyle = 'rgba(243,239,230,0.85)'; ctx.fillText(M.name, sx, sy - 9 * dpr); }
      }
    }
    // 목표
    for (const t of g.quests.targets()) {
      const [sx, sy] = this._toScreen(t.x, t.z);
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd89a';
      ctx.shadowColor = '#ffd89a'; ctx.shadowBlur = 10 * dpr;
      ctx.fillRect(-5 * dpr, -5 * dpr, 10 * dpr, 10 * dpr);
      ctx.restore();
    }
    // 표식
    if (g.state.waypoint) {
      const [sx, sy] = this._toScreen(g.state.waypoint.x, g.state.waypoint.z);
      ctx.fillStyle = '#fff';
      ctx.font = `${18 * dpr}px sans-serif`;
      ctx.fillText('✦', sx, sy + 6 * dpr);
    }
    // 나
    const pp = g.player.pos;
    const [px, py] = this._toScreen(pp.x, pp.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-g.player.yaw);
    ctx.fillStyle = '#ff7a52';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, 9 * dpr); ctx.lineTo(6 * dpr, -6 * dpr); ctx.lineTo(0, -2 * dpr); ctx.lineTo(-6 * dpr, -6 * dpr); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (!md.done) {
      ctx.fillStyle = 'rgba(243,239,230,0.6)';
      ctx.font = `${12 * dpr}px sans-serif`;
      ctx.fillText(`지도를 그리는 중… ${Math.round((md.row / N) * 100)}%`, c.width / 2, 30 * dpr);
    }
  }
}
