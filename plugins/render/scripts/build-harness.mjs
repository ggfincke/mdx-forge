#!/usr/bin/env node
// bundle the Trusted Mode harness once per framework
//
// produces dist/harness/{framework}/{bundle.js,index.html}

import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

const FRAMEWORKS = ['generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'];

const HARNESS_HTML = resolve(ROOT, 'harness/index.html');
const HARNESS_ENTRY = resolve(ROOT, 'harness/entry.ts');
const OUT_DIR = resolve(ROOT, 'dist/harness');

async function bundleFramework(framework) {
  const outDir = resolve(OUT_DIR, framework);
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: [HARNESS_ENTRY],
    bundle: true,
    outfile: resolve(outDir, 'bundle.js'),
    // IIFE dodges file:// CORS restrictions on ES module script loading
    format: 'iife',
    platform: 'browser',
    target: ['chrome120'],
    sourcemap: 'linked',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    // alias the virtual shim module to the per-framework barrel
    alias: {
      'virtual:mdx-forge-shims': `mdx-forge/components/${framework}`,
    },
    resolveExtensions: ['.ts', '.tsx', '.js', '.mjs', '.jsx'],
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    logLevel: 'warning',
    absWorkingDir: ROOT,
  });

  await copyFile(HARNESS_HTML, resolve(outDir, 'index.html'));
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const started = Date.now();
  // bundle frameworks in parallel - independent artifacts
  await Promise.all(FRAMEWORKS.map(bundleFramework));
  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  console.log(
    `mdx-forge-render: built ${FRAMEWORKS.length} harness bundles in ${elapsed}s`,
  );
}

main().catch((err) => {
  console.error('build-harness failed:', err);
  process.exit(1);
});
