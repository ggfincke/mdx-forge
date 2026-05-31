// tests/components-registry-exports.test.ts
// verify component registry public API surface

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
});
