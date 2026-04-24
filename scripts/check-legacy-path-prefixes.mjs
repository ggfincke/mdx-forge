#!/usr/bin/env node
// scripts/check-legacy-path-prefixes.mjs
// fail if deprecated extracted-repo paths appear in active files

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const SCAN_ENTRIES = [
  'src',
  'tests',
  'scripts',
  'dev',
  'plugins/render/src',
  'plugins/render/harness',
  'plugins/render/scripts',
  'README.md',
  'dev-docs',
  'package.json',
  'eslint.config.mjs',
  'vitest.config.ts',
];
const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.css',
  '.md',
  '.mdx',
  '.json',
]);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.claude-plugin',
  'coverage',
  'dist',
  'node_modules',
  'old',
]);

const LEGACY_PATTERNS = [
  {
    label: ['packages', 'extension', ''].join('/'),
    regex: /\bpackages\/extension\//,
  },
  {
    label: ['packages', 'webview-app', ''].join('/'),
    regex: /\bpackages\/webview-app\//,
  },
];

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function collectFiles(rootDir, currentPath, output) {
  if (!existsSync(currentPath)) {
    return;
  }

  const stats = statSync(currentPath);
  if (stats.isFile()) {
    if (ALLOWED_EXTENSIONS.has(extname(currentPath))) {
      output.push(currentPath);
    }
    return;
  }

  const entries = readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      collectFiles(rootDir, absolutePath, output);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    output.push(absolutePath);
  }
}

function scanFile(rootDir, absolutePath) {
  const violations = [];
  const contents = readFileSync(absolutePath, 'utf-8');
  const lines = contents.split(/\r?\n/);
  const relativePath = normalizePath(relative(rootDir, absolutePath));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const pattern of LEGACY_PATTERNS) {
      if (!pattern.regex.test(line)) {
        continue;
      }

      violations.push({
        file: relativePath,
        line: index + 1,
        pattern: pattern.label,
        snippet: line.trim(),
      });
    }
  }

  return violations;
}

try {
  const rootDir = process.cwd();
  const filesToScan = [];

  for (const entry of SCAN_ENTRIES) {
    collectFiles(rootDir, join(rootDir, entry), filesToScan);
  }

  const uniqueFiles = Array.from(new Set(filesToScan)).sort();
  const violations = [];
  for (const filePath of uniqueFiles) {
    violations.push(...scanFile(rootDir, filePath));
  }

  if (violations.length > 0) {
    console.error(
      `Legacy path prefix check FAILED (${violations.length} violation(s)).`
    );
    const labels = LEGACY_PATTERNS.map((pattern) => pattern.label).join(', ');
    console.error(`Deprecated prefixes: ${labels}`);
    console.error('');

    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.line} [${violation.pattern}] ${violation.snippet}`
      );
    }

    process.exit(1);
  }

  console.log(
    `Legacy path prefix check passed (${uniqueFiles.length} file(s) scanned).`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error checking legacy path prefixes:', message);
  process.exit(1);
}
