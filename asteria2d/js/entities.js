// 아스테리아 1부 — 엔티티 (사람, 잔향, 퍼즐 장치, 보스)
'use strict';

const ET = {};
let _eid = 0;
function makeEnt(type, tx, ty, props = {}) {
  const e = Object.assign({ type, x: tx + 0.5, y: ty + 0.5, r: 0.4 }, props);
  if (props.exact) { e.x = tx; e.y = ty; }
  if (!e.id) e.id = type + ':' + tx + ',' + ty + ':' + (_eid++ % 1);
  const d = ET[type];
  if (d && d.init) d.init(e);
  return e;
}
const sx = e => e.x * TS, sy = e => e.y * TS;
const near = (e, r = 1.3) => dist(e.x, e.y, P.x, P.y) < r;
function nameTag(e, text, col = '#fff') {
  ctx.font = '600 11px "IBM Plex Sans KR", sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 10;
  rrect(sx(e) - w / 2, sy(e) - 40, w, 16, 6, 'rgba(26,22,48,0.72)');
  ctx.fillStyle = col; ctx.fillText(text, sx(e), sy(e) - 28);
}

// ---------- 사람 ----------
ET.npc = {
  init(e) { e.hx = e.x; e.hy = e.y; e.wt = rand(2); e.vx = 0; e.vy = 0; e.solid = true; e.r = 0.35; e.fx = 0; e.fy = 1; },
  update(e, dt) {
    if (e.follow) return;
    if (e.wander && !G.lock) {
      e.wt -= dt;
      if (e.wt <= 0) {
        e.wt = rand(1.5, 4);
        if (Math.random() < 0.5) { e.vx = 0; e.vy = 0; }
        else { const a = rand(Math.PI * 2); e.vx = Math.cos(a) * 0.9; e.vy = Math.sin(a) * 0.9; }
      }
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      if (dist(nx, ny, e.hx, e.hy) < e.wander && !blockedFor(nx, ny, 0.3)) { e.x = nx; e.y = ny; if (e.vx || e.vy) { e.fx = Math.sign(e.vx); e.fy = Math.sign(e.vy); } }
      else { e.vx = -e.vx; e.vy = -e.vy; }
    }
    if (near(e, 2.5)) { const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1; e.fx = dx / l; e.fy = dy / l; }
  },
  draw(e) {
    drawPerson(sx(e), sy(e), Object.assign({ moving: !!(e.vx || e.vy), fx: e.fx, fy: e.fy }, e.look || {}));
    if (e.bubble) { ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(e.bubble, sx(e), sy(e) - 30); }
    if (near(e, 2.2) && e.name) nameTag(e, e.name, e.shop ? '#ffe08a' : '#fff');
  },
  interact(e) { if (e.talk) TALK[e.talk](e); },
  prompt: e => e.shop ? '말 걸기 · 상점' : '말 걸기',
};

ET.sign = {
  init(e) { e.solid = true; e.r = 0.3; },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 10, 8);
    ctx.fillStyle = '#7a5636'; ctx.fillRect(x - 2, y - 2, 4, 12);
    rrect(x - 11, y - 14, 22, 13, 2, e.color || '#c79a62');
    ctx.fillStyle = '#5b3d22'; ctx.fillRect(x - 7, y - 10, 14, 1.5); ctx.fillRect(x - 7, y - 6, 10, 1.5);
  },
  interact(e) { runScript(async () => { for (const t of [].concat(e.text)) await say(e.title || '안내판', t); }); },
  prompt: () => '읽기',
};

ET.poster = Object.assign({}, ET.sign, {
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 14, y - 18, 28, 26);
    ctx.fillStyle = '#efe2c4'; ctx.fillRect(x - 10, y - 15, 20, 20);
    ctx.fillStyle = '#9a2b2b'; ctx.fillRect(x - 8, y - 13, 16, 3);
    circle(x, y - 3, 4, '#7a6a5a');
  },
  interact(e) { TALK[e.talk](e); },
});

ET.chest = {
  init(e) { e.solid = true; e.r = 0.4; e.open = isDone(e.id); },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 9, 12);
    rrect(x - 12, y - 8, 24, 16, 3, e.open ? '#6b4a2e' : '#8f5f34');
    ctx.fillStyle = '#d8b25a'; ctx.fillRect(x - 12, y - 2, 24, 3); ctx.fillRect(x - 2, y - 4, 4, 6);
    if (!e.open) { ctx.globalAlpha = 0.4 + Math.sin(G.t * 3) * 0.2; circle(x, y - 12, 3, '#fff6c8'); ctx.globalAlpha = 1; }
  },
  interact(e) {
    if (e.open) return;
    e.open = true; markDone(e.id); sfx('open');
    if (e.weapon) giveWeapon(e.weapon);
    if (e.item) give(e.item, e.n || 1);
    if (e.coins) addCoins(e.coins);
    if (e.onOpen) e.onOpen(e);
  },
  prompt: e => e.open ? null : '열기',
};

// 수집물 (쪽지, 비문, 문서)
ET.collect = {
  init(e) { e.taken = isDone(e.id); },
  draw(e) {
    if (e.taken) return;
    const x = sx(e), y = sy(e) + Math.sin(G.t * 2 + e.x) * 2;
    ctx.globalAlpha = 0.35; circle(x, y, 12, '#fff3b0'); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.15);
    ctx.fillStyle = '#f6ecd2'; ctx.fillRect(-7, -9, 14, 18);
    ctx.fillStyle = '#8a7a5a'; for (let i = 0; i < 4; i++) ctx.fillRect(-5, -6 + i * 4, 10 - (i % 2) * 3, 1.2);
    ctx.restore();
  },
  interact(e) {
    if (e.taken) return;
    e.taken = true; markDone(e.id);
    addJournal(e.key);
  },
  prompt: e => e.taken ? null : '살펴보기',
};

// 채집 (덤불, 약초, 버섯)
ET.forage = {
  init(e) { e.cd = 0; e.solid = false; },
  update(e, dt) { if (e.cd > 0) e.cd -= dt; },
  draw(e) {
    const x = sx(e), y = sy(e);
    const ready = e.cd <= 0;
    const k = e.item;
    if (k === 'berry' || k === 'apple') {
      circle(x, y + 2, 11, '#3f8a46'); circle(x - 5, y - 3, 8, '#4fa055'); circle(x + 6, y - 2, 7, '#4fa055');
      if (ready) { const c = k === 'berry' ? '#ff5a7a' : '#ff9a3a'; circle(x - 4, y - 2, 2.6, c); circle(x + 4, y + 2, 2.6, c); circle(x + 1, y - 6, 2.6, c); }
    } else if (k === 'mushroom') {
      if (ready) { ctx.fillStyle = '#efe6d4'; ctx.fillRect(x - 2, y - 2, 4, 8); circle(x, y - 3, 7, '#c6f06a'); ctx.globalAlpha = 0.4; circle(x, y - 3, 11, '#c6f06a'); ctx.globalAlpha = 1; }
      else { ctx.fillStyle = '#5e5a3a'; ctx.fillRect(x - 3, y + 2, 6, 3); }
    } else if (k === 'pepper') {
      circle(x, y + 3, 9, '#5a8a3a');
      if (ready) { ctx.fillStyle = '#ff4a2a'; ctx.beginPath(); ctx.ellipse(x - 3, y - 1, 2.5, 5, 0.4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 4, y, 2.5, 5, -0.4, 0, 7); ctx.fill(); }
    } else if (k === 'crate' || k === 'pantry') {
      shadow(x, y + 10, 12);
      rrect(x - 11, y - 10, 22, 20, 2, '#a5774a'); ctx.strokeStyle = '#7a5434'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 9, 20, 18);
      if (ready) { circle(x - 4, y - 10, 4, '#ff8a3a'); circle(x + 4, y - 11, 4, '#e6c870'); }
    } else {
      // 약초
      ctx.strokeStyle = '#3e8a4a'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 2, y + 8); ctx.quadraticCurveTo(x + i * 4, y, x + i * 5, y - (ready ? 8 : 2)); ctx.stroke(); }
      if (ready) { ctx.globalAlpha = 0.6 + Math.sin(G.t * 3 + e.x) * 0.3; circle(x, y - 6, 3, '#bff7ff'); ctx.globalAlpha = 1; }
    }
  },
  interact(e) {
    if (e.cd > 0) { toast('아직 다시 자라지 않았다'); return; }
    const n = e.n || 1;
    if (e.give) { for (const [k, c] of e.give) give(k, c); }
    else give(e.item, n);
    e.cd = e.regrow || 120;
    burst(e.x, e.y, 6, '#bff7a0', 2, 0.4);
  },
  prompt: e => e.cd > 0 ? null : (e.item === 'pantry' ? '재료 꺼내기' : '채집'),
};

