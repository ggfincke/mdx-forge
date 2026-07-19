// scripts/lib/collect-files.mjs
// shared recursive file collector for guard & build scripts

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// normalize separators for stable cross-platform output
export function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

// collect files under entries (files or dirs) in depth-first readdir order
// filters file names by suffix; skips ignored dir names & missing entries
// returns absolute paths
export function collectFiles(rootDir, entries, options = {}) {
  const { extensions, ignoredDirectories } = options;
  const suffixes = extensions ? Array.from(extensions) : undefined;
  const ignored = ignoredDirectories ?? new Set();
  const output = [];

  const matches = (name) =>
    !suffixes || suffixes.some((suffix) => name.endsWith(suffix));

  function walk(currentPath) {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          walk(absolutePath);
        }
        continue;
      }

      if (matches(entry.name)) {
        output.push(absolutePath);
      }
    }
  }

  for (const entry of entries) {
    const absolutePath = resolve(rootDir, entry);
    if (!existsSync(absolutePath)) {
      continue;
    }

    if (statSync(absolutePath).isFile()) {
      if (matches(absolutePath)) {
        output.push(absolutePath);
      }
      continue;
    }

    walk(absolutePath);
  }

  return output;
}
