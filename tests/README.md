# Tests

This directory contains the standalone test suite for mdx-forge.

## Philosophy

**Only major, important tests — not exhaustive coverage.**

We focus on testing critical paths that, if broken, would break library consumers:

- **Compilation Pipeline**: MDX to JS (trusted) & MDX to HTML (safe)
- **Component Registry**: Alias resolution, framework queries, shim paths
- **Browser Module Eval**: CJS evaluation, error preservation, runtime injection

We intentionally do not test:

- Every edge case or configuration combination
- Internal helper functions with obvious behavior
- Performance characteristics of utilities
- Behaviors already covered by the root monorepo test suite

## Enforcement Checklist

Before adding or expanding a suite, verify:

1. The test targets a production-critical boundary (compile, registry query, or eval)
2. The behavior is externally visible or contract-level (not an internal helper detail)
3. The case is representative, not a combinatorial variant of an already-covered behavior
4. The assertion does not depend on timing/performance thresholds
5. The same failure mode is not already covered at a higher level

If any check fails, do not add the test.

## Running Tests

```bash
# Run standalone tests
npm test

# Or directly
npx vitest run
```

## Structure

```
tests/
├── fixtures.ts                  # MDX fixture strings (shared across suites)
├── compiler/                    # MDX compilation (safe & trusted modes)
│   ├── safe-compile.test.ts
│   └── trusted-compile.test.ts
├── components/                  # Component registry & generic component rendering
│   ├── registry-queries.test.ts
│   ├── useTabState.test.ts
│   ├── generic-smoke.test.tsx
│   └── callout-types.test.tsx
├── browser/                     # Browser module evaluation
│   └── evaluate-module.test.ts
├── compiler-exports.test.ts     # Smoke: compiler public API surface
├── browser-exports.test.ts      # Smoke: browser public API surface
├── components-registry-exports.test.ts  # Smoke: registry public API surface
└── esm-specifier-script.test.ts # Build script: ESM specifier rewriting
```

## Adding Tests

Before adding a new test, ask:

1. Does this test a critical path that would break library consumers if it failed?
2. Is this behavior not already covered by existing tests?
3. Can this be tested in pure Node without VS Code mocks?
4. Is this a major contract-level concern, not a utility edge case?

If yes to all four, add the test. Otherwise, consider whether it's truly necessary.