// 문, 계단, 입구 (밟으면 이동)
ET.warp = {
  init(e) { e.cool = 0; },
  update(e, dt) {
    if (e.cool > 0) { e.cool -= dt; return; }
    if (G.lock || G.mapCool > 0) return;
    if (dist(e.x, e.y, P.x, P.y) < (e.rad || 0.6)) {
      if (e.cond && !e.cond()) {
        e.cool = 2.5;
        if (e.locked) runScript(async () => { await say(e.lockedWho || '렌', typeof e.locked === 'function' ? e.locked() : e.locked); });
        P.x -= P.fx * 0.6; P.y -= P.fy * 0.6;
        return;
      }
      goMap(e.to, e.tx, e.ty, e.face);
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.look === 'stairs') {
      ctx.fillStyle = '#3a3040'; ctx.fillRect(x - 14, y - 14, 28, 28);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#8a7a6a' : '#a8987a'; ctx.fillRect(x - 12, y - 12 + i * 6, 24, 5); }
    } else if (e.look === 'cave') {
      ellipse(x, y, 16, 13, '#1a1418'); ellipse(x, y + 4, 13, 8, '#2a2026');
    } else if (e.look === 'gate') {
      const open = !e.cond || e.cond();
      ctx.fillStyle = open ? 'rgba(255,240,180,0.25)' : '#5a4a3a'; ctx.fillRect(x - 16, y - 16, 32, 32);
      if (!open) { ctx.fillStyle = '#8a7a5a'; for (let i = -12; i <= 12; i += 6) ctx.fillRect(x + i - 1, y - 16, 3, 32); }
    } else if (e.look === 'arch') {
      ctx.fillStyle = '#d9cfb8'; ctx.fillRect(x - 18, y - 22, 6, 30); ctx.fillRect(x + 12, y - 22, 6, 30);
      ctx.fillRect(x - 18, y - 26, 36, 6);
      ctx.globalAlpha = 0.25 + Math.sin(G.t * 2) * 0.1; ctx.fillStyle = '#9ff'; ctx.fillRect(x - 12, y - 20, 24, 28); ctx.globalAlpha = 1;
    } else if (e.look === 'door') {
      ctx.fillStyle = '#6b4630'; ctx.fillRect(x - 12, y - 16, 24, 30); ctx.fillStyle = '#d8b25a'; circle(x + 7, y, 2, '#d8b25a');
    } else if (e.look === 'lab') {
      ellipse(x, y + 6, 18, 8, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = '#4c5f7a'; ctx.beginPath(); ctx.moveTo(x - 18, y + 8); ctx.lineTo(x, y - 20); ctx.lineTo(x + 18, y + 8); ctx.closePath(); ctx.fill();
      const lit = isDone('lab:' + e.lab);
      ctx.fillStyle = lit ? '#ffd27a' : '#7ff0ff'; ctx.globalAlpha = 0.6 + Math.sin(G.t * 3) * 0.3;
      ctx.beginPath(); ctx.moveTo(x - 7, y + 6); ctx.lineTo(x, y - 8); ctx.lineTo(x + 7, y + 6); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (e.label && near(e, 3)) nameTag(e, e.label, '#bff');
  },
};

// 화로, 모닥불, 부엌 화덕
ET.fire = {
  init(e) { e.solid = true; e.r = 0.45; },
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.look === 'hearth') { rrect(x - 16, y - 18, 32, 30, 4, '#7a5a50'); ctx.fillStyle = '#2a1a1a'; ctx.fillRect(x - 10, y - 8, 20, 16); }
    else { ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 10, y + 2, 20, 4); ctx.fillRect(x - 8, y - 1, 16, 3); }
    const f = Math.sin(G.t * 12) * 2;
    ctx.globalAlpha = 0.25; circle(x, y, 26 + f, '#ffb35a'); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(x - 7, y + 3); ctx.quadraticCurveTo(x, y - 18 - f, x + 7, y + 3); ctx.fill();
    ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.moveTo(x - 4, y + 3); ctx.quadraticCurveTo(x, y - 9 - f, x + 4, y + 3); ctx.fill();
    if (Math.random() < 0.1) Parts.push({ x: e.x + rand(-0.2, 0.2), y: e.y - 0.3, vx: rand(-0.2, 0.2), vy: -1, life: 0.8, max: 0.8, c: '#ffb35a', size: 2, g: 0 });
  },
  interact(e) { openCook(e); },
  prompt: () => '요리하기',
  warm: 4,
};

// 관측탑
ET.tower = {
  init(e) { e.solid = true; e.r = 0.7; e.lit = isDone(e.id); },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 14, 22);
    ctx.fillStyle = '#7a6a8a'; ctx.beginPath(); ctx.moveTo(x - 16, y + 12); ctx.lineTo(x - 9, y - 70); ctx.lineTo(x + 9, y - 70); ctx.lineTo(x + 16, y + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a4a6a'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 12 + i * 0.8, y + 4 - i * 13, 24 - i * 1.6, 3);
    ctx.fillStyle = '#a7782f'; ctx.fillRect(x - 3, y - 64, 6, 74); // 사다리
    ctx.fillStyle = '#3a2f4a'; ctx.fillRect(x - 15, y - 78, 30, 9);
    const c = e.lit ? '#7ff0ff' : '#ff8f5a';
    ctx.globalAlpha = 0.5 + Math.sin(G.t * 2) * 0.25; circle(x, y - 86, 7, c); ctx.globalAlpha = 0.2; circle(x, y - 86, 16, c); ctx.globalAlpha = 1;
    if (P.onTower === e) { drawPerson(x, y - 84, Object.assign({ fx: P.fx, fy: P.fy }, REN_LOOK())); }
  },
  interact(e) { climbTower(e); },
  prompt: e => P.onTower === e ? '내려가기' : '오르기',
};

