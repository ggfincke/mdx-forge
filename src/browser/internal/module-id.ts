// src/browser/internal/module-id.ts
// module specifier parsing & npm URL utilities
// ! cross-repo duplicate: vsc-mdx-preview/packages/runtime-utils/src/module-id/module-id.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

const NPM_MODULE_PREFIX = 'npm://';

export function isBareImport(specifier: string): boolean {
  return (
    !specifier.startsWith('/') &&
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}
