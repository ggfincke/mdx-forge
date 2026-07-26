// src/components/registry/index.ts
// barrel exports for component registry

import type { FrameworkId } from './types'

export * from './types'
export * from './component-metadata'
export * from './registry-data'
export * from './queries'
export * from './shim-config'

// canonical ordered framework ids (generic + core Framework members)
// single source of truth for framework enumeration across the repo
export const FRAMEWORK_IDS = [
  'generic',
  'docusaurus',
  'starlight',
  'nextra',
  'nextjs',
] as const satisfies readonly FrameworkId[]

// compile-time guard: every FrameworkId must appear in FRAMEWORK_IDS
type _AssertAllFrameworkIds =
  Exclude<FrameworkId, (typeof FRAMEWORK_IDS)[number]> extends never
    ? true
    : never
const _frameworkIdsExhaustive: _AssertAllFrameworkIds = true
void _frameworkIdsExhaustive