// 활공 (탑 위 등) 같은 정적 장식
ET.deco = {
  init(e) { if (e.solid === undefined) e.solid = ['table', 'bed', 'barrel', 'statue', 'stall', 'cart_d', 'house', 'tent', 'altar', 'bench'].includes(e.kind); e.r = e.r || 0.45; },
  draw(e) {
    const x = sx(e), y = sy(e), k = e.kind;
    if (k === 'table') { shadow(x, y + 10, 16); rrect(x - 16, y - 8, 32, 16, 3, '#9a6a42'); if (e.bread) { ellipse(x - 5, y - 2, 6, 4, '#d9a055'); } if (e.cups) { circle(x + 6, y - 2, 3, '#eee'); } }
    else if (k === 'bed') { rrect(x - 12, y - 16, 24, 32, 3, '#7a5a42'); rrect(x - 10, y - 14, 20, 8, 3, '#f2efe8'); rrect(x - 10, y - 4, 20, 18, 2, e.c || '#4a7ab8'); }
    else if (k === 'barrel') { shadow(x, y + 10, 10); rrect(x - 9, y - 11, 18, 22, 6, '#8a5a34'); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 9, y - 5, 18, 2); ctx.fillRect(x - 9, y + 3, 18, 2); }
    else if (k === 'lamp') {
      ctx.fillStyle = '#3a3040'; ctx.fillRect(x - 1.5, y - 22, 3, 30);
      const on = !G.lampOff;
      if (on) { ctx.globalAlpha = 0.18; circle(x, y - 24, 22, '#ffe7a0'); ctx.globalAlpha = 1; }
      circle(x, y - 24, 5, on ? '#ffe7a0' : '#55505a');
    }
    else if (k === 'flowerbed') { ellipse(x, y, 15, 9, '#5a8a3a'); for (let i = 0; i < 6; i++) circle(x + Math.cos(i) * 9, y + Math.sin(i * 2) * 5, 2.5, ['#ff7ab0', '#ffd45a', '#fff'][i % 3]); }
    else if (k === 'statue') { shadow(x, y + 12, 12); rrect(x - 10, y - 2, 20, 12, 2, '#bcb4a6'); drawPerson(x, y - 6, { cloak: '#c8c0b4', body: '#d4ccc0', skin: '#d4ccc0', hair: '#bcb4a6' }); }
    else if (k === 'stall') { shadow(x, y + 12, 18); rrect(x - 18, y - 6, 36, 16, 2, '#9a6a42'); ctx.fillStyle = e.c || '#e85a5a'; ctx.fillRect(x - 20, y - 22, 40, 10); ctx.fillStyle = '#fff'; for (let i = -20; i < 20; i += 10) ctx.fillRect(x + i, y - 22, 5, 10); }
    else if (k === 'house') { shadow(x, y + 30, 40); ctx.fillStyle = e.wall || '#e8dcc4'; ctx.fillRect(x - 40, y - 20, 80, 50); ctx.fillStyle = e.roof || '#c4665a'; ctx.beginPath(); ctx.moveTo(x - 46, y - 18); ctx.lineTo(x, y - 52); ctx.lineTo(x + 46, y - 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6b4630'; ctx.fillRect(x - 7, y + 8, 14, 22); ctx.fillStyle = G.night > 0.4 && !e.dark ? '#ffe08a' : '#8ab'; ctx.fillRect(x - 30, y - 6, 12, 10); ctx.fillRect(x + 18, y - 6, 12, 10); }
    else if (k === 'tent') { shadow(x, y + 10, 18); ctx.fillStyle = e.c || '#c8a46a'; ctx.beginPath(); ctx.moveTo(x - 18, y + 10); ctx.lineTo(x, y - 16); ctx.lineTo(x + 18, y + 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.moveTo(x - 4, y + 10); ctx.lineTo(x, y - 4); ctx.lineTo(x + 4, y + 10); ctx.fill(); }
    else if (k === 'window') { ctx.fillStyle = '#2a3a5a'; ctx.fillRect(x - 12, y - 14, 24, 20); ctx.fillStyle = '#9fd0ff'; ctx.globalAlpha = 0.6; ctx.fillRect(x - 10, y - 12, 9, 16); ctx.fillRect(x + 1, y - 12, 9, 16); ctx.globalAlpha = 1; }
    else if (k === 'altar') { shadow(x, y + 10, 16); rrect(x - 16, y - 8, 32, 18, 3, '#d8d0c0'); ctx.fillStyle = '#c9a85a'; ctx.fillRect(x - 16, y - 8, 32, 3); }
    else if (k === 'bench') { shadow(x, y + 6, 14); ctx.fillStyle = '#8a6a42'; ctx.fillRect(x - 14, y - 4, 28, 6); ctx.fillRect(x - 12, y + 2, 3, 5); ctx.fillRect(x + 9, y + 2, 3, 5); }
    else if (k === 'light') { // 먼 도시 불빛
      if (G.f[e.flagOff]) return;
      ctx.globalAlpha = 0.3 + Math.sin(G.t * 1.5 + e.x) * 0.1; circle(x, y, 26, '#ffd27a'); ctx.globalAlpha = 1; circle(x, y, 5, '#fff2c0');
    }
    else if (k === 'boat') { ellipse(x, y, 18, 7, '#7a4a2a'); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 26); ctx.lineTo(x + 12, y - 6); ctx.closePath(); ctx.fill(); }
    else if (k === 'festival') { if (!G.f[e.need]) return; for (let i = 0; i < 5; i++) { const c = ['#ff7ab0', '#ffd45a', '#7ff0ff', '#a0ff8a', '#ff9a5a'][i]; ctx.globalAlpha = 0.6 + Math.sin(G.t * 3 + i) * 0.3; circle(x - 40 + i * 20, y - 20 + Math.sin(G.t * 2 + i) * 3, 4, c); } ctx.globalAlpha = 1; ctx.strokeStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(x - 44, y - 22); ctx.quadraticCurveTo(x, y - 8, x + 44, y - 22); ctx.stroke(); }
    else if (k === 'rubble') { circle(x - 6, y + 2, 6, '#7a6a62'); circle(x + 5, y, 7, '#8a7a72'); circle(x, y - 5, 5, '#6a5a52'); }
    else if (k === 'cart_d') { shadow(x, y + 10, 14); rrect(x - 13, y - 8, 26, 14, 2, '#6a5a52'); circle(x - 8, y + 8, 4, '#333'); circle(x + 8, y + 8, 4, '#333'); }
    else if (k === 'snowman') { circle(x, y + 4, 9, '#fff'); circle(x, y - 8, 6, '#fff'); ctx.fillStyle = '#f80'; ctx.fillRect(x, y - 9, 5, 2); }
  },
};

// ---------- 퍼즐 장치 ----------
// 금속 상자 / 광차 / 도관 (인력 룬 대상)
ET.crate = {
  init(e) { e.metal = true; e.solid = true; e.r = 0.45; e.hx = e.x; e.hy = e.y; },
  update(e, dt) {
    if (P.holding === e) {
      const tx = P.x + P.hold.x, ty = P.y + P.hold.y;
      const dx = tx - e.x, dy = ty - e.y;
      const sp = Math.min(1, dt * 10);
      const nx = e.x + dx * sp, ny = e.y + dy * sp;
      if (!crateBlocked(nx, e.y, e)) e.x = nx;
      if (!crateBlocked(e.x, ny, e)) e.y = ny;
      if (Math.random() < 0.3) Parts.push({ x: e.x + rand(-0.4, 0.4), y: e.y + rand(-0.4, 0.4), vx: 0, vy: -0.5, life: 0.5, max: 0.5, c: '#ff5ab0', size: 2, g: 0 });
    } else if (!e.held) {
      // 떠 있다가 놓이면 그 자리에 떨어진다. 바닥이 없으면 원래 자리로
      const t = tileAt(Math.floor(e.x), Math.floor(e.y));
      if ((TD[t].chasm || TD[t].deep) && !platformAt(e.x, e.y)) {
        burst(e.x, e.y, 8, '#aaa', 2, 0.4);
        e.x = e.hx; e.y = e.hy; toast('상자가 떨어져서 처음 자리로 돌아왔다');
      }
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e), held = P.holding === e;
    const lift = held ? 6 + Math.sin(G.t * 6) * 2 : 0;
    shadow(x, y + 12, 13);
    if (held) { ctx.globalAlpha = 0.35; circle(x, y - lift, 22, '#ff5ab0'); ctx.globalAlpha = 1; }
    if (e.look === 'cart') {
      rrect(x - 14, y - 10 - lift, 28, 18, 3, '#6c6a70'); ctx.fillStyle = '#4a4850'; ctx.fillRect(x - 14, y - 4 - lift, 28, 3);
      circle(x - 9, y + 9 - lift, 4, '#2a2830'); circle(x + 9, y + 9 - lift, 4, '#2a2830');
      ctx.fillStyle = '#5a4a40'; ctx.fillRect(x - 10, y - 14 - lift, 20, 5);
    } else if (e.look === 'conduit') {
      rrect(x - 12, y - 12 - lift, 24, 24, 4, '#b88a3a'); circle(x, y - lift, 6, '#7ff0ff');
    } else {
      rrect(x - 13, y - 13 - lift, 26, 26, 3, '#7a7e88'); ctx.strokeStyle = '#4a4e58'; ctx.lineWidth = 2; ctx.strokeRect(x - 11, y - 11 - lift, 22, 22);
      ctx.beginPath(); ctx.moveTo(x - 11, y - 11 - lift); ctx.lineTo(x + 11, y + 11 - lift); ctx.moveTo(x + 11, y - 11 - lift); ctx.lineTo(x - 11, y + 11 - lift); ctx.stroke();
    }
  },
};

// 누름판
ET.plate = {
  init(e) { e.on = false; },
  update(e) {
    let on = dist(P.x, P.y, e.x, e.y) < 0.55 && !e.crateOnly;
    for (const o of G.map.ents) if (o.type === 'crate' && dist(o.x, o.y, e.x, e.y) < 0.6 && (!e.need || o.look === e.need)) on = true;
    if (on && !e.on) { sfx('blip'); if (e.onPress) e.onPress(e); }
    e.on = on;
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    rrect(x - 14, y - 14, 28, 28, 4, e.on ? '#5a8a6a' : '#5a5a6a');
    rrect(x - 10, y - 10 - (e.on ? 0 : 2), 20, 20, 3, e.on ? '#8fe3a0' : (e.need === 'conduit' ? '#c8a050' : '#9a9aae'));
  },
};

// 철문 / 봉인문
ET.gate = {
  init(e) { e.solid = true; e.r = 0.5; e.openT = 0; },
  update(e, dt) {
    const open = e.open || (e.cond && e.cond());
    if (open && !e.isOpen) { e.isOpen = true; sfx('open'); burst(e.x, e.y, 10, e.look === 'seal' ? '#7ff0ff' : '#aaa', 2, 0.5); if (e.onOpen) e.onOpen(e); }
    if (!open && e.isOpen && e.cond) { e.isOpen = false; }
    e.solid = !e.isOpen;
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.isOpen) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x - 16, y - 16, 32, 32); return; }
    if (e.look === 'seal') {
      rrect(x - 16, y - 16, 32, 32, 3, '#4a4a6a');
      ctx.strokeStyle = '#7ff0ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + Math.sin(G.t * 3) * 0.3;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke(); ctx.globalAlpha = 1;
      if (e.sockets) { for (let i = 0; i < e.sockets.length; i++) circle(x - 12 + i * 8, y + 12, 2.5, G.runes[e.sockets[i]] ? '#7ff0ff' : '#333'); }
    } else {
      ctx.fillStyle = '#5a5e68'; ctx.fillRect(x - 16, y - 16, 32, 32);
      ctx.fillStyle = '#8a8e98'; for (let i = -12; i <= 12; i += 6) ctx.fillRect(x + i - 1.5, y - 16, 3, 32);
    }
  },
};

// 회전 칼날 (정체 룬으로 멈춤)
ET.spinner = {
  init(e) { e.a = 0; e.frozen = 0; e.stasis = true; e.len = e.len || 1.6; },
  update(e, dt) {
    if (e.frozen > 0) { e.frozen -= dt; return; }
    e.a += dt * (e.speed || 2.4);
    // 날 끝과 플레이어 거리
    for (let k = 0; k < 2; k++) {
      const a = e.a + k * Math.PI;
      for (let s = 0.3; s <= e.len; s += 0.3) {
        const bx = e.x + Math.cos(a) * s, by = e.y + Math.sin(a) * s;
        if (dist(bx, by, P.x, P.y) < 0.35) { hurtPlayer(2, e.x, e.y); return; }
      }
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    circle(x, y, 8, '#5a5060');
    ctx.strokeStyle = e.frozen > 0 ? '#ffd27a' : '#d8d0e0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const a = e.a + k * Math.PI;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * e.len * TS, y + Math.sin(a) * e.len * TS); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (e.frozen > 0) frozenFx(e);
  },
  onStasis(e) { e.frozen = 5; },
};

// 룬 받침대
ET.pedestal = {
  init(e) { e.solid = true; e.r = 0.4; },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 10, 12);
    rrect(x - 10, y - 4, 20, 14, 3, '#8a8aa0');
    if (!G.runes[e.rune]) {
      const b = Math.sin(G.t * 2) * 3;
      ctx.globalAlpha = 0.4; circle(x, y - 14 + b, 14, RUNES[e.rune].c); ctx.globalAlpha = 1;
      circle(x, y - 14 + b, 7, RUNES[e.rune].c);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(RUNES[e.rune].glyph, x, y - 11 + b);
    }
  },
  interact(e) { if (!G.runes[e.rune]) learnRune(e.rune, e); },
  prompt: e => G.runes[e.rune] ? null : '룬 받기',
};

