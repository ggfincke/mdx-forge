// scripts/copy-css.mjs
// copy CSS files from src/components/ to dist/components/

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { collectFiles } from './lib/collect-files.mjs';

const srcDir = resolve('src/components');
const outDir = resolve('dist/components');

for (const full of collectFiles(srcDir, ['.'], { extensions: ['.css'] })) {
  const dest = join(outDir, relative(srcDir, full));
  const parent = dirname(dest);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  cpSync(full, dest);
}
