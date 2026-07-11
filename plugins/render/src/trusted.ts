// plugins/render/src/trusted.ts
// Trusted Mode compile, snapshot & harness bundle helpers

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { compileTrusted } from 'mdx-forge/compiler';
import type { FrameworkId } from './css.js';
import { runWithHarnessPage } from './harness-page.js';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = resolve(dirname(__filename), '..');

const IMPORT_SPECIFIER_PATTERN =
  /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"\n]+)['"]\s*;?\s*$/gm;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;

export interface TrustedCompiledModule {
  cjsCode: string;
  dependencies: string[];
  frontmatter: Record<string, unknown>;
  framework: FrameworkId;
  entryId: string;
}

function extractDependencies(esmCode: string): string[] {
  const deps = new Set<string>();
  for (const match of esmCode.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    deps.add(match[1]);
  }
  for (const match of esmCode.matchAll(DYNAMIC_IMPORT_PATTERN)) {
    deps.add(match[1]);
  }
  return Array.from(deps);
}

async function esmToCjs(esmCode: string): Promise<string> {
  const result = await transform(esmCode, {
    loader: 'js',
    format: 'cjs',
    target: 'chrome120',
    sourcemap: false,
    logLevel: 'silent',
  });
  return result.code;
}

function uniqueEntryId(): string {
  return `virtual://mdx-forge-render/${randomBytes(8).toString('hex')}.mdx`;
}

// no diagram runtime in the harness either: request visible code fallbacks
// (F34); older cores w/o the option ignore the key (graceful pass-through)
const TRUSTED_COMPILE_CONFIG = {
  documentPath: '/virtual/render.mdx',
  componentsBuiltins: false,
  diagramBehavior: 'code',
} as const;

export async function compileTrustedModule(
  source: string,
  framework: FrameworkId
): Promise<TrustedCompiledModule> {
  // disable builtin imports; harness preloads React, jsx-runtime & MDXProvider
  // shims are supplied at render time via MDXProvider components
  const compiled = await compileTrusted(source, true, TRUSTED_COMPILE_CONFIG);

  const dependencies = extractDependencies(compiled.code);
  const cjsCode = await esmToCjs(compiled.code);

  return {
    cjsCode,
    dependencies,
    frontmatter: compiled.frontmatter,
    framework,
    entryId: uniqueEntryId(),
  };
}

// render compiled module in harness for initial HTML & screenshot source
export async function snapshotTrustedModule(
  compiled: TrustedCompiledModule
): Promise<string> {
  const result = await runWithHarnessPage(compiled.framework, (page) =>
    page.evaluate(
      async ({ code, deps, entryId }) => {
        const api = (
          window as unknown as {
            __mdxForgeRender?: (
              code: string,
              deps: string[],
              entryId: string
            ) => Promise<{ html: string } | { error: string }>;
          }
        ).__mdxForgeRender;
        if (!api) {
          return { error: 'harness __mdxForgeRender not installed' };
        }
        return api(code, deps, entryId);
      },
      {
        code: compiled.cjsCode,
        deps: compiled.dependencies,
        entryId: compiled.entryId,
      }
    )
  );

  if ('error' in result) {
    throw new Error(`trusted render failed: ${result.error}`);
  }
  return result.html;
}

const bundleCache = new Map<FrameworkId, Promise<string>>();

// read per-framework IIFE bundle for inline artifacts or preview server refs
export function readHarnessBundle(framework: FrameworkId): Promise<string> {
  const cached = bundleCache.get(framework);
  if (cached) {
    return cached;
  }
  const filePath = resolve(
    PLUGIN_ROOT,
    'dist',
    'harness',
    framework,
    'bundle.js'
  );
  const pending = readFile(filePath, 'utf8').catch((err: unknown) => {
    bundleCache.delete(framework);
    throw err;
  });
  bundleCache.set(framework, pending);
  return pending;
}