// 레버
ET.lever = {
  init(e) { e.solid = true; e.r = 0.3; e.state = e.state || 0; e.cd = 0; },
  update(e, dt) { if (e.cd > 0) e.cd -= dt; },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 8, 9);
    rrect(x - 8, y - 2, 16, 10, 2, e.look === 'arm' ? '#b88a3a' : '#6a6a7a');
    ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 3;
    const a = (e.state % 2 ? 0.6 : -0.6) - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.stroke();
    circle(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 3.5, e.c || '#e85a5a');
    if (e.label && near(e, 2.4)) nameTag(e, e.label, '#ffe08a');
  },
  interact(e) { if (e.cd > 0) return; e.cd = 0.6; e.state++; sfx('blip'); if (e.onUse) e.onUse(e); },
  prompt: e => e.verb || '당기기',
};

// 중계탑
ET.pylon = {
  init(e) { e.solid = true; e.r = 0.45; e.on = isDone(e.id); },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 12, 12);
    ctx.fillStyle = '#7a6a50'; ctx.fillRect(x - 8, y - 30, 16, 42);
    ctx.fillStyle = '#b88a3a'; ctx.fillRect(x - 10, y - 34, 20, 6); ctx.fillRect(x - 10, y + 6, 20, 6);
    const c = e.on ? '#7ff0ff' : '#3a4a5a';
    circle(x, y - 16, 6, c);
    if (e.on) { ctx.globalAlpha = 0.3 + Math.sin(G.t * 4) * 0.15; circle(x, y - 16, 16, c); ctx.globalAlpha = 1; }
  },
  interact(e) {
    if (e.on) return;
    if (e.cond && !e.cond()) { runScript(async () => { await say('렌', e.hint); }); return; }
    e.on = true; markDone(e.id); sfx('chime'); burst(e.x, e.y - 0.5, 16, '#7ff0ff', 3, 0.7);
    if (e.onOn) e.onOn(e);
  },
  prompt: e => e.on ? null : '중계탑 켜기',
};

// 부서지는 결정 / 잔해 (파열 룬)
ET.crust = {
  init(e) { e.solid = true; e.r = 0.5; e.burstable = true; if (isDone(e.id)) e.dead = true; },
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.look === 'salt') {
      ctx.fillStyle = '#f4f8fb'; ctx.strokeStyle = '#b8c8d4'; ctx.lineWidth = 1.5;
      for (const [ox, oy, h] of [[-8, 6, 20], [2, 8, 26], [10, 6, 16], [-2, 0, 14]]) { ctx.beginPath(); ctx.moveTo(x + ox - 5, y + oy); ctx.lineTo(x + ox, y + oy - h); ctx.lineTo(x + ox + 5, y + oy); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if (e.look === 'ice') {
      ctx.globalAlpha = 0.85; rrect(x - 14, y - 16, 28, 30, 4, '#cfefff'); ctx.globalAlpha = 1;
    } else {
      circle(x - 6, y + 3, 9, '#7a6a62'); circle(x + 6, y + 1, 10, '#8a7a72'); circle(x, y - 6, 8, '#6a5a52');
      ctx.strokeStyle = '#3a3030'; ctx.beginPath(); ctx.moveTo(x - 4, y - 8); ctx.lineTo(x + 2, y); ctx.lineTo(x - 2, y + 6); ctx.stroke();
    }
  },
  onBurst(e) { e.dead = true; markDone(e.id); sfx('break'); burst(e.x, e.y, 18, e.look === 'salt' ? '#fff' : '#8a7a72', 4, 0.7, 4); if (e.onBreak) e.onBreak(e); },
};

// 시간이 멈춘 낙엽 발판 (정체 룬)
ET.leaf = {
  init(e) {
    e.frozen = e.fixed ? 1e9 : (e.startFrozen ? 1e9 : 0);
    e.ox = e.x; e.oy = e.y; e.ph = rand(6); e.stasis = true;
    e.dx = e.dx || 0; e.dy = e.dy || 0; // 움직임 폭
  },
  update(e, dt) {
    if (e.frozen > 0) return;
    e.ph += dt * (e.speed || 0.9);
    const k = Math.sin(e.ph);
    e.x = e.ox + e.dx * k; e.y = e.oy + e.dy * k;
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    ellipse(x, y + 18, 14, 4, 'rgba(0,0,0,0.25)');
    ctx.save(); ctx.translate(x, y); ctx.rotate(e.oy * 0.7 + (e.frozen > 0 ? 0 : Math.sin(G.t) * 0.3));
    ctx.fillStyle = e.frozen > 0 ? '#e0a04a' : '#c8782a';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a4a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.restore();
    if (e.frozen > 0 && !e.fixed) frozenFx(e);
  },
  onStasis(e) { if (e.fixed) { toast('이 잎은 이미 시간 속에 단단히 붙들려 있다'); return; } e.frozen = e.frozen > 0 ? 0 : 1e9; },
};

// 허공에 멈춘 빗줄기 벽 (정체 룬으로 풀어준다)
ET.curtain = {
  init(e) { e.stasis = true; e.w = e.w || 1; e.solid = true; e.r = 0.5 * e.w + 0.2; if (isDone(e.id)) e.dead = true; },
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.fillStyle = '#bfe6ff';
    for (let i = 0; i < 24; i++) { const ox = (hash2(i, e.x | 0) - 0.5) * TS * e.w, oy = (hash2(i, 7) - 0.5) * TS * 1.6; ctx.globalAlpha = 0.7; ctx.fillRect(x + ox, y + oy - 4, 2, 7); }
    ctx.globalAlpha = 1;
  },
  onStasis(e) {
    e.dead = true; markDone(e.id); sfx('freeze');
    for (let i = 0; i < 30; i++) Parts.push({ x: e.x + rand(-0.5, 0.5) * e.w, y: e.y + rand(-0.8, 0.8), vx: 0, vy: 6, life: 0.5, max: 0.5, c: '#bfe6ff', size: 2, g: 10 });
    toast('붙잡혀 있던 빗방울이 한꺼번에 떨어졌다');
  },
};

// 파이프 퍼즐 조각
ET.pipe = {
  init(e) { e.solid = true; e.r = 0.5; e.rot = e.rot || 0; e.flow = false; },
  draw(e) {
    const x = sx(e), y = sy(e);
    rrect(x - 15, y - 15, 30, 30, 3, '#4a3a3a');
    const dirs = pipeDirs(e);
    ctx.strokeStyle = e.flow ? '#ff9a3a' : '#8a7a6a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (const [dx, dy] of dirs) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 15, y + dy * 15); ctx.stroke(); }
    ctx.lineCap = 'butt';
    circle(x, y, 5, e.flow ? '#ffd25a' : '#6a5a5a');
    if (e.valve) { ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.strokeRect(x - 15, y - 15, 30, 30); }
  },
  interact(e) { if (e.locked) { toast('기관이 켜진 뒤에는 돌릴 수 없다'); return; } e.rot = (e.rot + 1) % 4; sfx('blip'); updatePipes(); },
  prompt: e => e.valve ? '밸브 돌리기' : '관 돌리기',
};
function pipeDirs(e) {
  const base = { I: [[0, -1], [0, 1]], L: [[0, -1], [1, 0]], T: [[0, -1], [1, 0], [0, 1]] }[e.shape];
  return base.map(([dx, dy]) => { let x = dx, y = dy; for (let i = 0; i < e.rot; i++) { const t = x; x = -y; y = t; } return [x, y]; });
}

// 배수 수문
ET.floodgate = {
  init(e) { e.solid = true; e.r = 0.5; e.metal = e.kind === 'iron'; e.burstable = e.kind === 'jam'; e.fixed = true; },
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.opened) { ctx.fillStyle = '#3a3a44'; ctx.fillRect(x - 16, y - 4, 32, 8); return; }
    rrect(x - 16, y - 16, 32, 32, 2, e.kind === 'iron' ? '#5a5e68' : '#6a5040');
    ctx.fillStyle = e.kind === 'iron' ? '#8a8e98' : '#8a6a50';
    for (let i = -12; i <= 12; i += 8) ctx.fillRect(x + i - 2, y - 16, 4, 32);
    if (e.kind === 'jam') { ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 4, y + 2); ctx.lineTo(x - 4, y + 12); ctx.stroke(); }
    if (near(e, 3)) nameTag(e, e.kind === 'iron' ? '철 수문' : '걸린 수문', '#bff');
  },
  onMagnes(e) { return floodgateOpen(e); },
  onBurst(e) { floodgateOpen(e); },
};

// 룬 사슬 (5장)
ET.chain = {
  init(e) { e.hp = 1; e.hittable = true; e.solid = true; e.r = 0.45; },
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.strokeStyle = '#7ff0ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(e.cx * TS, e.cy * TS); ctx.stroke(); ctx.globalAlpha = 1;
    rrect(x - 8, y - 8, 16, 16, 3, '#5a5a7a'); circle(x, y, 4, '#7ff0ff');
  },
  onHit(e) { if (!G.f.chainsOpen) { toast('지금은 끊을 수 없다'); return false; } e.dead = true; chainCut(e); return true; },
};

