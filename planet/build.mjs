// Build: bundle the generation worker to a string, then bundle the game with
// the worker inlined (so the game runs from a single script, even from file://).
import * as esbuild from 'esbuild';

const minify = !process.argv.includes('--dev');
const worker = await esbuild.build({
  entryPoints: ['src/world/genworker.js'], bundle: true, format: 'iife', write: false, minify, target: 'es2020',
});
const workerCode = worker.outputFiles[0].text;
await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', outfile: 'game.js', minify, target: 'es2020',
  legalComments: 'none', sourcemap: minify ? false : 'inline', loader: { '.glb': 'binary' },
  plugins: [{
    name: 'inline-worker',
    setup(b) {
      b.onResolve({ filter: /^virtual:genworker$/ }, () => ({ path: 'genworker', namespace: 'inline' }));
      b.onLoad({ filter: /.*/, namespace: 'inline' }, () => ({ contents: 'export default ' + JSON.stringify(workerCode) + ';', loader: 'js' }));
    },
  }],
});
console.log('built game.js', minify ? '(minified)' : '(dev)');
