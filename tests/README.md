# Tests

This directory contains the standalone `mdx-forge` test suite.

## Philosophy

Tests should protect contract-level behavior that matters to consumers:

- compiler entry points and output shape
- browser runtime evaluation and registry behavior
- component registry metadata and framework shims
- cross-repo parity for intentionally duplicated contracts

Avoid adding deep internal-helper coverage just because a helper exists.

## Running Tests

```bash
npm test
```

Or directly:

```bash
npx vitest run --config vitest.config.ts
```

## Current Layout

```text
tests/
├── browser/              # Browser runtime behavior and constants contracts
├── compiler/             # Safe and trusted compilation
├── components/           # Registry queries, generic components, framework shims
├── cross-repo/           # Cross-project metadata and utility parity
├── internal/             # Narrow internal contracts kept under test intentionally
├── browser-exports.test.ts
├── compiler-exports.test.ts
├── components-registry-exports.test.ts
├── esm-specifier-script.test.ts
└── fixtures.ts
```

Representative suites currently cover:

- `tests/compiler/safe-compile.test.ts`
- `tests/compiler/trusted-compile.test.ts`
- `tests/browser/evaluate-module.test.ts`
- `tests/browser/constants-contract.test.ts`
- `tests/components/registry-queries.test.ts`
- `tests/components/framework-shims-smoke.test.tsx`
- `tests/components/nextjs-shims.test.tsx`
- `tests/cross-repo/metadata-contract.test.ts`
- `tests/cross-repo/utility-parity.test.ts`

## Adding Tests

Before adding a new suite or case, ask:

1. Would a consumer notice this breakage?
2. Is the behavior part of a public or host-facing contract?
3. Is the case meaningfully different from what already exists?
4. Can the test stay deterministic without timing-sensitive assertions?

If the answer to any of those is no, the test probably does not belong here.
