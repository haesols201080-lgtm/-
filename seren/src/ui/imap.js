// 건물 안 지도 (v0.9): 들어가 있는 건물의 층 평면을 그 건물 짜임·층 평면·가구·운영 상태(같은 자료)에서 그린다.
//  · 왼쪽: 찾기(방·물건·시설·사람 → 길 안내) · 건물 단면(층마다 막대: 쓰임 빛깔·지금 층·목적지 층·승강기 무리) · 층 목록(쓰임 묶음별로 접힌다 — 아주 높은 건물도 한눈에)
//  · 가운데: 고른 층의 평면 — 방(누구나·직원·사는 이 빛깔)·벽·문·계단·승강기·주요 시설 표시·사람·나(자리와 바라보는 쪽)·안내 길·찾은 곳
//  · 방을 누르면 이름·쓰임·드나듦 + 「여기로 안내」. 정문이 아래, 북쪽 화살표.
import { FUSE, ROOMS, FIX } from '../interior/catalog.js';
import { searchBuilding, floorMarkers, roomSpot, LINKNAME } from '../interior/find.js';

const USE_COL = { lobby: '#c8b8f0', stem: '#c8b8f0', mart: '#f0b274', shops: '#f0b274', dept: '#f0b274', food: '#ffc890', cafe: '#ffc890', office: '#9fc0ff', confer: '#9fc0ff', exec: '#b9a6ff', research: '#96d6ec', clinic: '#8ff0c0', ward: '#8ff0c0', care: '#8ff0c0', diag: '#8ff0c0', school: '#ffe08a', schoolhall: '#ffe08a', library: '#e2cca8', museum: '#d8b0ff', hall: '#ff9fd0', admin: '#bac6f4', civic: '#bac6f4', residential: '#e2cca8', house: '#e2cca8', hotel: '#f6dce4', hotelfront: '#f6dce4', factory: '#a89eac', storage: '#a89eac', transit: '#ffd27a', farm: '#acc06a', garden: '#68a868', plant: '#f6e076', tech: '#6a6e80', parking: '#5a6070', supply: '#6a6e80', amenity: '#8cd6ba', observation: '#8cd6ba', mezz: '#9fc0ff' };
const ICON = { lift: '⇅', cargo: '⇅', stair: '≡', exit: '⇲', dock: '⇲', terrace: '◠', pay: '₩', work: '출', info: 'i', hire: '면', food: '식', mach: '⚙', art: '◇', med: '+', ticket: '표', stock: '▤', bed: '☾', crop: '❦', term: '▣' };
const hex = (v) => '#' + (v >>> 0).toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class InteriorMap {
  constructor(game) {
    this.game = game;
    this.sel = null; // 보고 있는 층
    this.open = new Set(); // 펼친 쓰임 묶음
    this.res = []; // 찾은 것
    this.pick = null; // 고른 방·시설
    this.zoom = 1; this.px = 0; this.pz = 0;
  }
  get cur() { const c = this.game.interiors.cur; return c && c.indoor ? c : null; }

  attach(parent, onWorld) {
    const g = this.game, cur = this.cur;
    if (!cur) return;
    const ind = cur.indoor, B = cur.B;
    if (this._uid !== cur.uid) { this._uid = cur.uid; this.sel = ind.cur; this.open = new Set(); this.res = []; this.pick = null; this.zoom = 1; this.px = this.pz = 0; }
    if (this.sel == null || !B.floors[this.sel]) this.sel = ind.cur;
    const el = document.createElement('div');
    el.className = 'imap';
    el.innerHTML = `<div class="imap-side glass"><div class="imap-title"></div>
      <div class="os-search"><input type="text" placeholder="찾기: 방·물건·시설·사람"><button class="btn" data-go>찾기</button></div>
      <div class="imap-res"></div><canvas class="imap-sec"></canvas><div class="imap-floors"></div></div>
      <div class="imap-main"><canvas class="imap-plan"></canvas><div class="imap-info glass"></div></div>
      <div class="map-tools"><button class="btn" data-here>지금 층</button><button class="btn" data-stop>안내 끄기</button><button class="btn" data-world>도시 지도</button></div>`;
    parent.appendChild(el);
    this.el = el;
    this.plan = el.querySelector('.imap-plan');
    this.sec = el.querySelector('.imap-sec');
    el.querySelector('.imap-title').innerHTML = `<b>${esc(g.interiors.title(cur.r))}</b><small>${B.special ? `${esc(B.special)} 건물 · ` : B.orgs.length > 2 ? `복합 건물 · 조직 ${B.orgs.length} · ` : ''}지상 ${B.floors.filter((F) => !F.below && !F.mezz).length}층${B.floors.some((F) => F.below) ? ` · 지하 ${B.floors.filter((F) => F.below).length}층` : ''}</small>`;
    const inp = el.querySelector('input');
    const go = () => { this.search(inp.value.trim()); };
    el.querySelector('[data-go]').addEventListener('click', go);
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    el.querySelector('[data-here]').addEventListener('click', () => { this.sel = ind.cur; this.zoom = 1; this.px = this.pz = 0; this._floors(); this.draw(); });
    el.querySelector('[data-stop]').addEventListener('click', () => { g.guide.clear(); this.draw(); });
    el.querySelector('[data-world]').addEventListener('click', () => onWorld && onWorld());
    // 평면: 끌기·확대·누르기
    const c = this.plan;
    let drag = null, moved = 0;
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; moved = 0; });
    c.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY; if (this.T) { this.px -= (dx * this.dpr) / this.T.s; this.pz -= (dy * this.dpr) / this.T.s; this.draw(); } });
    c.addEventListener('pointerup', (e) => { if (drag && moved < 6) { const r = c.getBoundingClientRect(); this.click((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr); } drag = null; });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.6, Math.min(6, this.zoom * (e.deltaY > 0 ? 0.87 : 1.15))); this.draw(); }, { passive: false });
    this.sec.addEventListener('click', (e) => { const r = this.sec.getBoundingClientRect(); this.secClick((e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr); });
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.dpr = dpr;
      const r = c.getBoundingClientRect();
      c.width = Math.max(10, r.width * dpr); c.height = Math.max(10, r.height * dpr);
      const rs = this.sec.getBoundingClientRect();
      this.sec.width = Math.max(10, rs.width * dpr); this.sec.height = Math.max(10, rs.height * dpr);
      this.draw();
    };
    this._resize = resize;
    addEventListener('resize', resize);
    this._floors();
    requestAnimationFrame(resize);
    this._timer = setInterval(() => this.draw(), 500);
  }
  detach() {
    if (this._resize) removeEventListener('resize', this._resize);
    clearInterval(this._timer);
    if (this.el) this.el.remove();
    this.el = null;
  }

  // ── 찾기 ──────────────────────────────────
  search(q) {
    const g = this.game;
    this.res = q ? searchBuilding(g, q, { limit: 8 }) : [];
    const box = this.el.querySelector('.imap-res');
    box.innerHTML = q ? (this.res.length ? this.res.map((r, k) => `<button class="btn svc-b" data-r="${k}"><b>${k + 1}. ${esc(r.label)}</b><small>${esc(r.sub || '')}</small></button>`).join('') : `<p class="muted">「${esc(q)}」 — 이 건물에서 못 찾았어요</p>`) : '';
    box.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { const r = this.res[+b.dataset.r]; g.guide.to(r); if (r.floor != null) this.sel = r.floor; this._floors(); this.draw(); }));
    if (this.res[0] && this.res[0].floor != null) { this.sel = this.res[0].floor; this._floors(); }
    this.draw();
  }

  // ── 층 목록 (쓰임 묶음) ─────────────────────
  _groups() {
    const B = this.cur.B, out = [];
    for (const F of B.floors.slice().reverse()) {
      if (!F.reach || F.dead) continue;
      const Z = B.zones[F.zone];
      const org = Z && Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      const key = `${F.use}|${Z ? Z.org : ''}`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.floors.push(F);
      else out.push({ key, use: F.use, org, floors: [F] });
    }
    return out;
  }
  _floors() {
    if (!this.el) return;
    const cur = this.cur, ind = cur.indoor, B = cur.B, g = this.game;
    const goal = g.guide.goal;
    const box = this.el.querySelector('.imap-floors');
    const gs = this._groups();
    const html = gs.map((G, k) => {
      const big = G.floors.length > 3;
      const has = G.floors.some((F) => F.i === this.sel || F.i === ind.cur || (goal && F.i === goal.floor));
      const opened = !big || has || this.open.has(G.key);
      const a = G.floors[G.floors.length - 1].label, b = G.floors[0].label;
      const head = `<div class="imap-g" data-g="${k}" style="--c:${USE_COL[G.use] || '#9fc0ff'}"><i></i><b>${a === b ? a : `${a}~${b}`}층 · ${esc(FUSE[G.use] ? FUSE[G.use].name : G.use)}</b><small>${G.org ? esc(G.org.name) : ''}${big ? (opened ? ' ▾' : ` ▸ ${G.floors.length}층`) : ''}</small></div>`;
      const rows = opened ? G.floors.map((F) => `<button class="imap-f${F.i === this.sel ? ' on' : ''}" data-f="${F.i}">${F.label}층${F.i === ind.cur ? ' <span class="me">● 나</span>' : ''}${goal && goal.floor === F.i ? ' <span class="go">◆ 목적지</span>' : ''}</button>`).join('') : '';
      return head + rows;
    }).join('');
    box.innerHTML = html;
    box.querySelectorAll('[data-g]').forEach((d) => d.addEventListener('click', () => { const G = gs[+d.dataset.g]; if (this.open.has(G.key)) this.open.delete(G.key); else this.open.add(G.key); this._floors(); }));
    box.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { this.sel = +b.dataset.f; this.pick = null; this.zoom = 1; this.px = this.pz = 0; this._floors(); this.draw(); }));
    void B;
  }

  // ── 그리기 ────────────────────────────────
  draw() {
    if (!this.el || !this.cur) return;
    this._section();
    this._plan();
    this._info();
  }
  /** 건물 단면: 층마다 막대 (너비 = 넓이) */
  _section() {
    const c = this.sec, cur = this.cur, B = cur.B, g = this.game;
    const ctx = c.getContext('2d'), W = c.width, H = c.height, dpr = this.dpr || 1;
    ctx.clearRect(0, 0, W, H);
    const fl = B.floors.filter((F) => !F.mezz);
    const y0 = Math.min(...fl.map((F) => F.y)), y1 = Math.max(...fl.map((F) => F.y + F.h));
    const maxN = Math.max(...fl.map((F) => F.n));
    const sy = (H - 8 * dpr) / Math.max(1, y1 - y0);
    const ind = cur.indoor, goal = g.guide.goal;
    this._secRows = [];
    // 땅
    const gy = H - 4 * dpr - (B.volume.floorY - y0) * sy;
    ctx.fillStyle = 'rgba(120,110,90,0.35)';
    ctx.fillRect(0, gy, W, H - gy);
    for (const F of B.floors) {
      const top = H - 4 * dpr - (F.y + (F.mezz ? 0 : F.h) - y0) * sy, bot = H - 4 * dpr - (F.y - y0) * sy;
      const w = Math.max(8 * dpr, (W - 16 * dpr) * Math.sqrt(F.n / maxN));
      const x = (W - w) / 2;
      ctx.globalAlpha = F.reach && !F.dead ? 1 : 0.3;
      ctx.fillStyle = USE_COL[F.use] || '#9fc0ff';
      if (F.mezz) ctx.fillRect(x, bot - 2 * dpr, w * 0.5, 2 * dpr);
      else ctx.fillRect(x, top + 0.6 * dpr, w, Math.max(1, bot - top - 1.2 * dpr));
      ctx.globalAlpha = 1;
      if (F.i === this.sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(x - 1, top, w + 2, bot - top); }
      if (F.i === ind.cur) { ctx.fillStyle = '#ff7a52'; ctx.beginPath(); ctx.arc(x - 6 * dpr, (top + bot) / 2, 3 * dpr, 0, Math.PI * 2); ctx.fill(); }
      if (goal && goal.floor === F.i) { ctx.fillStyle = '#9ff6ff'; ctx.beginPath(); ctx.arc(x + w + 6 * dpr, (top + bot) / 2, 3 * dpr, 0, Math.PI * 2); ctx.fill(); }
      this._secRows.push({ i: F.i, top, bot });
    }
    // 승강기 무리 (낮은층·높은층)
    let k = 0;
    for (const lk of B.links) {
      if (lk.kind !== 'lift' || k > 3) continue;
      const a = B.floors[Math.min(...lk.floors)], b = B.floors[Math.max(...lk.floors)];
      const x = 4 * dpr + k * 3 * dpr;
      ctx.strokeStyle = lk.bank === 'high' ? 'rgba(185,166,255,0.9)' : 'rgba(127,243,230,0.8)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(x, H - 4 * dpr - (a.y - y0) * sy); ctx.lineTo(x, H - 4 * dpr - (b.y + b.h - y0) * sy); ctx.stroke();
      k++;
    }
  }
  secClick(x, y) {
    const r = (this._secRows || []).find((q) => y >= q.top && y <= q.bot);
    if (!r) return;
    const F = this.cur.B.floors[r.i];
    if (!F.reach || F.dead) return;
    this.sel = r.i; this.pick = null; this.zoom = 1; this.px = this.pz = 0;
    this._floors(); this.draw();
  }
  /** 층 평면 */
  _plan() {
    const c = this.plan, cur = this.cur, B = cur.B, g = this.game, ind = cur.indoor;
    const ctx = c.getContext('2d'), W = c.width, H = c.height, dpr = this.dpr || 1;
    ctx.fillStyle = '#0c0d22';
    ctx.fillRect(0, 0, W, H);
    const i = this.sel, F = B.floors[i];
    const pl = F && F.reach && !F.dead ? ind.plan(i) : null;
    if (!pl || pl.L.closed) { ctx.fillStyle = 'rgba(243,239,230,0.6)'; ctx.font = `${14 * dpr}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('들어갈 수 없는 층', W / 2, H / 2); return; }
    const { L, fix } = pl;
    const { gw, gh, ox, oz } = B.G;
    // 그린 칸의 범위
    let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1;
    for (let k = 0; k < L.room.length; k++) if (L.room[k] || F.mask[k]) { const a = k % gw, b = (k / gw) | 0; i0 = Math.min(i0, a); i1 = Math.max(i1, a); j0 = Math.min(j0, b); j1 = Math.max(j1, b); }
    const s = Math.min((W - 40 * dpr) / (i1 - i0 + 3), (H - 40 * dpr) / (j1 - j0 + 3)) * this.zoom;
    const cxm = (i0 + i1 + 1) / 2 + this.px, czm = (j0 + j1 + 1) / 2 + this.pz;
    const X = (gx) => W / 2 + (gx - ox - cxm) * s, Y = (gz) => H / 2 + (gz - oz - czm) * s;
    this.T = { s, X, Y, cxm, czm, ox, oz, W, H };
    const RT = (k) => (L.room[k] ? L.rooms[L.room[k] - 1] : null);
    // 칸
    for (let k = 0; k < L.room.length; k++) {
      const R = RT(k);
      if (!R) continue;
      const a = k % gw, b = (k / gw) | 0;
      let col;
      if (R.type === 'stair') col = '#6c6450';
      else if (R.type === 'lift' || R.type === 'cargo') col = '#3e5a78';
      else if (R.type === 'shaft') col = '#33363f';
      else if (R.circ || R.type === 'corridor' || R.type === 'lifthall') col = '#30344c';
      else { const acc = ROOMS[R.type] ? ROOMS[R.type].acc : 'public'; col = acc === 'staff' ? '#4a3f36' : acc === 'private' ? '#3d3550' : '#2b4a48'; if (R.main) col = '#2f5450'; }
      if (L.void[k] === 1) col = '#14152c';
      if (L.void[k] === 3) col = '#6c6450';
      if (this.pick && this.pick.room === R.id) col = '#557a90';
      ctx.fillStyle = col;
      ctx.fillRect(X(ox + a), Y(oz + b), s + 0.5, s + 0.5);
    }
    // 벽 (방 경계) · 바깥 윤곽
    ctx.strokeStyle = 'rgba(220,226,240,0.75)';
    ctx.lineWidth = Math.max(1, s * 0.08);
    const doorEdge = new Set();
    for (const d of L.doors) {
      const a = d.c % gw, b = (d.c / gw) | 0, [di, dj] = d.dir, w = Math.max(1, d.w), o0 = -Math.floor((w - 1) / 2), o1 = Math.ceil((w - 1) / 2);
      for (let o = o0; o <= o1; o++) { const ci = a + (dj ? o : 0), cj = b + (di ? o : 0); doorEdge.add(di ? `v${di > 0 ? ci + 1 : ci},${cj}` : `h${ci},${dj > 0 ? cj + 1 : cj}`); }
    }
    ctx.beginPath();
    for (let b = 0; b < gh; b++) for (let a = 0; a < gw; a++) {
      const k = b * gw + a, A = L.room[k];
      if (a + 1 < gw) { const Bq = L.room[k + 1]; if ((A || Bq) && A !== Bq && !doorEdge.has(`v${a + 1},${b}`)) { ctx.moveTo(X(ox + a + 1), Y(oz + b)); ctx.lineTo(X(ox + a + 1), Y(oz + b + 1)); } }
      if (b + 1 < gh) { const Bq = L.room[k + gw]; if ((A || Bq) && A !== Bq && !doorEdge.has(`h${a},${b + 1}`)) { ctx.moveTo(X(ox + a), Y(oz + b + 1)); ctx.lineTo(X(ox + a + 1), Y(oz + b + 1)); } }
      if (A && a === 0) { ctx.moveTo(X(ox), Y(oz + b)); ctx.lineTo(X(ox), Y(oz + b + 1)); }
      if (A && b === 0) { ctx.moveTo(X(ox + a), Y(oz)); ctx.lineTo(X(ox + a + 1), Y(oz)); }
    }
    ctx.stroke();
    // 문 (작은 빛 점)
    ctx.fillStyle = 'rgba(127,243,230,0.85)';
    for (const d of L.doors) {
      if (d.kind === 'open') continue;
      const a = d.c % gw, b = (d.c / gw) | 0, [di, dj] = d.dir;
      const x = X(ox + a + 0.5 + di * 0.5), y = Y(oz + b + 0.5 + dj * 0.5);
      ctx.fillRect(x - s * 0.18, y - s * 0.18, s * 0.36, s * 0.36);
    }
    // 가구 (작은 사각형)
    ctx.fillStyle = 'rgba(200,205,220,0.28)';
    for (const q of fix) {
      const odd = q.rot % 2 === 1, w = (odd ? q.d : q.w) * s, d = (odd ? q.w : q.d) * s;
      if (w < 1.5 && d < 1.5) continue;
      ctx.fillRect(X(q.x) - w / 2, Y(q.z) - d / 2, w, d);
    }
    // 방 이름
    ctx.textAlign = 'center';
    ctx.font = `${Math.max(9, Math.min(13, s * 0.55)) * dpr / Math.max(1, dpr * 0.8)}px 'Noto Sans KR', sans-serif`;
    for (const R of L.rooms) {
      if (!R.n || R.n < (s > 14 ? 6 : 14) || R.circ || ['stair', 'lift', 'cargo', 'shaft', 'corridor', 'lifthall'].includes(R.type) || R.sealed) continue;
      const [gx, gz] = roomSpot(B, R);
      ctx.fillStyle = 'rgba(243,239,230,0.75)';
      ctx.fillText(R.name, X(gx), Y(gz) + 4 * dpr);
    }
    // 표시 (승강기·계단·정문·시설)
    ctx.font = `bold ${Math.max(10, Math.min(16, s * 0.8))}px sans-serif`;
    for (const M of floorMarkers(g, i)) {
      const x = X(M.gx), y = Y(M.gz), r = Math.max(6, s * 0.45);
      ctx.fillStyle = M.k === 'lift' || M.k === 'cargo' ? '#7fb8ff' : M.k === 'stair' ? '#ffd27a' : M.k === 'exit' || M.k === 'dock' ? '#8ff0c0' : M.k === 'hire' || M.k === 'work' ? '#ff9fd0' : '#e8e4ff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#10121e';
      ctx.fillText(ICON[M.k] || '·', x, y + r * 0.4);
    }
    // 사람
    const ag = g.ops && g.ops.agents;
    if (ag) for (const a of ag.list) {
      if (a.floor !== i) continue;
      ctx.fillStyle = a.staff ? '#ffc46a' : '#c8d0ff';
      ctx.beginPath(); ctx.arc(X(a.gx), Y(a.gz), Math.max(2, s * 0.18), 0, Math.PI * 2); ctx.fill();
    }
    // 안내 길
    const gd = g.guide;
    if (gd.leg && gd.leg.floor === i && gd.leg.pts.length > 1) {
      ctx.strokeStyle = '#9ff6ff'; ctx.lineWidth = Math.max(2, s * 0.16);
      ctx.setLineDash([s * 0.5, s * 0.35]);
      ctx.beginPath();
      gd.leg.pts.forEach(([gx, gz], k) => { if (k) ctx.lineTo(X(gx), Y(gz)); else ctx.moveTo(X(gx), Y(gz)); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (gd.goal && gd.goal.floor === i) { const x = X(gd.goal.gx), y = Y(gd.goal.gz); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#9ff6ff'; ctx.shadowColor = '#9ff6ff'; ctx.shadowBlur = 10; ctx.fillRect(-6 * dpr, -6 * dpr, 12 * dpr, 12 * dpr); ctx.restore(); }
    // 찾은 곳 (번호)
    ctx.font = `bold ${12 * dpr}px sans-serif`;
    this.res.forEach((r, k) => { if (r.floor !== i || r.kind === 'world') return; const x = X(r.gx), y = Y(r.gz); ctx.fillStyle = '#ffd89a'; ctx.beginPath(); ctx.arc(x, y, 8 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#10121e'; ctx.fillText(`${k + 1}`, x, y + 4 * dpr); });
    // 나 (이 층이면): 자리 + 바라보는 쪽
    if (i === ind.cur) {
      const p = g.player.pos;
      const [gx, gz] = ind.grid(p.x, p.z);
      const fx = Math.sin(g.player.yaw), fz = Math.cos(g.player.yaw);
      const V = B.V, ax = fx * V.ex[0] + fz * V.ex[1], az = fx * V.ez[0] + fz * V.ez[1];
      ctx.save();
      ctx.translate(X(gx), Y(gz));
      ctx.rotate(Math.atan2(-ax, az));
      ctx.fillStyle = '#ff7a52'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(0, 10 * dpr); ctx.lineTo(7 * dpr, -7 * dpr); ctx.lineTo(0, -2 * dpr); ctx.lineTo(-7 * dpr, -7 * dpr); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // 북쪽 (세계 −z) 화살표
    {
      const V = B.V, nx = -V.ex[1], nz = -V.ez[1]; // 세계 (0,−1) 의 틀 성분
      const x = W - 28 * dpr, y = 28 * dpr, a = Math.atan2(nx, nz);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-a + Math.PI);
      ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.moveTo(0, -14 * dpr); ctx.lineTo(6 * dpr, 6 * dpr); ctx.lineTo(-6 * dpr, 6 * dpr); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#f3efe6'; ctx.font = `${11 * dpr}px sans-serif`; ctx.fillText('북', x, y + 22 * dpr);
    }
    // 층 이름
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(243,239,230,0.9)';
    ctx.font = `${15 * dpr}px 'Noto Sans KR', sans-serif`;
    const Z = B.zones[F.zone], org = Z && Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
    ctx.fillText(`${F.label}층 · ${FUSE[F.use] ? FUSE[F.use].name : F.use}${org ? ` · ${org.name}` : ''}`, 14 * dpr, 24 * dpr);
    ctx.font = `${11 * dpr}px sans-serif`;
    ctx.fillStyle = 'rgba(243,239,230,0.55)';
    ctx.fillText('정문 쪽이 아래 · ⇅ 승강기 ≡ 계단 ⇲ 문 ₩ 계산 출 출근 면 면접 i 안내 ● 사람(노랑: 일하는 이)', 14 * dpr, H - 12 * dpr);
  }
  click(sx, sy) {
    const T = this.T, cur = this.cur;
    if (!T || !cur) return;
    const B = cur.B, pl = cur.indoor.plan(this.sel);
    if (!pl) return;
    const gx = (sx - T.W / 2) / T.s + T.cxm + T.ox, gz = (sy - T.H / 2) / T.s + T.czm + T.oz;
    // 시설 먼저 (가까우면)
    let best = null, bd = 0.9;
    for (const q of pl.fix) { const d = Math.hypot(q.x - gx, q.z - gz) - Math.max(q.w, q.d) / 2; if (d < bd && FIX[q.t]) { bd = d; best = q; } }
    const a = Math.floor(gx - B.G.ox), b = Math.floor(gz - B.G.oz);
    const k = b * B.G.gw + a;
    const R = a >= 0 && b >= 0 && a < B.G.gw && b < B.G.gh && pl.L.room[k] ? pl.L.rooms[pl.L.room[k] - 1] : null;
    this.pick = R ? { room: R.id, fix: best ? best.id : null, gx, gz } : null;
    this.draw();
  }
  _info() {
    const box = this.el.querySelector('.imap-info');
    const cur = this.cur, g = this.game;
    if (!this.pick) {
      const gd = g.guide;
      box.innerHTML = gd.goal ? `<b>안내 중</b><small>${esc(gd.text)}</small>` : '<small>방이나 시설을 누르면 그곳으로 길을 알려 줘요</small>';
      return;
    }
    const pl = cur.indoor.plan(this.sel), R = pl.L.rooms[this.pick.room];
    const q = this.pick.fix ? pl.fix.find((f) => f.id === this.pick.fix) : null;
    const acc = ROOMS[R.type] ? ROOMS[R.type].acc : 'public';
    const F = cur.B.floors[this.sel];
    const html = `<b>${esc(q ? FIX[q.t].name : R.name)}</b><small>${F.label}층 · ${esc(R.name)} · ${acc === 'staff' ? '직원' : acc === 'private' ? '사는 이·묵는 이' : '누구나'} · ${R.n} m²</small><button class="btn" data-guide>여기로 안내</button>`;
    if (box.innerHTML !== html) {
      box.innerHTML = html;
      box.querySelector('[data-guide]').addEventListener('click', () => {
        if (q) g.guide.to({ floor: this.sel, gx: q.ax, gz: q.az, label: FIX[q.t].name });
        else g.guide.toRoom(this.sel, R.id, `${F.label}층 ${R.name}`);
        this._floors(); this.draw();
      });
    }
  }
}
export { LINKNAME, hex };
