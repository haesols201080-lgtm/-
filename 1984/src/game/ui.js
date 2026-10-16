// The overlay: Oceania's paperwork and grey government glass. HUD, dialogue,
// choices, the telescreen's voice, chapter cards, and the scenes that need
// the player's hands: the diary, the Records Department slips, the Physical
// Jerks, the Two Minutes Hate, O'Brien's fingers, Goldstein's book.
import * as THREE from 'three';
import { store } from '../core/store.js';

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;z-index:10;font-family:"Noto Serif KR","Nanum Myeongjo","Batang",serif;color:#e9e4d8;
  --paper:#e8e0cc;--ink:#1c1a17;--red:#8e1c14;--glass:rgba(16,18,20,.78);--line:rgba(220,214,200,.18);--mono:"Courier Prime","Courier New",monospace;
  --sans:"IBM Plex Sans KR","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;}
#ui *{box-sizing:border-box}
#ui .hud{position:absolute;inset:0;transition:opacity .4s}
#ui .tl{position:absolute;left:18px;top:16px;max-width:min(420px,70vw);font-family:var(--sans);text-shadow:0 1px 2px #000}
#ui .date{font-size:13px;letter-spacing:.06em;color:#cfc8b8}
#ui .clock{font-family:var(--mono);font-size:30px;letter-spacing:.04em;line-height:1.1}
#ui .zone{margin-top:6px;font-size:13px;display:flex;gap:8px;align-items:center}
#ui .zone b{font-weight:600}
#ui .zone .tag{font-size:11px;padding:1px 6px;border:1px solid currentColor;letter-spacing:.08em}
#ui .zone .ok{color:#a9b8a4}#ui .zone .bad{color:#ff8a78}
#ui .obj{margin-top:12px;font-size:14px;line-height:1.5;border-left:2px solid var(--red);padding-left:10px;background:linear-gradient(90deg,rgba(0,0,0,.35),transparent)}
#ui .obj .opt{color:#b8b2a4;font-size:13px}
#ui .tr{position:absolute;right:18px;top:16px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:var(--sans)}
#ui .eye{width:74px;height:40px}
#ui .susp{font-family:var(--mono);font-size:12px;color:#cfc8b8}
#ui .watched{font-size:12px;letter-spacing:.12em;color:#ff9a8a;opacity:0;transition:opacity .25s}
#ui .cross{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:rgba(240,235,225,.7)}
#ui .prompt{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-family:var(--sans);font-size:15px;padding:6px 12px;background:var(--glass);border:1px solid var(--line);opacity:0;transition:opacity .15s;white-space:nowrap}
#ui .prompt kbd{font-family:var(--mono);border:1px solid #bbb;padding:0 5px;margin-right:8px;border-radius:2px}
#ui .say{position:absolute;left:50%;bottom:36px;transform:translateX(-50%);width:min(860px,calc(100vw - 32px));background:var(--glass);border-top:2px solid var(--red);padding:16px 22px 18px;pointer-events:auto;display:none}
#ui .say .who{font-family:var(--sans);font-size:13px;letter-spacing:.14em;color:#d9b8a8;margin-bottom:6px}
#ui .say .txt{font-size:19px;line-height:1.6;min-height:2em}
#ui .say .next{position:absolute;right:16px;bottom:10px;font-size:12px;color:#9a948a;font-family:var(--sans)}
#ui .choices{position:absolute;left:50%;bottom:36px;transform:translateX(-50%);width:min(760px,calc(100vw - 32px));display:none;flex-direction:column;gap:8px;pointer-events:auto}
#ui .choices .q{font-size:17px;margin-bottom:4px;text-shadow:0 1px 3px #000}
#ui .choices button{all:unset;cursor:pointer;background:var(--glass);border:1px solid var(--line);padding:12px 16px;font-size:17px;line-height:1.4;color:#eee8dc}
#ui .choices button:hover,#ui .choices button:focus{border-color:#d0a090;background:rgba(60,24,18,.8)}
#ui .choices button span{font-family:var(--mono);color:#b9806e;margin-right:10px}
#ui .ts{position:absolute;left:50%;top:18px;transform:translateX(-50%);max-width:min(760px,calc(100vw - 32px));padding:10px 18px;background:repeating-linear-gradient(0deg,rgba(30,40,36,.92) 0 2px,rgba(22,30,27,.92) 2px 4px);border:1px solid #6f8a80;color:#d8f0e4;font-family:var(--sans);font-size:16px;letter-spacing:.02em;opacity:0;transition:opacity .2s;text-shadow:0 0 6px rgba(150,230,200,.5)}
#ui .ts:before{content:'TELESCREEN';display:block;font-size:10px;letter-spacing:.3em;color:#86a89a;margin-bottom:3px}
#ui .toast{position:absolute;right:18px;bottom:120px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
#ui .toast div{background:var(--glass);border-left:2px solid #a7a093;padding:7px 12px;font-family:var(--sans);font-size:14px;animation:tin .3s ease-out}
@keyframes tin{from{opacity:0;transform:translateX(10px)}}
#ui .title{position:absolute;left:0;right:0;top:38%;text-align:center;opacity:0;transition:opacity 1.2s}
#ui .title .big{font-size:clamp(28px,5vw,54px);letter-spacing:.08em}
#ui .title .small{margin-top:10px;font-family:var(--sans);font-size:15px;letter-spacing:.3em;color:#c8c0b0}
#ui .black{position:absolute;inset:0;background:#000;display:none;align-items:center;justify-content:center;flex-direction:column;gap:18px;pointer-events:auto;padding:24px;text-align:center}
#ui .black p{font-size:clamp(17px,2.2vw,24px);line-height:1.7;max-width:760px;opacity:0;transition:opacity 1.4s;margin:0}
#ui .modal{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);pointer-events:auto;padding:16px}
#ui .sheet{background:var(--paper);color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.6);max-width:980px;width:100%;max-height:calc(100vh - 32px);overflow:auto;position:relative}
#ui .diary{background:#efe6cf url() ;padding:38px 46px 30px;font-family:"Nanum Pen Script","Gaegu",cursive,"Noto Serif KR",serif;min-height:min(560px,80vh);
  background-image:repeating-linear-gradient(0deg,transparent 0 33px,rgba(90,120,160,.25) 33px 34px),radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.3),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(140,110,60,.18),transparent 50%)}
