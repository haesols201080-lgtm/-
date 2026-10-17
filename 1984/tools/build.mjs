import * as esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', outfile: 'game.js',
  minify: !watch, sourcemap: watch ? 'inline' : false, target: ['es2020'], logLevel: 'info',
  legalComments: 'none',
};
if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); }
else await esbuild.build(opts);