// 비문 (5장 번역)
ET.stele = {
  init(e) { e.solid = true; e.r = 0.45; e.read = false; },
  draw(e) {
    const x = sx(e), y = sy(e);
    shadow(x, y + 12, 14);
    rrect(x - 12, y - 24, 24, 36, 4, '#bcb6a8');
    ctx.fillStyle = e.read ? '#7ff0ff' : '#6a6458';
    for (let i = 0; i < 5; i++) ctx.fillRect(x - 7, y - 18 + i * 6, 14 - (i % 2) * 4, 2);
  },
  interact(e) { readStele(e); },
  prompt: e => e.read ? '다시 읽기' : '공명봉으로 읽기',
};

ET.plaque = {
  init(e) { e.solid = true; e.r = 0.4; },
  draw(e) { const x = sx(e), y = sy(e); rrect(x - 14, y - 12, 28, 20, 2, '#b88a3a'); ctx.fillStyle = '#6a4a1a'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 10, y - 9 + i * 3.5, 20 - (i === 4 ? 6 : 0), 1.3); },
  interact(e) { TALK[e.talk](e); },
  prompt: () => '읽기',
};

// 기관 심장부 (수리 지점)
ET.core = {
  init(e) { e.solid = true; e.r = 0.8; },
  draw(e) {
    const x = sx(e), y = sy(e);
    const fixed = G.f[e.flag];
    const pulse = fixed ? Math.sin(G.t * 2) * 0.5 + 0.5 : (Math.sin(G.t * 9) > 0.3 ? 1 : 0.2);
    ctx.globalAlpha = 0.25 * pulse + 0.1; circle(x, y, 40, e.c || '#7ff0ff'); ctx.globalAlpha = 1;
    ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + G.t * (fixed ? 0.3 : 1.5); ctx.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); } ctx.closePath(); ctx.fill();
    circle(x, y, 14, fixed ? (e.c || '#7ff0ff') : '#ff7a6a');
    circle(x, y, 7, '#fff');
  },
  interact(e) { TALK[e.talk](e); },
  prompt: e => G.f[e.flag] ? null : (e.verb || '기관 살피기'),
};

// 의자와 첫 마법사
ET.chair = {
  init(e) { e.solid = true; e.r = 0.8; },
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.globalAlpha = 0.2; circle(x, y, 50, '#7ff0ff'); ctx.globalAlpha = 1;
    rrect(x - 20, y - 34, 40, 48, 6, '#9a7a3a'); rrect(x - 16, y - 30, 32, 26, 4, '#6a5a3a');
    ctx.fillStyle = '#7ff0ff'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 14 + i * 9, y - 28, 2, 22);
    if (!G.f.mageGone) drawPerson(x, y - 10, { cloak: '#5a5a6a', body: '#bcb6a8', skin: '#d8c8b8', hair: '#eeeeee', alpha: G.f.chainsLeft !== undefined ? 0.4 + G.f.chainsLeft / 10 : 1 });
    // 빈 홈
    circle(x + 26, y - 4, 5, G.f.slotOpen ? '#7ff0ff' : '#3a3a4a');
  },
  interact(e) { TALK.chair(e); },
  prompt: () => null,
};

// 분수 (얼었다 녹는다)
ET.fountain = {
  init(e) { e.solid = true; e.r = 1.3; },
  draw(e) {
    const x = sx(e), y = sy(e);
    ellipse(x, y + 6, 46, 26, '#b8ae9a'); ellipse(x, y + 4, 40, 21, G.f.tremor && !G.f.ch1engine ? '#dff4ff' : '#6fb6dd');
    rrect(x - 6, y - 26, 12, 30, 3, '#cfc6b4');
    if (G.f.tremor && !G.f.ch1engine) {
      // 솟은 모양 그대로 얼어붙은 물줄기
      ctx.fillStyle = '#e6f8ff'; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(x - 4, y - 24); ctx.quadraticCurveTo(x - 22, y - 60, x - 30, y - 4); ctx.lineTo(x - 26, y - 4); ctx.quadraticCurveTo(x - 18, y - 50, x, y - 26); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 4, y - 24); ctx.quadraticCurveTo(x + 22, y - 60, x + 30, y - 4); ctx.lineTo(x + 26, y - 4); ctx.quadraticCurveTo(x + 18, y - 50, x, y - 26); ctx.fill();
      ctx.fillRect(x - 3, y - 56, 6, 32); ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(200,240,255,0.8)';
      for (let i = 0; i < 10; i++) { const p = (G.t * 1.2 + i / 10) % 1; const s = i % 2 ? 1 : -1; ctx.fillRect(x + s * p * 28, y - 26 - Math.sin(p * Math.PI) * 30, 3, 3); }
      if (G.rainbow > 0) {
        ctx.globalAlpha = Math.min(1, G.rainbow) * 0.5;
        ['#ff5a5a', '#ffb35a', '#ffee5a', '#7aef7a', '#5ab0ff', '#9a7aff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y + 30, 130 - i * 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
        ctx.globalAlpha = 1;
      }
    }
  },
};

// 물방울 고래 (오프닝)
ET.whale = {
  init(e) { e.ph = 0; e.cx = e.x; e.cy = e.y; },
  update(e, dt) { e.ph += dt * 0.25; e.x = e.cx + Math.cos(e.ph) * 6; e.y = e.cy + Math.sin(e.ph) * 3 - 2; },
  draw(e) {
    if (G.f.tremor && !G.f.ch1engine) return;
    const x = sx(e), y = sy(e) - 60;
    const dir = -Math.sin(e.ph) > 0 ? 1 : -1;
    ellipse(sx(e), sy(e) + 10, 36, 9, 'rgba(60,120,180,0.15)');
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.globalAlpha = 0.55;
    ellipse(0, 0, 36, 16, '#8fd4ff');
    ctx.fillStyle = '#8fd4ff'; ctx.beginPath(); ctx.moveTo(-32, 0); ctx.lineTo(-52, -12 + Math.sin(G.t * 3) * 4); ctx.lineTo(-50, 10 + Math.sin(G.t * 3) * 4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.8; circle(18, -4, 2.5, '#fff');
    for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.5; circle(-10 + i * 9, -6 + (i % 2) * 6, 3, '#d8f4ff'); }
    ctx.restore(); ctx.globalAlpha = 1;
  },
};

// 날아다니는 책
ET.book = {
  init(e) { e.ph = rand(6); e.cx = e.x; e.cy = e.y; e.rad = e.rad || 3; },
  update(e, dt) {
    if (e.caught) return;
    e.ph += dt * (e.flee ? 1.6 : 0.8);
    if (e.flee && near(e, 2.2)) { e.cx += (e.x - P.x) * dt * 1.2; e.cy += (e.y - P.y) * dt * 1.2; }
    if (e.flee) { e.cx = clamp(e.cx, e.minx, e.maxx); e.cy = clamp(e.cy, e.miny, e.maxy); }
    e.x = e.cx + Math.cos(e.ph) * e.rad; e.y = e.cy + Math.sin(e.ph * 1.3) * e.rad * 0.6;
  },
  draw(e) {
    if (e.caught) return;
    const x = sx(e), y = sy(e) - (e.flee ? 0 : 50), f = Math.sin(G.t * 12 + e.ph) * 6;
    if (e.flee) shadow(x, y + 16, 8);
    ctx.fillStyle = e.c || '#a83a3a';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 11, y - 4 + f); ctx.lineTo(x - 11, y + 6 + f); ctx.lineTo(x, y + 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 11, y - 4 + f); ctx.lineTo(x + 11, y + 6 + f); ctx.lineTo(x, y + 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6ecd2'; ctx.fillRect(x - 1, y, 2, 9);
    if (e.flee && near(e, 2.5)) nameTag(e, '도망친 책', '#ffe08a');
  },
  interact(e) { if (e.flee && !e.caught) { e.caught = true; TALK.bookCaught(e); } },
  prompt: e => e.flee && !e.caught ? '붙잡기' : null,
};

// 미라의 부유석
ET.orb = {
  init(e) { e.ph = rand(6); e.cx = e.x; e.cy = e.y; },
  update(e, dt) { if (e.got) return; e.ph += dt; e.x = e.cx + Math.sin(e.ph * 0.7) * 0.6; e.y = e.cy + Math.cos(e.ph * 0.5) * 0.4; },
  draw(e) {
    if (e.got) return;
    const x = sx(e), y = sy(e) - 14 + Math.sin(G.t * 2 + e.ph) * 3;
    shadow(sx(e), sy(e) + 6, 6);
    ctx.globalAlpha = 0.35; circle(x, y, 12, '#c8a0ff'); ctx.globalAlpha = 1;
    circle(x, y, 6, '#b090f0'); circle(x - 2, y - 2, 2, '#fff');
  },
  interact(e) { if (!e.got) { e.got = true; sfx('pick'); TALK.orbGot(e); } },
  prompt: e => e.got ? null : '부유석 잡기',
};

// 떠 있는 섬 (장식)
ET.island = {
  draw(e) {
    const x = sx(e), y = sy(e), b = Math.sin(G.t * 0.6 + e.x) * 4, s = e.s || 1;
    ellipse(x, y + 40 * s, 40 * s, 12 * s, 'rgba(30,40,70,0.18)');
    ctx.save(); ctx.translate(x, y - 50 * s + b); ctx.scale(s, s);
    ctx.fillStyle = '#8a7a6a'; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(10, 30); ctx.lineTo(-4, 40); ctx.lineTo(-16, 24); ctx.closePath(); ctx.fill();
    ellipse(0, 0, 36, 11, '#7cc46a');
    ctx.fillStyle = '#4f9a52'; circle(-12, -8, 9, '#4f9a52'); circle(10, -6, 7, '#5fae5a');
    ctx.fillStyle = '#8fe3e0'; ctx.globalAlpha = 0.6; ctx.fillRect(-2, 30, 3, 14); ctx.globalAlpha = 1;
    ctx.restore();
  },
};

