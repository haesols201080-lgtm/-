// Build the single-page Artifact version of the game: the stylesheet and the
// minified bundle are inlined into one page (the Artifact sandbox only serves
// the page's own files), fonts are published beside it under assets/fonts.
// Usage: node build.mjs && node tools/make-artifact.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'artifact.html');
const css = readFileSync(join(root, 'style.css'), 'utf8');
const js = readFileSync(join(root, 'game.js'), 'utf8').replaceAll('</script', '<\\/script');
// the Artifact host wraps the page in its own <html>/<head> with a charset
const page = `<title>테라 제네시스</title>
<meta name="description" content="3D 오픈월드 테라포밍 · 식민지 건설 게임">
<style>
${css}
</style>
<div id="game"></div>
<div id="loading">
  <div class="load-box">
    <div class="load-title">TERRA GENESIS</div>
    <div class="load-sub">테라 제네시스 · 행성 개척 기록</div>
    <div class="load-track"><i id="load-bar"></i></div>
    <div id="load-text">초기화 중</div>
  </div>
</div>
<div id="ui"></div>
<script>
${js}
</script>
`;
writeFileSync(out, page);
console.log('wrote', out, (page.length / 1e6).toFixed(2) + ' MB');
