// 세렌 빌드 스크립트
// src/ 의 ES 모듈과 three.js 를 하나로 묶어 index.html 한 파일로 만듭니다.
// 결과 파일은 더블클릭(file://)으로도, 웹 서버로도 바로 실행됩니다.
//   node tools/build.mjs          한 번 빌드
//   node tools/build.mjs --watch  소스가 바뀔 때마다 다시 빌드
//   node tools/build.mjs --dev    압축 없이 빌드 (디버깅용)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const dev = process.argv.includes('--dev');

// `import src from 'worker:./파일.js'` → 해당 파일을 따로 번들해 문자열로 넣는다 (Blob 워커용)
const workerPlugin = {
  name: 'inline-worker',
  setup(build) {
    build.onResolve({ filter: /^worker:/ }, (args) => ({
      path: join(args.resolveDir, args.path.slice('worker:'.length)),
      namespace: 'inline-worker',
    }));
    build.onLoad({ filter: /.*/, namespace: 'inline-worker' }, async (args) => {
      const r = await esbuild.build({
        entryPoints: [args.path], bundle: true, format: 'iife', minify: !dev, write: false,
        target: ['es2020', 'safari15'], legalComments: 'none', metafile: true,
      });
      return {
        contents: `export default ${JSON.stringify(r.outputFiles[0].text)};`,
        loader: 'js',
        watchFiles: Object.keys(r.metafile.inputs).map((f) => join(root, f)),
      };
    });
  },
};

async function buildOnce() {
  const t0 = Date.now();
  const result = await esbuild.build({
    plugins: [workerPlugin],
    entryPoints: [join(root, 'src/main.js')],
    bundle: true,
    format: 'iife',
    minify: !dev,
    sourcemap: false,
    write: false,
    target: ['es2020', 'safari15'],
    legalComments: 'none',
    logLevel: 'warning',
    define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(join(root, 'src/style.css'), 'utf8');
  const tpl = readFileSync(join(root, 'src/index.html'), 'utf8');
  const html = tpl
    .replace('/*__CSS__*/', () => css)
    .replace('//__JS__', () => js);
  const out = join(root, 'index.html');
  writeFileSync(out, html);
  // 아티팩트(claude.ai) 게시용: 문서 뼈대(doctype·html·head·body)는 게시할 때 씌워지므로 빼고 내용만
  const art = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '')
    .replace(/<\/?head>\s*/gi, '')
    .replace(/<\/?body>\s*/gi, '')
    .replace(/<\/html>\s*/i, '')
    .replace('<meta charset="utf-8">', '')
    .replace(/<title>[^<]*<\/title>/, '<title>울림이 남는 별 세렌</title>');
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', 'seren-artifact.html'), art);
  const kb = (statSync(out).size / 1024).toFixed(0);
  console.log(`[build] index.html ${kb} KB (${Date.now() - t0} ms)`);
}

if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildOnce().catch((e) => console.error(e.message)), 80);
  };
  fsWatch(join(root, 'src'), { recursive: true }, rebuild);
  await buildOnce().catch((e) => console.error(e.message));
  console.log('[build] watching src/ …');
} else {
  await buildOnce();
}