// 기관의 빛기둥 (먼 거리 장식 + 실제 기관 위치)
ET.pillar = {
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.flagOff && G.f[e.flagOff]) return;
    const fixed = e.flag ? G.f[e.flag] : !e.flicker;
    let a = 0.45;
    if (!fixed) a = (Math.sin(G.t * 7 + e.x) > 0.2 ? 0.5 : 0.12) * (0.6 + Math.random() * 0.4);
    const g = ctx.createLinearGradient(x, y - 600, x, y);
    const c = e.c || '127,240,255';
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.7, `rgba(${c},${a * 0.6})`); g.addColorStop(1, `rgba(${c},${a})`);
    ctx.fillStyle = g; ctx.fillRect(x - 10, y - 600, 20, 600);
    ctx.globalAlpha = a; circle(x, y, 16, `rgb(${c})`); ctx.globalAlpha = 1;
  },
};

// 보이지 않는 구역 트리거
ET.trigger = {
  update(e) {
    if (e.fired || G.lock) return;
    if (Math.abs(P.x - e.x) < (e.w || 1) / 2 + 0.2 && Math.abs(P.y - e.y) < (e.h || 1) / 2 + 0.2) {
      if (e.cond && !e.cond()) return;
      if (e.once !== false) e.fired = true;
      e.onEnter(e);
    }
  },
};

// 시계 고리 표시판 (3장)
ET.ringface = {
  init(e) { e.solid = true; e.r = 0.6; },
  draw(e) {
    const x = sx(e), y = sy(e), v = G.rings[e.ring];
    circle(x, y, 18, '#d8c8a0'); circle(x, y, 15, '#f4ecd8');
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; circle(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 1.8, '#6a5a3a'); }
    const a = v * Math.PI / 2 - Math.PI / 2;
    ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; ctx.font = '600 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('고리 ' + (e.ring + 1), x, y + 30);
  },
};

// ---------- 잔향 (적) ----------
const ECHO = {
  beast: { hp: 4, sp: 3.2, dmg: 2, sight: 5.5, range: 0.9, c: '#9a8cff', size: 0.9 },
  human: { hp: 6, sp: 2.3, dmg: 2, sight: 5, range: 1.0, c: '#b0a4ff', size: 1 },
  big: { hp: 16, sp: 1.6, dmg: 4, sight: 6, range: 1.4, c: '#8070e0', size: 1.5 },
  wisp: { hp: 3, sp: 2.6, dmg: 1, sight: 7, range: 5, c: '#a0e8ff', size: 0.7, ranged: true },
};
const TINT = { salt: '#e8f4ff', time: '#ffc880', mine: '#c89a70', frost: '#b8e8ff', ruin: '#c0b0ff' };
ET.echo = {
  init(e) {
    const k = ECHO[e.kind || 'human'];
    e.k = k; e.hp = e.maxhp = Math.round(k.hp * (e.hpMul || 1)); e.state = 'idle'; e.t = 0; e.cd = 0; e.frozen = 0; e.stasis = true;
    e.hittable = true; e.burstable = true; e.hx = e.x; e.hy = e.y; e.r = 0.35 * k.size; e.fx = 0; e.fy = 1; e.flick = 0;
    if (isDone(e.id) && e.unique) e.dead = true;
  },
  update(e, dt) {
    e.flick -= dt;
    if (e.frozen > 0) { e.frozen -= dt; if (e.frozen <= 0 && e.stored) { damageEnt(e, e.stored, P.x, P.y, true); e.stored = 0; } return; }
    if (e.kb) { const nx = e.x + e.kb.x * dt, ny = e.y + e.kb.y * dt; if (!blockedFor(nx, ny, e.r)) { e.x = nx; e.y = ny; } e.kb.t -= dt; if (e.kb.t <= 0) e.kb = null; return; }
    const d = dist(e.x, e.y, P.x, P.y);
    e.t += dt; e.cd -= dt;
    const k = e.k;
    if (G.lock && e.state !== 'idle') { return; }
    if (e.watcher) { updateWatcher(e, dt, d); return; }
    switch (e.state) {
      case 'idle':
        if (d < k.sight && !P.hidden && !G.lock) { e.state = 'notice'; e.t = 0; }
        break;
      case 'notice':
        if (e.t > 0.45) { e.state = 'chase'; e.t = 0; }
        break;
      case 'chase': {
        const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1;
        e.fx = dx / l; e.fy = dy / l;
        if (k.ranged) {
          if (d < 3) moveEnt(e, -e.fx * k.sp * 0.6 * dt, -e.fy * k.sp * 0.6 * dt);
          else if (d > 5) moveEnt(e, e.fx * k.sp * dt, e.fy * k.sp * dt);
          if (e.cd <= 0) { e.cd = 2.2; spawn('proj', e.x, e.y, { exact: true, vx: e.fx * 5, vy: e.fy * 5, dmg: k.dmg, c: e.tint ? TINT[e.tint] : k.c }); }
        } else if (d > k.range) moveEnt(e, e.fx * k.sp * dt, e.fy * k.sp * dt);
        else if (e.cd <= 0) { e.state = 'windup'; e.t = 0; }
        if (d > 11 || (dist(e.x, e.y, e.hx, e.hy) > 14)) { e.state = 'return'; }
        break;
      }
      case 'windup':
        if (e.t > 0.42) {
          e.state = 'chase'; e.cd = 0.9;
          const hx = e.x + e.fx * k.range * 0.7, hy = e.y + e.fy * k.range * 0.7;
          if (dist(hx, hy, P.x, P.y) < 0.75 * k.size + 0.3) hurtPlayer(k.dmg, e.x, e.y);
          sfx('swing');
        }
        break;
      case 'return': {
        const dx = e.hx - e.x, dy = e.hy - e.y, l = Math.hypot(dx, dy);
        if (l < 0.3) { e.state = 'idle'; break; }
        moveEnt(e, dx / l * k.sp * 0.7 * dt, dy / l * k.sp * 0.7 * dt);
        if (d < k.sight * 0.7) e.state = 'chase';
        break;
      }
    }
  },
  draw(e) { drawEcho(e); if (e.frozen > 0) frozenFx(e); },
  onStasis(e) { e.frozen = 5; e.stored = 0; },
};
function updateWatcher(e, dt, d) {
  // 1장: 공격하지 않는 잔향. 렌의 얼굴을 오래 본다.
  if (e.fade) { e.fade -= dt; if (e.fade <= 0) { e.dead = true; markDone(e.id); } return; }
  if (d < 4.2) {
    const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1; e.fx = dx / l; e.fy = dy / l;
    e.stare = (e.stare || 0) + dt;
    if (e.stare > 4.5 && !e.nod) { e.nod = 1; e.fade = 1.6; G.f.watcherNod = true; }
  }
}
function drawEcho(e) {
  const x = sx(e), y = sy(e), k = e.k, s = k.size * (e.scale || 1);
  const c = e.tint ? TINT[e.tint] : k.c;
  const flick = Math.random() < 0.06 ? rand(-3, 3) : 0;
  let alpha = 0.62 + Math.sin(G.t * 5 + e.x) * 0.08;
  if (e.fade) alpha *= e.fade / 1.6;
  ctx.globalAlpha = alpha;
  ellipse(x, y + 9 * s, 9 * s, 3.5 * s, 'rgba(60,40,120,0.3)');
  const wind = e.state === 'windup' ? Math.sin(e.t * 40) * 2 : 0;
  ctx.save(); ctx.translate(x + flick + wind, y);
  ctx.scale(s, s);
  if ((e.kind || 'human') === 'beast') {
    ellipse(0, 0, 13, 8, c);
    circle(e.fx * 10, -4 + e.fy * 3, 6, c);
    ctx.fillStyle = c; ctx.fillRect(-10, 4, 3, 7); ctx.fillRect(7, 4, 3, 7);
    ctx.fillStyle = '#fff'; ctx.fillRect(e.fx * 12 - 1, -6 + e.fy * 3, 2, 2);
  } else if (e.kind === 'wisp') {
    circle(0, -6, 8, c); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-7, -4); ctx.quadraticCurveTo(0, 18 + Math.sin(G.t * 6) * 3, 7, -4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-3, -8, 2, 2); ctx.fillRect(2, -8, 2, 2);
  } else {
    // 사람을 흐릿하게 닮은 형체
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(-8, 9); ctx.lineTo(8, 9); ctx.lineTo(6, -6); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill();
    circle(0, -12, 7, c);
    // 생전의 동작
    const a = e.state === 'idle' ? e.act : null;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    if (a === 'bread') { const m = Math.sin(G.t * 5) * 4; ctx.beginPath(); ctx.moveTo(6, -2 + m); ctx.lineTo(14, -2 + m); ctx.stroke(); ellipse(10, 6, 6, 3, 'rgba(255,220,160,0.6)'); }
    else if (a === 'window') { /* 위를 본다 */ }
    else if (a === 'pray') { ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(0, -8); ctx.lineTo(2, -4); ctx.stroke(); }
    else if (a === 'dig') { const m = Math.sin(G.t * 4) * 0.6; ctx.save(); ctx.rotate(m); ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(14, -14); ctx.moveTo(10, -18); ctx.lineTo(18, -10); ctx.stroke(); ctx.restore(); }
    else if (a === 'sweep') { const m = Math.sin(G.t * 3) * 6; ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(8 + m, 10); ctx.stroke(); }
    else if (a === 'lantern') { circle(10, 2, 3, '#ffd27a'); }
    else if (a === 'hunt') { ctx.beginPath(); ctx.arc(8, -4, 9, -1.2, 1.2); ctx.stroke(); }
    if (e.fy > -0.5 && a !== 'window') { ctx.fillStyle = '#fff'; ctx.fillRect(-3 + e.fx * 2, -12, 2, 2); ctx.fillRect(2 + e.fx * 2, -12, 2, 2); }
  }
  ctx.restore();
  // 지직거리는 선
  ctx.globalAlpha = alpha * 0.5; ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) if (Math.random() < 0.3) ctx.fillRect(x - 10 * s, y - 18 * s + Math.random() * 26 * s, 20 * s, 1);
  ctx.globalAlpha = 1;
  if (e.state === 'notice') { ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - 26 * s); }
  if (e.hp < e.maxhp && !e.boss) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - 12, y - 30 * s, 24, 3); ctx.fillStyle = '#c8a0ff'; ctx.fillRect(x - 12, y - 30 * s, 24 * e.hp / e.maxhp, 3); }
}

