// src/browser/internal/module-id.ts
// module specifier parsing & npm URL utilities
// ! cross-repo duplicate: mirror runtime-utils module-id behavior

const NPM_MODULE_PREFIX = 'npm://';

export function isBareImport(specifier: string): boolean {
  return (
    !specifier.startsWith('/') &&
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}
