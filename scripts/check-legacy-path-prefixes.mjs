#!/usr/bin/env node
// scripts/check-legacy-path-prefixes.mjs
// fail if deprecated extracted-repo paths appear in active files

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { collectFiles, normalizePath } from './lib/collect-files.mjs';

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
  const filesToScan = collectFiles(rootDir, SCAN_ENTRIES, {
    extensions: ALLOWED_EXTENSIONS,
    ignoredDirectories: IGNORED_DIRECTORIES,
  });

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
