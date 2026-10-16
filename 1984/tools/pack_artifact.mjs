// Builds the publishable web page: the page body, game.js and the packed
// assets split into script chunks small enough for the artifact host
// (each file under 16 MB). Usage: node tools/pack_artifact.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out = process.argv[2] || path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/^assets_\d+\.js$/.test(f)) fs.unlinkSync(path.join(out, f));

// window.__ASSETS__={m:{...},t:{...},a:{...},f:{...}};
const src = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const json = JSON.parse(src.slice(src.indexOf('=') + 1, src.lastIndexOf(';')));
const LIMIT = 12 * 1048576;
const chunks = [];
let cur = null, size = 0;
for (const kind of Object.keys(json)) {
  for (const [k, v] of Object.entries(json[kind])) {
    if (!cur || size + v.length > LIMIT) { cur = {}; size = 0; chunks.push(cur); }
    (cur[kind] ||= {})[k] = v;
    size += v.length + k.length + 8;
  }
}
const names = chunks.map((c, i) => {
  const name = `assets_${i}.js`;
  const body = Object.entries(c).map(([kind, obj]) => `Object.assign(A.${kind}||(A.${kind}={}),${JSON.stringify(obj)});`).join('');
  fs.writeFileSync(path.join(out, name), `(function(){var A=window.__ASSETS__||(window.__ASSETS__={m:{},t:{}});${body}})();\n`);
  return name;
});
fs.copyFileSync(path.join(root, 'game.js'), path.join(out, 'game.js'));

const page = `<title>1984 Airstrip One</title>
<meta name="description" content="A first-person game in George Orwell's London, 1984.">
<style>
  :root { color-scheme: dark; --bg: #050505; --fg: #ddd6c8; --err-bg: #2a0d0b; --err-fg: #f3d6cf; --err-line: #7e1810; }
  html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--fg); overscroll-behavior: none; }
  body { margin: 0; touch-action: none; -webkit-user-select: none; user-select: none; }
  #game { position: fixed; inset: 0; }
  #game canvas { display: block; width: 100%; height: 100%; }
  #fatal { position: fixed; inset: auto 16px 16px 16px; padding: 12px 14px; background: var(--err-bg); color: var(--err-fg);
    font: 14px/1.5 system-ui, sans-serif; border: 1px solid var(--err-line); z-index: 100; white-space: pre-wrap; }
  #boot { position: fixed; inset: 0; display: grid; place-items: center; font: 13px/1.4 ui-monospace, monospace; letter-spacing: .3em; color: #8a8478; }
</style>
<div id="game"></div>
<div id="boot">LOADING</div>
<pre id="fatal" hidden></pre>
<script>
  window.addEventListener('error', function (e) { var f = document.getElementById('fatal'); if (f) { f.hidden = false; f.textContent = '오류: ' + (e.message || e); } });
</script>
${names.map((n) => `<script src="${n}"></script>`).join('\n')}
<script>var b = document.getElementById('boot'); if (b) b.remove();</script>
<script src="game.js"></script>
`;
fs.writeFileSync(path.join(out, 'index.html'), page);
const mb = (f) => (fs.statSync(path.join(out, f)).size / 1048576).toFixed(1);
console.log(['index.html', 'game.js', ...names].map((f) => `${f} ${mb(f)} MB`).join('\n'));