// 야생 마력 동물 (도망친다)
ET.beast = {
  init(e) { e.hp = 3; e.hittable = true; e.burstable = true; e.stasis = true; e.frozen = 0; e.r = 0.35; e.vx = 0; e.vy = 0; e.t = 0; e.hx = e.x; e.hy = e.y; },
  update(e, dt) {
    if (e.frozen > 0) { e.frozen -= dt; return; }
    e.t -= dt;
    const d = dist(e.x, e.y, P.x, P.y);
    if (d < 3.5) { const l = d || 1; e.vx = (e.x - P.x) / l * 3.4; e.vy = (e.y - P.y) / l * 3.4; e.t = 1; }
    else if (e.t <= 0) { e.t = rand(1, 3); const a = rand(7); const m = Math.random() < 0.5 ? 0 : 0.8; e.vx = Math.cos(a) * m; e.vy = Math.sin(a) * m; if (dist(e.x, e.y, e.hx, e.hy) > 5) { e.vx = (e.hx - e.x) * 0.3; e.vy = (e.hy - e.y) * 0.3; } }
    moveEnt(e, e.vx * dt, e.vy * dt);
  },
  draw(e) {
    const x = sx(e), y = sy(e), k = e.kind || 'boar';
    shadow(x, y + 8, 10);
    const hop = (e.vx || e.vy) ? Math.abs(Math.sin(G.t * 12)) * 2 : 0;
    if (k === 'deer') { ellipse(x, y - 2 - hop, 12, 7, '#b07a4a'); circle(x + (e.vx >= 0 ? 10 : -10), y - 9 - hop, 5, '#b07a4a'); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + (e.vx >= 0 ? 10 : -10), y - 13 - hop); ctx.lineTo(x + (e.vx >= 0 ? 13 : -13), y - 20 - hop); ctx.stroke(); }
    else { ellipse(x, y - 2 - hop, 12, 8, '#7a6a8a'); circle(x + (e.vx >= 0 ? 9 : -9), y - 4 - hop, 5, '#8a7a9a'); ctx.fillStyle = '#7ff0ff'; ctx.globalAlpha = 0.7; ctx.fillRect(x - 6, y - 10 - hop, 12, 2); ctx.globalAlpha = 1; }
    if (e.frozen > 0) frozenFx(e);
  },
  onStasis(e) { e.frozen = 5; },
};

// 투사체
ET.proj = {
  init(e) { e.life = e.life || 3; e.r = 0.2; },
  update(e, dt) {
    if (e.owner && e.owner.speedMul !== undefined) dt *= e.owner.speedMul;
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
    if (e.life <= 0) { e.dead = true; return; }
    const t = tileAt(Math.floor(e.x), Math.floor(e.y));
    if (TD[t].solid) { e.dead = true; burst(e.x, e.y, 4, e.c, 1.5, 0.3); return; }
    if (dist(e.x, e.y, P.x, P.y) < 0.4) { hurtPlayer(e.dmg || 1, e.x - e.vx, e.y - e.vy); e.dead = true; }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    if (e.arrow) { ctx.strokeStyle = e.c; ctx.lineWidth = 3; ctx.beginPath(); const l = Math.hypot(e.vx, e.vy); ctx.moveTo(x, y); ctx.lineTo(x - e.vx / l * 16, y - e.vy / l * 16); ctx.stroke(); }
    else { ctx.globalAlpha = 0.5; circle(x, y, 9, e.c); ctx.globalAlpha = 1; circle(x, y, 4, '#fff'); }
  },
};

// 위험 표시 원 (보스 공격 예고)
ET.warn = {
  init(e) { e.t = 0; },
  update(e, dt) {
    e.t += dt;
    if (e.t >= e.delay && !e.fired) {
      e.fired = true;
      if (dist(e.x, e.y, P.x, P.y) < e.rad + 0.2) hurtPlayer(e.dmg, e.x, e.y, { push: e.push });
      burst(e.x, e.y, 14, e.c, 3, 0.5);
      if (e.onFire) e.onFire(e);
    }
    if (e.t > e.delay + 0.3) e.dead = true;
  },
  draw(e) {
    const x = sx(e), y = sy(e), p = clamp(e.t / e.delay, 0, 1);
    ctx.globalAlpha = e.fired ? 0.6 : 0.25;
    circle(x, y, e.rad * TS, e.c);
    ctx.globalAlpha = 0.6; ctx.strokeStyle = e.c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, e.rad * TS * p, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  },
};

