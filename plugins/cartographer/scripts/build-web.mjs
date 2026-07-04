#!/usr/bin/env node
// plugins/cartographer/scripts/build-web.mjs
// bundle the React Flow preview app into dist/web/ via esbuild

import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist/web', { recursive: true });

await build({
  entryPoints: { app: 'src/web/main.tsx' },
  bundle: true,
  format: 'iife',
  outdir: 'dist/web',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});

copyFileSync('src/web/index.html', 'dist/web/index.html');
console.log('web -> dist/web/');