#ui .diary .hand{font-family:var(--mono);font-size:21px;line-height:34px;color:#1f2a44;white-space:pre-wrap;min-height:120px}
#ui .diary .opts{margin-top:18px;display:flex;flex-direction:column;gap:6px}
#ui .diary button,#ui .sheet button{all:unset;cursor:pointer;font-family:var(--sans);font-size:15px;padding:9px 12px;border:1px solid rgba(30,26,20,.35);background:rgba(255,255,255,.35);color:#1c1a17}
#ui .diary button:hover,#ui .sheet button:hover{background:rgba(140,30,20,.12);border-color:#8e1c14}
#ui .work{display:grid;grid-template-columns:1fr 1.3fr;gap:0;font-family:var(--sans)}
#ui .work .slip{background:#d9d2bd;padding:22px;border-right:1px dashed #9a927e}
#ui .work .slip .msg{font-family:var(--mono);font-size:17px;line-height:1.5;background:#f2ecdc;padding:12px;box-shadow:0 2px 6px rgba(0,0,0,.2);transform:rotate(-1deg)}
#ui .work .times{padding:22px;font-family:"Times New Roman",serif}
#ui .work .times h4{font-size:12px;letter-spacing:.25em;margin:0 0 6px;border-bottom:3px double #222}
#ui .work .times .orig{font-size:16px;line-height:1.55;margin-bottom:14px}
#ui .work .opts{display:flex;flex-direction:column;gap:6px}
#ui .work .hint{font-size:13px;color:#5d564a;margin:10px 0}
#ui .meter{position:absolute;left:50%;bottom:90px;transform:translateX(-50%);width:min(520px,80vw);display:none;text-align:center;font-family:var(--sans)}
#ui .meter .bar{height:8px;background:rgba(255,255,255,.12);margin-top:8px}
#ui .meter .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7a1810,#e0402c)}
#ui .jk{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);display:none;font-family:var(--mono);font-size:58px;color:#f0e8d8;text-shadow:0 0 18px #000}
#ui .map canvas{display:block;width:100%;height:auto;background:#d8d0b8}
#ui .menu{position:absolute;inset:0;display:none;pointer-events:auto;background:#060606;align-items:center;justify-content:center}
#ui .menu canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9}
#ui .menu .panel{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:12px;margin-right:auto;margin-left:max(24px,8vw)}
#ui .menu h1{font-family:"Oswald","Arial Narrow",var(--sans);font-size:clamp(70px,14vw,170px);margin:0;line-height:.9;letter-spacing:.02em;color:#e8e0cc}
#ui .menu .sub{font-family:var(--sans);letter-spacing:.35em;font-size:13px;color:#b9b0a0;margin-bottom:18px}
#ui .menu button{all:unset;cursor:pointer;font-family:var(--sans);font-size:18px;letter-spacing:.12em;padding:10px 0;color:#e8e0cc;border-bottom:1px solid transparent}
#ui .menu button:hover{border-color:#8e1c14;color:#fff}
#ui .menu .note{font-family:var(--sans);font-size:12px;color:#8a8478;max-width:420px;line-height:1.6;margin-top:24px}
#ui .loading{position:absolute;inset:0;background:#050505;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;pointer-events:auto;font-family:var(--sans)}
#ui .loading .lbar{width:min(360px,70vw);height:2px;background:#222}#ui .loading .lbar i{display:block;height:100%;width:0;background:#c8c0b0;transition:width .2s}
#ui .loading .lt{font-size:12px;letter-spacing:.4em;color:#8a8478}
#ui .click{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:var(--sans);font-size:15px;padding:12px 18px;background:var(--glass);border:1px solid var(--line);display:none;pointer-events:auto;cursor:pointer}
#ui .pause .sheet{padding:28px 32px;max-width:520px;font-family:var(--sans)}
#ui .pause h3{margin:0 0 16px;font-size:22px;letter-spacing:.1em}
#ui .pause label{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:10px 0;font-size:15px}
#ui .pause .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
#ui .pause .keys{font-size:13px;line-height:1.8;color:#4a443a;margin-top:14px}
#ui .bubbles div{position:absolute;transform:translate(-50%,-100%);background:rgba(10,10,10,.72);padding:4px 10px;font-family:var(--sans);font-size:14px;white-space:nowrap;border-radius:2px}
#ui .end h2{font-size:clamp(26px,4vw,42px);letter-spacing:.06em;margin:0}
@media (max-width:600px){#ui .clock{font-size:24px}#ui .work{grid-template-columns:1fr}#ui .say .txt{font-size:16px}}
`;

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function setupUI(G) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'ui';
  root.innerHTML = `
    <div class="hud">
      <div class="tl"><div class="date"></div><div class="clock"></div><div class="zone"></div><div class="obj"></div></div>
      <div class="tr"><svg class="eye" viewBox="0 0 74 40"><path class="lid" d="M2 20 Q37 -4 72 20 Q37 44 2 20Z" fill="none" stroke="#e9e4d8" stroke-width="1.6"/>
        <clipPath id="eyeclip"><path class="lidc" d="M2 20 Q37 20 72 20 Q37 20 2 20Z"/></clipPath>
        <g clip-path="url(#eyeclip)"><circle cx="37" cy="20" r="11" fill="#2b2420"/><circle cx="37" cy="20" r="5" fill="#000"/><circle cx="34" cy="17" r="1.6" fill="#fff" opacity=".7"/></g></svg>
        <div class="susp"></div><div class="watched">감시당하는 중</div></div>
      <div class="cross"></div><div class="prompt"></div>
    </div>
    <div class="bubbles"></div>
    <div class="ts"></div><div class="toast"></div>
    <div class="title"><div class="big"></div><div class="small"></div></div>
    <div class="meter"><div class="mt"></div><div class="bar"><i></i></div></div>
    <div class="jk"></div>
    <div class="say"><div class="who"></div><div class="txt"></div><div class="next">E · 클릭 ▸</div></div>
    <div class="choices"></div>
    <div class="modal"></div>
    <div class="click">클릭해서 계속</div>
    <div class="black"></div>
    <div class="menu"></div>
    <div class="loading"><div class="lt">MINISTRY OF TRUTH</div><div class="lbar"><i></i></div></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const el = {
    hud: $('.hud'), date: $('.date'), clock: $('.clock'), zone: $('.zone'), obj: $('.obj'), susp: $('.susp'), watched: $('.watched'),
    lidc: $('.lidc'), prompt: $('.prompt'), say: $('.say'), who: $('.say .who'), txt: $('.say .txt'), choices: $('.choices'),
    ts: $('.ts'), toast: $('.toast'), title: $('.title'), modal: $('.modal'), black: $('.black'), menu: $('.menu'), loading: $('.loading'),
    meter: $('.meter'), jk: $('.jk'), click: $('.click'), bubbles: $('.bubbles'),
  };

  let modalDepth = 0;
  const openModal = () => { modalDepth++; G.modal = true; G.input.unlock(); };
  const closeModal = () => { modalDepth = Math.max(0, modalDepth - 1); G.modal = modalDepth > 0; };

  // keys that advance dialogue
  let advance = null;
  const onKey = (e) => {
    if (advance && ['KeyE', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); advance(); }
    if (e.code === 'Escape' && !G.modal && G.started) ui.pause();
    if (e.code === 'KeyM' && !G.modal && G.started && G.cutscene === 0) ui.map();
  };
  addEventListener('keydown', onKey);
  el.say.addEventListener('click', () => advance && advance());
  // pointer lock: click the world to look around
  G.renderer.gl.domElement.addEventListener('click', () => { if (!G.modal) G.input.lock(); });
  el.click.addEventListener('click', () => { G.input.lock(); });

  const ui = {
    el,
    closeAll() {
      el.say.style.display = 'none'; el.choices.style.display = 'none'; el.modal.style.display = 'none';
      el.black.style.display = 'none'; el.menu.style.display = 'none'; el.meter.style.display = 'none'; el.jk.style.display = 'none';
      modalDepth = 0; G.modal = false; advance = null;
    },

    loading(p) {
      el.loading.style.display = p >= 1 ? 'none' : 'flex';
      el.loading.querySelector('i').style.width = (p * 100).toFixed(0) + '%';
    },

    async mainMenu() {
      const c = document.createElement('canvas');
      c.width = 1600; c.height = 900;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1600, 0);
      g.addColorStop(0, '#050505'); g.addColorStop(0.45, '#0d0f10'); g.addColorStop(1, '#1b1f22');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 900);
      ctx.save(); ctx.globalAlpha = 0.85; G.art.drawBB(ctx, 1120, 420, 300); ctx.restore();
      const v = ctx.createLinearGradient(0, 0, 1600, 0);
      v.addColorStop(0, 'rgba(5,5,5,1)'); v.addColorStop(0.5, 'rgba(5,5,5,.6)'); v.addColorStop(1, 'rgba(5,5,5,0)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, 1600, 900);
      ctx.fillStyle = '#8e1c14'; ctx.fillRect(0, 860, 1600, 40);
      ctx.fillStyle = '#e8e0cc'; ctx.font = 'bold 26px "Arial Narrow",sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('BIG BROTHER IS WATCHING YOU', 1560, 889);
      const hasSave = !!store.get('1984.save');
      el.menu.innerHTML = '';
      el.menu.appendChild(c);
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `<h1>1984</h1><div class="sub">조지 오웰 · 에어스트립 원, 런던</div>
        <button data-v="new">새로 시작</button>${hasSave ? '<button data-v="continue">이어서 하기</button>' : ''}
        <div class="note">1인칭 · 마우스로 둘러보고 WASD로 걷는다. E로 살핀다. M은 지도, Esc는 일시정지.<br>
        생활 범위를 벗어나면 텔레스크린과 사상경찰이 지켜본다. 소리는 헤드폰을 권한다.</div>`;
      el.menu.appendChild(panel);
      el.menu.style.display = 'flex';
      openModal();
      const v2 = await new Promise((res) => panel.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => res(b.dataset.v))));
      el.menu.style.display = 'none';
      closeModal();
      G.started = true;
      if (G.audio && G.audio.unlock) G.audio.unlock();
      G.input.lock();
      return v2;
    },

    hudVisible(on) { el.hud.style.opacity = on ? 1 : 0; },

    objective(main, optional = []) {
      ui._obj = { main, optional };
      el.obj.innerHTML = main ? `<div>${main}</div>${optional.map((o) => `<div class="opt">· ${o}</div>`).join('')}` : '';
      el.obj.style.display = main ? 'block' : 'none';
    },

    toast(text, sec = 4) {
      const d = document.createElement('div');
      d.textContent = text;
      el.toast.appendChild(d);
      setTimeout(() => d.remove(), sec * 1000);
    },

    telescreen(text, sec = 4) {
      el.ts.textContent = text;
      el.ts.style.opacity = 1;
      clearTimeout(ui._tsT);
      ui._tsT = setTimeout(() => { el.ts.style.opacity = 0; }, sec * 1000);
    },

    title(big, small = '', sec = 4) {
      el.title.querySelector('.big').textContent = big;
      el.title.querySelector('.small').textContent = small;
      el.title.style.opacity = 1;
      return new Promise((res) => setTimeout(() => { el.title.style.opacity = 0; setTimeout(res, 1200); }, sec * 1000));
    },

    async fadeText(lines, o = {}) {
      el.black.innerHTML = '';
      el.black.style.display = 'flex';
      openModal();
      const ps = lines.map((l) => { const p = document.createElement('p'); p.textContent = l; el.black.appendChild(p); return p; });
      for (const p of ps) { await G.wait(0.2); p.style.opacity = 1; await G.wait(o.each ?? 2.2); }
      await G.wait(o.hold ?? 1.5);
      if (o.keep) return;
      for (const p of ps) p.style.opacity = 0;
      await G.wait(1.2);
      el.black.style.display = 'none';
      closeModal();
    },

    say(speaker, text, o = {}) {
      return new Promise((res) => {
        el.say.style.display = 'block';
        el.who.textContent = speaker || '';
        el.txt.textContent = '';
        let i = 0, done = false;
        const chars = [...text];
        const speed = o.speed ?? 32;
        const tick = setInterval(() => {
          i = Math.min(chars.length, i + 1);
          el.txt.textContent = chars.slice(0, i).join('');
          if (i % 3 === 0 && G.audio && G.audio.blip) G.audio.blip(speaker);
          if (i >= chars.length) { clearInterval(tick); done = true; }
        }, 1000 / speed);
        const finish = () => { clearInterval(tick); el.txt.textContent = text; done = true; };
        advance = () => {
          if (!done) { finish(); return; }
          advance = null;
          if (!o.keep) el.say.style.display = 'none';
          res();
        };
        if (o.auto) setTimeout(() => { if (advance) { finish(); advance(); } }, o.auto * 1000);
      });
    },

    choice(options, o = {}) {
      return new Promise((res) => {
        openModal();
        el.choices.innerHTML = o.prompt ? `<div class="q">${o.prompt}</div>` : '';
        const done = (i) => {
          removeEventListener('keydown', key);
          clearTimeout(timer);
          el.choices.style.display = 'none';
          closeModal();
          res(i);
        };
        options.forEach((t, i) => {
          const b = document.createElement('button');
          b.innerHTML = `<span>${i + 1}</span>${t}`;
          b.addEventListener('click', () => done(i));
          el.choices.appendChild(b);
        });
        const key = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= options.length) done(n - 1); };
        addEventListener('keydown', key);
        const timer = o.timeout ? setTimeout(() => done(o.timeoutIndex ?? options.length - 1), o.timeout * 1000) : null;
        el.choices.style.display = 'flex';
      });
    },

    bubble(npc, text, sec = 3) {
      const d = document.createElement('div');
      d.textContent = text;
      el.bubbles.appendChild(d);
      const v = new THREE.Vector3();
      const upd = () => {
        if (!npc.root || !npc.root.visible) { d.style.display = 'none'; return; }
        npc.root.getWorldPosition(v); v.y += 2.05;
        v.project(G.camera);
        if (v.z > 1) { d.style.display = 'none'; return; }
        d.style.display = 'block';
        d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
        d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
      };
      const off = G.onUpdate(upd);
      setTimeout(() => { off(); d.remove(); }, sec * 1000);
    },

    // ---- the diary: creamy paper, an archaic pen, small clumsy letters
    diary(o) {
      return new Promise((res) => {
        openModal();
        el.modal.innerHTML = `<div class="sheet diary"><div class="hand"></div><div class="opts"></div></div>`;
        el.modal.style.display = 'flex';
        const hand = el.modal.querySelector('.hand'), opts = el.modal.querySelector('.opts');
        const written = [];
        const write = async (s) => {
          for (const ch of s) { hand.textContent += ch; if (G.audio && G.audio.play && ch !== ' ') G.audio.play('pen', { volume: 0.25 }); await G.wait(0.045); }
        };
        (async () => {
          for (const step of o.steps) {
            if (step.write) { await write(step.write); written.push(step.write); continue; }
            if (step.repeat) {
              opts.innerHTML = `<div style="font-family:var(--sans);font-size:14px;color:#4a443a">${step.hint}</div>`;
              let n = 0;
              await new Promise((r2) => {
                const k = async (e) => {
                  if (!/^Key|Space/.test(e.code)) return;
                  e.preventDefault();
                  removeEventListener('keydown', k);
                  await write((n ? ' ' : '') + step.repeat);
                  n++;
                  if (n >= step.times) r2(); else addEventListener('keydown', k);
                };
                addEventListener('keydown', k);
              });
              written.push(step.repeat);
              continue;
            }
            if (step.choose) {
              const i = await new Promise((r2) => {
                opts.innerHTML = '';
                step.choose.forEach((t, j) => {
                  const b = document.createElement('button');
                  b.textContent = t.label || t;
                  b.addEventListener('click', () => r2(j));
                  opts.appendChild(b);
                });
              });
              opts.innerHTML = '';
              const pickT = step.choose[i];
              await write('\n' + (pickT.text || pickT));
              written.push(pickT.text || pickT);
              if (step.onPick) step.onPick(i);
            }
          }
          opts.innerHTML = '<button>펜을 내려놓는다</button>';
          opts.querySelector('button').addEventListener('click', () => {
            el.modal.style.display = 'none';
            closeModal();
            res(written);
          });
        })();
      });
    },

    // ---- the Records Department: rectify The Times
    async work(slips) {
      const results = [];
      openModal();
      el.modal.style.display = 'flex';
      for (const s of slips) {
        const r = await new Promise((res) => {
          el.modal.innerHTML = `<div class="sheet work"><div class="slip"><div style="font-size:12px;letter-spacing:.2em;color:#5d564a;margin-bottom:10px">기압관에서 떨어진 쪽지</div>
            <div class="msg">${s.slip}</div><div class="hint">${s.gloss}</div></div>
            <div class="times"><h4>THE TIMES · ${s.date}</h4><div class="orig">${s.original}</div>
            <div class="hint">스피크라이트에 대고 바로잡을 문장을 불러 준다.</div><div class="opts"></div></div></div>`;
          const opts = el.modal.querySelector('.opts');
          s.options.forEach((t, i) => {
            const b = document.createElement('button');
            b.textContent = t.text;
            b.addEventListener('click', () => res({ i, ...t }));
            opts.appendChild(b);
          });
        });
        results.push(r);
        if (G.audio && G.audio.play) G.audio.play('tube', { volume: 0.6 });
        const sheet = el.modal.querySelector('.sheet');
        sheet.style.transition = 'transform .6s, opacity .6s';
        sheet.style.transform = 'translateX(60px) scale(.96)';
        sheet.style.opacity = 0;
        if (r.note) ui.toast(r.note, 5);
        await G.wait(0.7);
      }
      el.modal.style.display = 'none';
      closeModal();
      return results;
    },

    // ---- Physical Jerks: follow the instructress's beat
    async jerks(o = {}) {
      const beats = o.beats || 12;
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      const glyph = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
      let misses = 0;
      el.jk.style.display = 'block';
      el.meter.style.display = 'block';
      el.meter.querySelector('.mt').textContent = '화면의 화살표 방향키를 박자에 맞춰 누른다';
      for (let i = 0; i < beats; i++) {
        const k = keys[Math.floor(Math.random() * 4)];
        el.jk.textContent = glyph[k];
        G.art.telescreen.jerk = i % 2 ? 0.25 : 0.75;
        G.art.telescreen.jerkKind = i > beats / 2 ? 'toes' : 'arms';
        if (G.audio && G.audio.play) G.audio.play('count', { rate: 1 + (i % 4) * 0.05 });
        const ok = await new Promise((res) => {
          const t = setTimeout(() => { removeEventListener('keydown', h); res(false); }, 1100);
          const h = (e) => { if (!keys.includes(e.code)) return; e.preventDefault(); clearTimeout(t); removeEventListener('keydown', h); res(e.code === k); };
          addEventListener('keydown', h);
        });
        el.meter.querySelector('i').style.width = ((i + 1) / beats * 100) + '%';
        el.jk.style.color = ok ? '#cfe8d4' : '#ff7a6a';
        if (!ok) {
          misses++;
          if (G.surv) G.surv.add(3);
          if (misses === 2 || misses === 5) ui.telescreen('6079 스미스 W! 네, 당신 말이야! 더 굽히세요! 당신은 할 수 있어요!', 3.5);
        }
        await G.wait(0.3);
        el.jk.style.color = '';
      }
      el.jk.style.display = 'none';
      el.meter.style.display = 'none';
      return misses;
    },

    // ---- the Two Minutes Hate: hold to shout with the others
    async hate(sec = 60) {
      el.meter.style.display = 'block';
      const mt = el.meter.querySelector('.mt');
      mt.textContent = 'Space를 누르고 있으면 함께 소리친다';
      let shout = 0, t0 = G.time, part = 0;
      const down = () => G.input.down('Space') || G.input.down('KeyE') || G.input.mouseDown;
      if (G.surv) G.surv.require('shout', true);
      while (G.time - t0 < sec) {
        const s = down();
        shout += ((s ? 1 : 0) - shout) * 0.2;
        if (G.surv) G.surv.flag('shouting', shout > 0.5);
        part += s ? 1 : 0;
        el.meter.querySelector('i').style.width = (shout * 100) + '%';
        if (G.audio && G.audio.shout) G.audio.shout(shout);
        G.player.fovKick = s ? -4 : 0;
        await G.wait(0.05);
      }
      if (G.surv) { G.surv.require('shout', false); G.surv.flag('shouting', false); }
      G.player.fovKick = 0;
      el.meter.style.display = 'none';
      return Math.min(1, part / (sec / 0.05) * 1.6);
    },

    // ---- "How many fingers am I holding up, Winston?"
    async fingers(rounds) {
      let i = 0;
      for (const r of rounds) {
        await ui.say('오브라이언', r.q || '손가락이 몇 개지, 윈스턴?');
        const k = await ui.choice(r.options, { prompt: r.prompt });
        if (r.react) await r.react(k, i++);
      }
    },

    // ---- Goldstein's book
    async book(pages) {
      openModal();
      el.modal.style.display = 'flex';
      for (const p of pages) {
        await new Promise((res) => {
          el.modal.innerHTML = `<div class="sheet" style="padding:40px 48px;max-width:720px;background:#e9e2cf;font-family:'Noto Serif KR',serif">
            <div style="font-size:12px;letter-spacing:.25em;color:#6b6252;margin-bottom:10px">${p.head || ''}</div>
            <div style="font-size:18px;line-height:1.8;white-space:pre-wrap">${p.text}</div>
            <div style="margin-top:20px;text-align:right"><button>다음</button></div></div>`;
          el.modal.querySelector('button').addEventListener('click', res);
        });
      }
      el.modal.style.display = 'none';
      closeModal();
    },

    // ---- the map, with the living range shaded for the hour
    map() {
      if (!G.world) return;
      openModal();
      el.modal.innerHTML = `<div class="sheet map" style="max-width:860px;padding:16px;background:#e2d9c2"><canvas width="1200" height="1040"></canvas>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-family:var(--sans);font-size:13px;color:#3a352c">
        <span>■ 생활 범위 (현재 시각)　▨ 출입 제한</span><button>닫기 (M)</button></div></div>`;
      el.modal.style.display = 'flex';
      const c = el.modal.querySelector('canvas');
      const ctx = c.getContext('2d');
      const X = (x) => (x + 380) / 760 * 1200, Z = (z) => (z + 320) / 660 * 1040;
      ctx.fillStyle = '#d6ccb2'; ctx.fillRect(0, 0, 1200, 1040);
      const allow = G.story && G.story.allowedZones ? G.story.allowedZones() : new Set();
      for (const [id, zn] of Object.entries(G.world.zones)) {
        for (const [x0, z0, x1, z1] of zn.rects) {
          ctx.fillStyle = allow.has(id) ? 'rgba(90,120,90,.35)' : (id === 'miniluv' ? 'rgba(120,20,15,.35)' : 'rgba(60,50,40,.12)');
          ctx.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
        }
      }
      ctx.fillStyle = 'rgba(40,36,30,.85)';
      for (const f of G.world.placer.footprints) {
        const [x, z, hx, hz, rot] = f;
        ctx.save(); ctx.translate(X(x), Z(z)); ctx.rotate(-rot);
        ctx.fillRect(-hx / 760 * 1200, -hz / 660 * 1040, hx * 2 / 760 * 1200, hz * 2 / 660 * 1040); ctx.restore();
      }
      ctx.font = '600 22px "IBM Plex Sans KR",sans-serif'; ctx.fillStyle = '#1c1a17'; ctx.textAlign = 'center';
      for (const [id, zn] of Object.entries(G.world.zones)) {
        const r = zn.rects[0]; if (!r) continue;
        ctx.fillText(zn.name, X((r[0] + r[2]) / 2), Z((r[1] + r[3]) / 2));
      }
      const p = G.state.location === 'city' ? G.player.pos : (G.world.points.home_door);
      ctx.save(); ctx.translate(X(p.x), Z(p.z)); ctx.rotate(-G.player.yaw);
      ctx.fillStyle = '#8e1c14'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(80,60,30,.12)';
      for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(Math.random() * 1200, Math.random() * 1040, 20 + Math.random() * 90, 0, 7); ctx.fill(); }
      const close = () => { el.modal.style.display = 'none'; removeEventListener('keydown', k); closeModal(); };
      const k = (e) => { if (e.code === 'KeyM' || e.code === 'Escape') close(); };
      setTimeout(() => addEventListener('keydown', k), 50);
      el.modal.querySelector('button').addEventListener('click', close);
    },

    pause() {
      openModal();
      G.paused = true;
      const q = G.renderer.quality;
      el.modal.innerHTML = `<div class="pause" style="width:100%;display:flex;justify-content:center"><div class="sheet">
        <h3>일시정지</h3>
        <label>그래픽 품질 <select class="q"><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option></select></label>
        <label>마우스 감도 <input class="sens" type="range" min="0.3" max="2.5" step="0.1" value="${G.input.sensitivity}"></label>
        <label>소리 <input class="vol" type="range" min="0" max="1" step="0.05" value="${G.audio ? G.audio.volume ?? 0.8 : 0.8}"></label>
        <div class="row"><button class="go">계속하기</button><button class="save">저장</button><button class="menu">처음 화면으로</button></div>
        <div class="keys">WASD 걷기 · Shift 뛰기(눈에 띈다) · C 웅크리기 · E 살피기/대화 · M 지도 · Esc 일시정지 · F3 텔레스크린 시야</div></div></div>`;
      el.modal.style.display = 'flex';
      const sel = el.modal.querySelector('.q'); sel.value = q;
      sel.addEventListener('change', () => { store.set('1984.quality', sel.value); G.renderer.setup(G.scene, G.camera, sel.value); });
      el.modal.querySelector('.sens').addEventListener('input', (e) => { G.input.sensitivity = +e.target.value; store.set('1984.sens', e.target.value); });
      el.modal.querySelector('.vol').addEventListener('input', (e) => { if (G.audio && G.audio.master) G.audio.master(+e.target.value); });
      el.modal.querySelector('.save').addEventListener('click', () => { if (G.story && G.story.save) { G.story.save(); ui.toast('저장했다.'); } });
      el.modal.querySelector('.menu').addEventListener('click', () => location.reload());
      el.modal.querySelector('.go').addEventListener('click', () => { el.modal.style.display = 'none'; G.paused = false; closeModal(); G.input.lock(); });
    },

    async ending(title, lines, credits = []) {
      el.black.innerHTML = '';
      el.black.style.display = 'flex';
      openModal();
      const h = document.createElement('div'); h.className = 'end'; h.innerHTML = `<h2>${title}</h2>`; h.style.opacity = 0; h.style.transition = 'opacity 2s';
      el.black.appendChild(h);
      await G.wait(0.5); h.style.opacity = 1; await G.wait(2.5);
      for (const l of lines) { const p = document.createElement('p'); p.textContent = l; el.black.appendChild(p); await G.wait(0.2); p.style.opacity = 1; await G.wait(2.4); }
      const c = document.createElement('p'); c.style.fontSize = '13px'; c.style.fontFamily = 'var(--sans)'; c.style.color = '#8a8478';
      c.innerHTML = credits.join('<br>'); el.black.appendChild(c); await G.wait(0.3); c.style.opacity = 1;
      const b = document.createElement('p'); b.innerHTML = '<span style="cursor:pointer;border-bottom:1px solid #666;font-family:var(--sans);font-size:15px">처음 화면으로</span>';
      b.style.opacity = 1; el.black.appendChild(b);
      b.querySelector('span').addEventListener('click', () => location.reload());
    },
  };

  // ---- per-frame HUD
  const fmtDate = () => {
    const d = G.story && G.story.date ? G.story.date() : null;
    return d ? `${d.y}년 ${d.m}월 ${d.d}일 ${DAYS[d.w]}요일` : '1984년';
  };
  G.onUpdate(() => {
    if (!G.started) return;
    el.date.textContent = fmtDate();
    el.clock.textContent = G.clockText();
    const s = G.surv;
    if (s) {
      const zn = G.world && G.world.zones[s.zone] ? G.world.zones[s.zone].name : (G.location && G.location.exterior ? '변두리' : '실내');
      el.zone.innerHTML = `<b>${zn}</b><span class="tag ${s.inRange ? 'ok' : 'bad'}">${s.inRange ? '생활 범위' : '범위 이탈'}</span>`;
      const k = G.state.suspicion / 100;
      const open = 2 + k * 18;
      el.lidc.setAttribute('d', `M2 20 Q37 ${20 - open * 1.2} 72 20 Q37 ${20 + open * 1.2} 2 20Z`);
      el.susp.textContent = `의심 ${Math.round(G.state.suspicion)}`;
      el.watched.style.opacity = s.watched ? 1 : 0;
    }
    const f = G.focus;
    el.prompt.style.opacity = f ? 1 : 0;
    if (f) el.prompt.innerHTML = `<kbd>E</kbd>${f.label}`;
    el.click.style.display = (!G.input.locked && !G.input.drag && !G.modal && G.cutscene === 0 && !G.paused) ? 'block' : 'none';
  });
  const sens = parseFloat(store.get('1984.sens') || '1');
  G.input.sensitivity = sens;
  G.ui = ui;
  return ui;
}
