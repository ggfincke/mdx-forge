// scripts/fix-esm-import-specifiers.mjs
// add explicit extensions to relative specifiers in compiled ESM & declarations

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const esmDir = process.env.MDX_FORGE_ESM_DIR
  ? path.resolve(process.env.MDX_FORGE_ESM_DIR)
  : path.resolve(__dirname, '..', 'dist', 'esm');
const typesDir = process.env.MDX_FORGE_TYPES_DIR
  ? path.resolve(process.env.MDX_FORGE_TYPES_DIR)
  : path.resolve(__dirname, '..', 'dist', 'types');

const KNOWN_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
];

// per-tree config: which files on disk prove the target exists & what
// extension NodeNext consumers must see in the rewritten specifier
const TREE_CONFIGS = [
  {
    dir: esmDir,
    isTarget: (name) => name.endsWith('.js'),
    candidateExts: ['.js'],
    emitExt: '.js',
  },
  {
    dir: typesDir,
    isTarget: (name) => name.endsWith('.d.ts'),
    // NodeNext maps ./x.js -> ./x.d.ts, so declarations also emit .js
    candidateExts: ['.d.ts'],
    emitExt: '.js',
  },
];

function hasKnownExtension(specifier) {
  return KNOWN_EXTENSIONS.some((ext) => specifier.endsWith(ext));
}

// relative specifiers, including bare '.' & '..' directory references
const RELATIVE_SPECIFIER = /^\.\.?(\/|$)/;

function resolveSpecifier(filePath, specifier, config) {
  if (!RELATIVE_SPECIFIER.test(specifier)) {
    return specifier;
  }

  if (hasKnownExtension(specifier)) {
    return specifier;
  }

  const basePath = path.resolve(path.dirname(filePath), specifier);
  for (const ext of config.candidateExts) {
    const fileCandidate = `${basePath}${ext}`;
    if (fs.existsSync(fileCandidate) && fs.statSync(fileCandidate).isFile()) {
      return `${specifier}${config.emitExt}`;
    }

    const indexCandidate = path.join(basePath, `index${ext}`);
    if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
      return specifier.endsWith('/')
        ? `${specifier}index${config.emitExt}`
        : `${specifier}/index${config.emitExt}`;
    }
  }

  return specifier;
}

function rewriteSpecifiers(filePath, source, config) {
  // import/export ... from '...'
  let next = source.replace(
    /(from\s+)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g,
    (match, prefix, quote, specifier) => {
      const resolved = resolveSpecifier(filePath, specifier, config);
      return `${prefix}${quote}${resolved}${quote}`;
    }
  );

  // dynamic import() & declaration import('...') type references
  next = next.replace(
    /(import\s*\(\s*)(['"])(\.{1,2}(?:\/[^'"]*)?)\2(\s*\))/g,
    (match, prefix, quote, specifier, suffix) => {
      const resolved = resolveSpecifier(filePath, specifier, config);
      return `${prefix}${quote}${resolved}${quote}${suffix}`;
    }
  );

  // side-effect imports: import './x'
  next = next.replace(
    /(\bimport\s+)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g,
    (match, prefix, quote, specifier) => {
      const resolved = resolveSpecifier(filePath, specifier, config);
      return `${prefix}${quote}${resolved}${quote}`;
    }
  );

  return next;
}

function listTargetFiles(dir, isTarget) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTargetFiles(fullPath, isTarget));
      continue;
    }

    if (entry.isFile() && isTarget(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

const checkOnly = process.argv.includes('--check');

let totalFiles = 0;
let changedFiles = 0;
const wouldChangeFiles = [];

for (const config of TREE_CONFIGS) {
  if (!fs.existsSync(config.dir)) {
    console.error(`Output directory not found: ${config.dir}`);
    process.exit(1);
  }

  const files = listTargetFiles(config.dir, config.isTarget);
  totalFiles += files.length;

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const rewritten = rewriteSpecifiers(filePath, source, config);
    if (rewritten !== source) {
      changedFiles += 1;
      if (checkOnly) {
        wouldChangeFiles.push(path.relative(config.dir, filePath));
        continue;
      }
      fs.writeFileSync(filePath, rewritten, 'utf8');
    }
  }
}

if (checkOnly) {
  if (wouldChangeFiles.length > 0) {
    console.error(
      `Found ${wouldChangeFiles.length} files with unresolved ESM specifiers.`
    );
    for (const relativePath of wouldChangeFiles) {
      console.error(` - ${relativePath}`);
    }
    process.exit(1);
  }

  console.log(`ESM import/export specifiers are valid in ${totalFiles} files.`);
  process.exit(0);
}

console.log(
  `Fixed ESM import/export specifiers in ${changedFiles}/${totalFiles} files.`
);
