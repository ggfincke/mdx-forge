#!/usr/bin/env node
// scripts/check-frontmatter-imports.mjs
// guard direct gray-matter imports to vetted safe wrappers

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { collectFiles, normalizePath } from './lib/collect-files.mjs';

const SCAN_ENTRIES = ['src', 'plugins/render/src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const IGNORED_DIRECTORIES = new Set(['dist', 'node_modules']);
const ALLOWED_IMPORTS = new Set([
  'src/internal/frontmatter.ts',
  'plugins/render/src/lint.ts',
]);

function hasRawGrayMatterImport(source) {
  return /(?:from\s+['"]gray-matter['"]|import\s*\(\s*['"]gray-matter['"]\s*\)|require\s*\(\s*['"]gray-matter['"]\s*\))/.test(
    source
  );
}

function main() {
  const rootDir = process.cwd();
  const violations = [];
  const files = collectFiles(rootDir, SCAN_ENTRIES, {
    extensions: SOURCE_EXTENSIONS,
    ignoredDirectories: IGNORED_DIRECTORIES,
  }).map((absolutePath) => normalizePath(relative(rootDir, absolutePath)));

  for (const file of files) {
    if (ALLOWED_IMPORTS.has(file)) {
      continue;
    }

    const source = readFileSync(join(rootDir, file), 'utf-8');
    if (hasRawGrayMatterImport(source)) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    console.error('Raw gray-matter imports must stay inside safe wrappers:');
    for (const file of violations) {
      console.error(`  - ${file}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('gray-matter import guard passed');
}

main();
