// tests/internal/render-budgets.test.ts
// F29: render input/output budgets are enforced in the direct API

import { describe, it, expect } from 'vitest';
import {
  MAX_SOURCE_BYTES,
  MAX_VARIANT_PIXELS,
  MAX_VIEWPORT_DIMENSION,
  validatePixelBudgets,
  validateRenderBudgets,
} from '../../plugins/render/src/render';
import { RenderDiagnosticError } from '../../plugins/render/src/diagnostics';

describe('validateRenderBudgets', () => {
  it('accepts source & viewport at the caps', () => {
    expect(() =>
      validateRenderBudgets({
        source: 'x'.repeat(MAX_SOURCE_BYTES),
        viewport: {
          width: MAX_VIEWPORT_DIMENSION,
          height: MAX_VIEWPORT_DIMENSION,
        },
      })
    ).not.toThrow();
  });

  it('rejects source over the byte cap', () => {
    expect(() =>
      validateRenderBudgets({ source: 'x'.repeat(MAX_SOURCE_BYTES + 1) })
    ).toThrow(RenderDiagnosticError);
  });

  it('rejects a viewport dimension over the cap', () => {
    expect(() =>
      validateRenderBudgets({
        source: '# hi',
        viewport: { width: MAX_VIEWPORT_DIMENSION + 1 },
      })
    ).toThrow(RenderDiagnosticError);
  });
});

describe('validatePixelBudgets', () => {
  const viewport = (width: number, height: number) => ({
    theme: 'light' as const,
    viewport: { width, height },
  });

  it('accepts a variant at the per-variant pixel cap', () => {
    expect(() =>
      validatePixelBudgets({
        variants: [viewport(1000, MAX_VARIANT_PIXELS / 1000)],
        fullPage: true,
      })
    ).not.toThrow();
  });

  it('rejects a variant over the per-variant pixel cap', () => {
    expect(() =>
      validatePixelBudgets({
        variants: [viewport(4000, 4000)],
        fullPage: true,
      })
    ).toThrow(RenderDiagnosticError);
  });

  it('rejects an aggregate over the pixel cap across variants', () => {
    // eight in-bounds variants (6.25 MP each) whose sum exceeds the aggregate cap
    const variants = Array.from({ length: 8 }, () => viewport(2500, 2500));
    expect(() => validatePixelBudgets({ variants, fullPage: true })).toThrow(
      RenderDiagnosticError
    );
  });
});
