#!/usr/bin/env node
// scripts/check-frontmatter-imports.mjs
// guard direct gray-matter imports to vetted safe wrappers

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const SCAN_ENTRIES = ['src', 'plugins/render/src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);
const IGNORED_DIRECTORIES = new Set(['dist', 'node_modules']);
const ALLOWED_IMPORTS = new Set([
  'src/internal/frontmatter.ts',
  'plugins/render/src/lint.ts',
]);

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function collectSourceFiles(rootDir, currentPath, output) {
  if (!existsSync(currentPath)) {
    return;
  }

  const entries = readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      collectSourceFiles(rootDir, absolutePath, output);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    output.push(normalizePath(relative(rootDir, absolutePath)));
  }
}

function collectEntry(rootDir, entry, output) {
  const absolutePath = join(rootDir, entry);
  if (!existsSync(absolutePath)) {
    return;
  }

  if (statSync(absolutePath).isFile()) {
    if (SOURCE_EXTENSIONS.has(extname(entry))) {
      output.push(entry);
    }
    return;
  }

  collectSourceFiles(rootDir, absolutePath, output);
}

function hasRawGrayMatterImport(source) {
  return /(?:from\s+['"]gray-matter['"]|import\s*\(\s*['"]gray-matter['"]\s*\)|require\s*\(\s*['"]gray-matter['"]\s*\))/.test(
    source
  );
}

function main() {
  const rootDir = process.cwd();
  const files = [];
  const violations = [];

  for (const entry of SCAN_ENTRIES) {
    collectEntry(rootDir, entry, files);
  }

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
