// plugins/render/src/css.ts
// resolve mdx-forge component CSS bundles for package & repo runs

import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Framework =
  | 'generic'
  | 'docusaurus'
  | 'starlight'
  | 'nextra'
  | 'nextjs';

const cache = new Map<string, string>();
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..', '..', '..');
const CSS_SUBPATH_PREFIX = 'mdx-forge/components/styles/';
const CSS_IMPORT_PATTERN =
  /@import\s+(?:url\(\s*)?(?:(['"])([^'"]+)\1|([^'")\s]+))(?:\s*\))?\s*([^;]*);/g;

async function loadCss(subpath: string): Promise<string> {
  const filePath = await resolveCssPath(subpath);
  const cached = cache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }
  const css = await loadCssFile(filePath, new Set<string>());
  cache.set(filePath, css);
  return css;
}

async function resolveCssPath(subpath: string): Promise<string> {
  const sourcePath = sourceCssPath(subpath);
  if (sourcePath && (await fileExists(sourcePath))) {
    return sourcePath;
  }
  return fileURLToPath(import.meta.resolve(subpath));
}

function sourceCssPath(subpath: string): string | undefined {
  if (!subpath.startsWith(CSS_SUBPATH_PREFIX)) {
    return undefined;
  }
  return resolve(
    REPO_ROOT,
    'src',
    'components',
    'styles',
    subpath.slice(CSS_SUBPATH_PREFIX.length)
  );
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadCssFile(
  filePath: string,
  stack: Set<string>
): Promise<string> {
  const cached = cache.get(filePath);
  if (cached !== undefined) {
    return cached;
  }
  if (stack.has(filePath)) {
    throw new Error(`circular CSS @import detected: ${filePath}`);
  }

  stack.add(filePath);
  try {
    const css = await readFile(filePath, 'utf8');
    const inlined = await inlineCssImports(css, filePath, stack);
    cache.set(filePath, inlined);
    return inlined;
  } finally {
    stack.delete(filePath);
  }
}

async function inlineCssImports(
  css: string,
  importerPath: string,
  stack: Set<string>
): Promise<string> {
  const chunks: string[] = [];
  let lastIndex = 0;

  for (const match of css.matchAll(CSS_IMPORT_PATTERN)) {
    if (match.index === undefined) {
      continue;
    }

    chunks.push(css.slice(lastIndex, match.index));

    const specifier = match[2] ?? match[3];
    const modifiers = match[4]?.trim();

    if (specifier && !modifiers && shouldInlineImport(specifier)) {
      const importedCss = await loadCssFile(
        resolveCssImport(specifier, importerPath),
        stack
      );
      chunks.push(importedCss);
    } else {
      chunks.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  chunks.push(css.slice(lastIndex));
  return chunks.join('');
}

function shouldInlineImport(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/') ||
    specifier.startsWith('file://')
  );
}

function resolveCssImport(specifier: string, importerPath: string): string {
  if (specifier.startsWith('file://')) {
    return fileURLToPath(specifier);
  }
  return resolve(dirname(importerPath), specifier);
}

export async function tokensCss(): Promise<string> {
  return loadCss('mdx-forge/components/styles/tokens.css');
}

// Next.js has no bundled CSS — consumers bring their own
export async function resolveFrameworkCss(
  framework: Framework
): Promise<string> {
  if (framework === 'nextjs') {
    return '';
  }
  return loadCss(`mdx-forge/components/styles/${framework}.css`);
}
