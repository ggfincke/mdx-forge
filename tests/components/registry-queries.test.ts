// tests/components/registry-queries.test.ts
// unit tests for registry package query helpers

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { describe, it, expect } from 'vitest';
import {
  getComponentMetadata,
  getFrameworkComponentEntries,
  getAllGenericComponentNames,
  getGenericComponentSet,
  getPrimaryGenericComponentNames,
  getCanonicalComponentName,
  getFrameworkComponents,
  isGenericComponent,
  isFrameworkComponent,
  getGenericShimPath,
  getFrameworkShimPath,
  SHIM_BARREL_CONFIG,
} from '../../src/components/registry/index';

const HERE = dirname(fileURLToPath(import.meta.url));

// map shim-barrel outputPath -> framework folder name
function frameworkFromOutputPath(outputPath: string): string {
  return outputPath.replace(/\\/g, '/').split('/')[2];
}

// parse value & type re-export names from a framework index.ts barrel
function parseBarrelExports(framework: string): {
  values: Set<string>;
  types: Set<string>;
} {
  const src = readFileSync(
    resolve(HERE, `../../src/components/${framework}/index.ts`),
    'utf8'
  );
  const values = new Set<string>();
  const types = new Set<string>();
  // match each `export { ... } from '...'` block (single- or multi-line)
  const blockRe = /export\s*\{([^}]*)\}\s*from/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(src)) !== null) {
    for (const raw of match[1].split(',')) {
      const name = raw.trim();
      if (!name) {
        continue;
      }
      if (name.startsWith('type ')) {
        types.add(name.slice(5).trim());
      } else {
        values.add(name);
      }
    }
  }
  return { values, types };
}

describe('registry queries', () => {
  it('returns generic component names including aliases', () => {
    const names = getAllGenericComponentNames();

    expect(names).toContain('Callout');
    expect(names).toContain('Alert');
    expect(names).toContain('Admonition');
  });

  it('caches generic names and set instances', () => {
    const namesA = getAllGenericComponentNames();
    const namesB = getAllGenericComponentNames();
    const setA = getGenericComponentSet();
    const setB = getGenericComponentSet();

    expect(namesA).toBe(namesB);
    expect(setA).toBe(setB);
  });

  it('returns primary generic names without aliases', () => {
    const names = getPrimaryGenericComponentNames();

    expect(names).toContain('Callout');
    expect(names).toContain('Tabs');
    expect(names).not.toContain('Alert');
  });

  it('resolves canonical names for aliases and direct names', () => {
    expect(getCanonicalComponentName('Alert')).toBe('Callout');
    expect(getCanonicalComponentName('Callout')).toBe('Callout');
    expect(getCanonicalComponentName('UnknownComponent')).toBeUndefined();
  });

  it('detects generic and framework components', () => {
    expect(isGenericComponent('Callout')).toBe(true);
    expect(isGenericComponent('Admonition')).toBe(true);
    expect(isGenericComponent('Card')).toBe(false);

    expect(isFrameworkComponent('Tabs', 'docusaurus')).toBe(true);
    expect(isFrameworkComponent('Card', 'docusaurus')).toBe(false);
    expect(isFrameworkComponent('Card')).toBe(true);
    expect(isFrameworkComponent('DoesNotExist')).toBe(false);
  });

  it('returns framework component lists', () => {
    const docusaurus = getFrameworkComponents('docusaurus');
    const starlight = getFrameworkComponents('starlight');

    expect(docusaurus).toContain('Tabs');
    expect(docusaurus).toContain('CodeBlock');
    expect(starlight).toContain('Card');
    expect(starlight).toContain('FileTree');
  });

  it('returns framework component entries w/ metadata', () => {
    const entries = getFrameworkComponentEntries('nextjs');

    expect(entries.map((entry) => entry.name)).toEqual(['Image', 'Link']);
    expect(entries[0].metadata.summary).toContain('Next.js image');
  });

  it('finds component metadata by primary name and alias', () => {
    const callout = getComponentMetadata('generic', 'Callout');
    const alert = getComponentMetadata('generic', 'Alert');

    expect(callout?.summary).toContain('Callout box');
    expect(alert).toBe(callout);
  });

  it('builds expected shim paths', () => {
    expect(getGenericShimPath('Callout')).toBe(
      '@mdx-preview/shims/generic/Callout'
    );
    expect(getFrameworkShimPath('docusaurus', 'Tabs')).toBe(
      '@mdx-preview/shims/docusaurus/Tabs'
    );
  });

  it('shim-barrel config exports match framework barrel re-exports', () => {
    for (const entry of SHIM_BARREL_CONFIG) {
      const framework = frameworkFromOutputPath(entry.outputPath);
      const barrel = parseBarrelExports(framework);

      const configValues = new Set<string>();
      const configTypes = new Set<string>();
      for (const exp of entry.exports) {
        for (const v of exp.values ?? []) {
          configValues.add(v);
        }
        for (const t of exp.types ?? []) {
          configTypes.add(t);
        }
      }

      // both directions: config <-> framework barrel
      expect([...configValues].sort()).toEqual([...barrel.values].sort());
      expect([...configTypes].sort()).toEqual([...barrel.types].sort());
    }
  });
});