// 퍼지는 고리 (틈으로 빠져나간다)
ET.ring = {
  init(e) { e.rr = 0.5; e.gap = rand(Math.PI * 2); },
  update(e, dt) {
    e.rr += dt * (e.sp || 3);
    if (e.rr > (e.max || 9)) { e.dead = true; return; }
    const d = dist(e.x, e.y, P.x, P.y);
    if (Math.abs(d - e.rr) < 0.3) {
      const a = Math.atan2(P.y - e.y, P.x - e.x);
      let diff = Math.abs(((a - e.gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 0.55) hurtPlayer(e.dmg || 2, e.x, e.y);
    }
  },
  draw(e) {
    ctx.strokeStyle = e.c || '#fff'; ctx.lineWidth = 6; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(sx(e), sy(e), e.rr * TS, e.gap + 0.55, e.gap + Math.PI * 2 - 0.55); ctx.stroke(); ctx.globalAlpha = 1;
  },
};

// 파열 룬 폭탄
ET.bomb = {
  init(e) { e.t = 0; e.fuse = 3; },
  update(e, dt) { e.t += dt; if (e.t >= e.fuse) explode(e); },
  draw(e) {
    const x = sx(e), y = sy(e), b = e.t > e.fuse - 1 && Math.sin(e.t * 30) > 0;
    shadow(x, y + 10, 10);
    circle(x, y, 10, b ? '#ffd27a' : '#3a5aa8'); circle(x, y, 6, '#7ff0ff');
    ctx.globalAlpha = 0.2; circle(x, y, 1.6 * TS, '#7ff0ff'); ctx.globalAlpha = 1;
  },
};

// 카시안 (5장 동료)
ET.ally = {
  init(e) { e.solid = false; e.r = 0.35; e.fx = 0; e.fy = 1; e.cd = 0; e.mv = false; },
  update(e, dt) {
    e.cd -= dt;
    // 가까운 잔향 공격
    let tgt = null, best = 4;
    for (const o of G.map.ents) if (o.type === 'echo' && !o.dead && !o.watcher) { const d = dist(o.x, o.y, e.x, e.y); if (d < best) { best = d; tgt = o; } }
    let gx = P.x - P.fx * 1.2, gy = P.y - P.fy * 1.2;
    if (tgt) { gx = tgt.x; gy = tgt.y; }
    const d = dist(e.x, e.y, gx, gy);
    e.mv = false;
    if (d > (tgt ? 0.8 : 0.4)) {
      const sp = d > 6 ? 7 : 4.2;
      const dx = (gx - e.x) / d, dy = (gy - e.y) / d;
      e.fx = dx; e.fy = dy; e.mv = true;
      const nx = e.x + dx * sp * dt, ny = e.y + dy * sp * dt;
      e.x = nx; e.y = ny;
    }
    if (dist(e.x, e.y, P.x, P.y) > 12) { e.x = P.x - P.fx; e.y = P.y - P.fy; }
    if (tgt && best < 1.1 && e.cd <= 0) { e.cd = 0.9; damageEnt(tgt, 2, e.x, e.y); sfx('swing'); }
  },
  draw(e) { drawPerson(sx(e), sy(e), Object.assign({ moving: e.mv, fx: e.fx, fy: e.fy }, KASSIAN_LOOK)); },
};

// 얼음 효과
function frozenFx(e) {
  const x = sx(e), y = sy(e);
  ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(x, y, 16 + Math.sin(G.t * 8) * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  if (e.stored) { ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('×' + e.stored, x, y - 22); }
}

// ---------- 보스 ----------
function bossBase(e, name, hp) {
  e.boss = true; e.name = name; e.hp = e.maxhp = hp; e.hittable = true; e.burstable = true; e.r = 0.9; e.t = 0; e.phase = 0; e.cd = 2; e.fx = 0; e.fy = 1; e.k = { size: 2.2, c: '#9a8cff' }; e.solid = true;
}
// 2장 소금의 수호자: 무릎 꿇고 기도하는 여자의 형상
ET.boss_salt = {
  init(e) { bossBase(e, '소금의 수호자', 34); e.k.c = '#eaf4ff'; e.tint = 'salt'; e.kind = 'human'; e.act = 'pray'; e.scale = 1; e.pat = 0; },
  update(e, dt) {
    if (!e.awake) { if (dist(e.x, e.y, P.x, P.y) < 6) { e.awake = true; G.boss = e; TALK.bossIntro(e); } return; }
    if (e.stun > 0) { e.stun -= dt; return; }
    e.cd -= dt; e.t += dt;
    if (e.cd > 0) return;
    const p = e.pat++ % 4;
    if (p === 0 || p === 2) { // 소금 가시 세 번
      for (let i = 0; i < 3; i++) setTimeoutG(() => { if (!e.dead) spawn('warn', P.x, P.y, { exact: true, rad: 0.9, delay: 0.85, dmg: 2, c: '#ffffff' }); }, i * 0.5);
      e.cd = 2.6;
    } else if (p === 1) { // 소금 물결
      spawn('ring', e.x, e.y, { exact: true, sp: 3.2, max: 10, c: '#f4fbff', dmg: 2 });
      setTimeoutG(() => { if (!e.dead) spawn('ring', e.x, e.y, { exact: true, sp: 3.2, max: 10, c: '#f4fbff', dmg: 2 }); }, 1.1);
      e.cd = 3.2;
    } else { // 마지막 동작: 두 손을 모은다
      e.clasp = 1.6;
      spawn('warn', e.x, e.y, { exact: true, rad: 3.6, delay: 1.6, dmg: 4, c: '#fff6d8', onFire: () => { e.stun = 3; e.clasp = 0; G.shake = 0.5; sfx('boom'); } });
      e.cd = 5;
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.globalAlpha = 0.7;
    ellipse(x, y + 26, 40, 12, 'rgba(120,140,170,0.3)');
    ctx.fillStyle = '#eef6ff';
    ctx.beginPath(); ctx.moveTo(x - 36, y + 24); ctx.quadraticCurveTo(x, y - 10, x + 36, y + 24); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 18, y + 8); ctx.lineTo(x + 18, y + 8); ctx.lineTo(x + 12, y - 30); ctx.lineTo(x - 12, y - 30); ctx.closePath(); ctx.fill();
    circle(x, y - 42, 14, '#f4faff');
    ctx.fillStyle = '#c8d8e8'; ctx.beginPath(); ctx.arc(x, y - 44, 16, Math.PI, Math.PI * 2); ctx.fill();
    // 손
    const cl = e.clasp > 0 || e.stun > 0;
    ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 22); ctx.lineTo(cl ? x - 2 : x - 30, cl ? y - 34 : y - 6); ctx.moveTo(x + 12, y - 22); ctx.lineTo(cl ? x + 2 : x + 30, cl ? y - 34 : y - 6); ctx.stroke();
    ctx.globalAlpha = 1;
    if (e.stun > 0) { ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('기도가 끝났다', x, y - 66); }
  },
  dmgMul: e => e.stun > 0 ? 2 : 1,
};
// 3장 시간에 갇힌 사냥꾼
ET.boss_hunter = {
  init(e) { bossBase(e, '시간에 갇힌 사냥꾼', 30); e.speedMul = 1.6; e.slowT = 0; },
  update(e, dt) {
    if (!e.awake) { if (dist(e.x, e.y, P.x, P.y) < 6.5) { e.awake = true; G.boss = e; TALK.bossIntro(e); } return; }
    if (e.slowT > 0) { e.slowT -= dt; e.speedMul = 0.35; if (e.slowT <= 0) toast('사냥꾼의 시간이 다시 빨라진다'); }
    else e.speedMul = 1.6;
    const sdt = dt * e.speedMul;
    e.cd -= sdt; e.t += sdt;
    // 원 궤도로 움직인다
    e.ang = (e.ang || 0) + sdt * 0.5;
    const tx = e.cx + Math.cos(e.ang) * 3, ty = e.cy + Math.sin(e.ang) * 2;
    e.x = lerp(e.x, tx, 0.05); e.y = lerp(e.y, ty, 0.05);
    const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1; e.fx = dx / l; e.fy = dy / l;
    if (e.cd <= 0) {
      e.cd = 1.4;
      const n = e.hp < e.maxhp / 2 ? 3 : 1;
      for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.25; spawn('proj', e.x, e.y, { exact: true, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, dmg: 2, c: '#ffc880', arrow: true, owner: e }); }
      sfx('swing');
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.globalAlpha = 0.75;
    drawPerson(x, y, { scale: 2, cloak: '#c8782a', body: '#ffc880', skin: '#ffd8a0', hair: '#a85a2a', fx: e.fx, fy: e.fy, alpha: 0.75 });
    ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + e.fx * 20, y - 10 + e.fy * 10, 20, Math.atan2(e.fy, e.fx) - 1.1, Math.atan2(e.fy, e.fx) + 1.1); ctx.stroke();
    ctx.globalAlpha = 1;
    if (e.slowT > 0) frozenFx(e);
  },
  dmgMul: e => e.slowT > 0 ? 1 : 0.25,
};
// 4장 갱도의 잔향: 여러 사람의 형체가 한 덩어리로 엉켰다
ET.boss_mine = {
  init(e) { bossBase(e, '갱도의 잔향', 38); e.split = false; },
  update(e, dt) {
    if (!e.awake) { if (dist(e.x, e.y, P.x, P.y) < 6) { e.awake = true; G.boss = e; TALK.bossIntro(e); } return; }
    e.cd -= dt; e.t += dt;
    const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1; e.fx = dx / l; e.fy = dy / l;
    if (l > 1.8) moveEnt(e, e.fx * 1.4 * dt, e.fy * 1.4 * dt);
    if (!e.split && e.hp < e.maxhp / 2) {
      e.split = true; toast('엉켜 있던 형체 몇이 떨어져 나왔다');
      for (let i = 0; i < 3; i++) spawn('echo', e.x + rand(-2, 2), e.y + rand(-2, 2), { exact: true, kind: 'human', tint: 'mine', act: 'dig' });
    }
    if (e.cd <= 0) {
      if (Math.random() < 0.55) { // 곡괭이 휘두르기
        spawn('warn', e.x + e.fx * 1.6, e.y + e.fy * 1.6, { exact: true, rad: 1.6, delay: 0.7, dmg: 3, c: '#ffb35a' });
        e.cd = 1.8;
      } else { // 등불 던지기
        for (let i = 0; i < 3; i++) spawn('warn', P.x + rand(-2, 2), P.y + rand(-2, 2), { exact: true, rad: 0.8, delay: 1.1, dmg: 2, c: '#ff7a2a' });
        e.cd = 2.4;
      }
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + G.t * 0.4;
      drawPerson(x + Math.cos(a) * 16, y + Math.sin(a) * 10 - 4, { cloak: '#7a5a3a', body: '#c89a70', skin: '#d8b090', hair: '#5a4a3a', alpha: 0.6, fx: Math.cos(a), fy: Math.sin(a) });
    }
    circle(x + Math.sin(G.t * 2) * 20, y - 26, 5, '#ffd27a');
    ctx.globalAlpha = 1;
  },
};
// 5장 회색 가면: 죽이려 하지 않고 밀어내기만 한다
ET.boss_mask = {
  init(e) { bossBase(e, '회색 가면', 40); e.r = 0.4; e.dash = 0; },
  update(e, dt) {
    if (!e.awake) return;
    e.cd -= dt;
    const dx = P.x - e.x, dy = P.y - e.y, l = Math.hypot(dx, dy) || 1;
    if (e.dash > 0) {
      e.dash -= dt;
      moveEnt(e, e.dvx * dt, e.dvy * dt);
      if (l < 0.8 && !e.hitOnce) { e.hitOnce = true; hurtPlayer(1, e.x, e.y, { push: 9, noKill: true }); }
      return;
    }
    e.fx = dx / l; e.fy = dy / l;
    if (l > 3) moveEnt(e, e.fx * 2.4 * dt, e.fy * 2.4 * dt);
    else if (l < 2) moveEnt(e, -e.fx * 1.6 * dt, -e.fy * 1.6 * dt);
    if (e.cd <= 0) {
      if (Math.random() < 0.5) { e.dash = 0.4; e.dvx = e.fx * 13; e.dvy = e.fy * 13; e.hitOnce = false; e.cd = 1.6; sfx('swing'); }
      else { spawn('warn', e.x, e.y, { exact: true, rad: 2.6, delay: 0.9, dmg: 1, c: '#c0b0ff', push: 11 }); e.cd = 2.2; }
    }
  },
  draw(e) {
    const x = sx(e), y = sy(e);
    drawPerson(x, y, { scale: 1.2, cloak: '#5a5a62', body: '#7a7a82', skin: '#cfc8c0', hair: '#3a3a40', mask: '#9a9aa2', crack: e.hp < e.maxhp * 0.5, fx: e.fx, fy: e.fy, moving: true });
    if (e.dash > 0) { ctx.globalAlpha = 0.3; circle(x - e.dvx * 2, y - e.dvy * 2, 12, '#c0b0ff'); ctx.globalAlpha = 1; }
  },
};
