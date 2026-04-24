// plugins/render/src/trusted.ts
// Trusted Mode compile, snapshot & harness bundle helpers

import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { compileTrusted } from 'mdx-forge/compiler';
import type { Framework } from './css.js';
import { getHarnessPage } from './harness-page.js';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = resolve(dirname(__filename), '..');

const IMPORT_SPECIFIER_PATTERN =
  /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"\n]+)['"]\s*;?\s*$/gm;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;

export interface TrustedCompiledModule {
  cjsCode: string;
  dependencies: string[];
  frontmatter: Record<string, unknown>;
  framework: Framework;
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

export async function compileTrustedModule(
  source: string,
  framework: Framework
): Promise<TrustedCompiledModule> {
  // disable builtin imports so the only remaining deps are react +
  // jsx-runtime + @mdx-js/react (all preloaded in the harness). framework
  // shims are supplied at render time via MDXProvider components.
  const compiled = await compileTrusted(source, true, {
    documentPath: '/virtual/render.mdx',
    componentsBuiltins: false,
  });

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

// render the compiled module in the headless harness to produce the initial
// innerHTML snapshot. used for the MCP `html` field + PNG screenshot source.
export async function snapshotTrustedModule(
  compiled: TrustedCompiledModule
): Promise<string> {
  const page = await getHarnessPage(compiled.framework);

  const result = await page.evaluate(
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
  );

  if ('error' in result) {
    throw new Error(`trusted render failed: ${result.error}`);
  }
  return result.html;
}

const bundleCache = new Map<Framework, Promise<string>>();

// read the per-framework IIFE bundle from disk. interactive preview documents
// embed this directly (for claude.ai artifact self-containment) or reference
// it via the preview server at /harness/:framework/bundle.js.
export function readHarnessBundle(framework: Framework): Promise<string> {
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
