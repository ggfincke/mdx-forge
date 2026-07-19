// tests/compiler-exports.test.ts
// verify compiler module public API surface

import { describe, expect, it } from 'vitest';
import * as compiler from '../src/compiler/index';

describe('compiler exports', () => {
  it('exposes primary compile entry points', () => {
    expect(typeof compiler.compileSafe).toBe('function');
    expect(typeof compiler.compileSafeDocument).toBe('function');
    expect(typeof compiler.compileTrusted).toBe('function');
    expect(compiler.SAFE_DOCUMENT_VERSION).toBe(1);
  });
});
