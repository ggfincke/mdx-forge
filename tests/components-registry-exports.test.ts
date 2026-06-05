// tests/components-registry-exports.test.ts
// verify component registry public API surface

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import {
  COMPONENT_METADATA,
  getComponentMetadata,
  getCanonicalComponentName,
  getFrameworkComponentEntries,
  getFrameworkComponents,
} from '../src/components/registry/index';

describe('components registry exports', () => {
  it('exposes stable query helpers', () => {
    expect(typeof getCanonicalComponentName).toBe('function');
    expect(typeof getFrameworkComponents).toBe('function');
    expect(typeof getComponentMetadata).toBe('function');
    expect(typeof getFrameworkComponentEntries).toBe('function');
    expect(typeof COMPONENT_METADATA).toBe('object');
  });

  it('keeps the registry entrypoint free of React component shims', async () => {
    const result = await build({
      absWorkingDir: process.cwd(),
      bundle: true,
      entryPoints: ['src/components/registry/index.ts'],
      format: 'esm',
      logLevel: 'silent',
      metafile: true,
      platform: 'node',
      write: false,
    });
    const inputs = Object.keys(result.metafile?.inputs ?? {});
    const componentShims = inputs.filter(
      (input) => input.startsWith('src/components/') && input.endsWith('.tsx')
    );

    expect(componentShims).toEqual([]);
    expect(inputs.some((input) => input.includes('node_modules/react'))).toBe(
      false
    );
  });
});
