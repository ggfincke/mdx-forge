#!/usr/bin/env node
// scripts/plugin-compat.mjs
// prove the nested render plugin against its locked minimum core & the
// current packed core: clean install, typecheck, build, bounded smokes

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_DIR = path.join(REPO_ROOT, 'plugins', 'render');

const args = process.argv.slice(2);
const tarballArgIndex = args.indexOf('--tarball');
const providedTarball =
  tarballArgIndex !== -1 ? path.resolve(args[tarballArgIndex + 1]) : null;
const legArgIndex = args.indexOf('--leg');
const leg = legArgIndex !== -1 ? args[legArgIndex + 1] : 'all';

function run(command, commandArgs, cwd, env = {}) {
  console.log(`\n$ ${command} ${commandArgs.join(' ')}  (cwd: ${cwd})`);
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

// bounded smoke set: diagnostics (no browser), safe render & diagram fences
// currentCore additionally asserts the unified diagnostics engine behaviors
function runBoundedSmokes(pluginCopy, currentCore) {
  run(
    'node',
    ['scripts/smoke-diagnostics.mjs'],
    pluginCopy,
    currentCore ? { MDX_FORGE_EXPECT_UNIFIED_DIAGNOSTICS: '1' } : {}
  );
  run('node', ['scripts/smoke.mjs'], pluginCopy);
  run(
    'node',
    ['scripts/smoke-diagrams.mjs'],
    pluginCopy,
    currentCore ? { MDX_FORGE_EXPECT_DIAGRAM_CODE: '1' } : {}
  );
}

function copyPlugin(destination) {
  fs.cpSync(PLUGIN_DIR, destination, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== 'node_modules' && base !== 'dist';
    },
  });
}

// --- static assertions: runtime imports vs manifest & tool-surface text ------

function collectImportSpecifiers(source) {
  const all = new Set();
  const typeOnly = new Set();
  for (const match of source.matchAll(
    /import\s+type\b[\s\S]*?from\s+['"]([^'"\n]+)['"]/g
  )) {
    typeOnly.add(match[1]);
  }
  for (const match of source.matchAll(/from\s+['"]([^'"\n]+)['"]/g)) {
    all.add(match[1]);
  }
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"\n]+)['"]/gm)) {
    all.add(match[1]);
  }
  for (const match of source.matchAll(
    /import\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
  )) {
    all.add(match[1]);
  }
  return { all, typeOnly };
}

function toPackageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function assertRuntimeDepsDeclared() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PLUGIN_DIR, 'package.json'), 'utf8')
  );
  const deps = new Set(Object.keys(manifest.dependencies ?? {}));
  const srcDir = path.join(PLUGIN_DIR, 'src');
  const failures = [];

  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith('.ts')) {
      continue;
    }
    const source = fs.readFileSync(path.join(srcDir, name), 'utf8');
    const { all, typeOnly } = collectImportSpecifiers(source);
    for (const specifier of all) {
      if (specifier.startsWith('.') || specifier.startsWith('node:')) {
        continue;
      }
      // type-only imports are erased; @types/* dev declarations suffice
      const runtimeUse = !typeOnly.has(specifier);
      if (!runtimeUse) {
        continue;
      }
      const pkg = toPackageName(specifier);
      if (!deps.has(pkg)) {
        failures.push(`${name}: runtime import "${pkg}" not in dependencies`);
      }
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    throw new Error('plugin runtime imports missing from dependencies');
  }
  console.log('Plugin runtime imports are all declared dependencies.');
}

function assertToolSurfaceDescriptions() {
  const requiredMentions = ['render_mdx', 'list_components'];
  const pluginMeta = JSON.parse(
    fs.readFileSync(
      path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'),
      'utf8'
    )
  );
  const marketplace = JSON.parse(
    fs.readFileSync(
      path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json'),
      'utf8'
    )
  );
  const renderEntry = marketplace.plugins.find(
    (p) => p.name === 'mdx-forge-render'
  );

  const targets = [
    ['plugins/render/.claude-plugin/plugin.json', pluginMeta.description],
    [
      '.claude-plugin/marketplace.json (render entry)',
      renderEntry?.description,
    ],
  ];
  for (const [label, description] of targets) {
    for (const mention of requiredMentions) {
      if (!description || !description.includes(mention)) {
        throw new Error(`${label} description does not mention ${mention}`);
      }
    }
  }
  console.log('Plugin metadata descriptions match the real tool surface.');
}

// --- legs ---------------------------------------------------------------------

function packCurrentCore(workDir) {
  if (providedTarball) {
    return providedTarball;
  }
  run('npm', ['run', 'build'], REPO_ROOT);
  const output = execFileSync('npm', ['pack', '--pack-destination', workDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const tarballName = output.trim().split('\n').pop();
  return path.join(workDir, tarballName);
}

function runMinimumLeg(workDir) {
  console.log('\n=== plugin-compat leg: locked minimum core ===');
  const copy = path.join(workDir, 'plugin-minimum');
  copyPlugin(copy);
  run('npm', ['ci', '--no-audit', '--no-fund'], copy);
  run('npm', ['run', 'typecheck'], copy);
  run('npm', ['run', 'build'], copy);
  runBoundedSmokes(copy, false);
}

function runCurrentLeg(workDir, tarballPath) {
  console.log('\n=== plugin-compat leg: current packed core ===');
  const copy = path.join(workDir, 'plugin-current');
  copyPlugin(copy);
  run('npm', ['ci', '--no-audit', '--no-fund'], copy);
  run('npm', ['install', '--no-audit', '--no-fund', tarballPath], copy);
  run('npm', ['run', 'typecheck'], copy);
  run('npm', ['run', 'build'], copy);
  runBoundedSmokes(copy, true);
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-forge-compat-'));
console.log(`plugin-compat work dir: ${workDir}`);

try {
  assertRuntimeDepsDeclared();
  assertToolSurfaceDescriptions();

  if (leg === 'minimum' || leg === 'all') {
    runMinimumLeg(workDir);
  }
  if (leg === 'current' || leg === 'all') {
    const tarballPath = packCurrentCore(workDir);
    runCurrentLeg(workDir, tarballPath);
  }
  console.log('\nplugin-compat: all requested legs passed.');
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
