// skills/mdx-forge/examples/browser-setup.ts
// minimal browser runtime setup for Trusted Mode rendering
//
// runs in a browser-like environment (jsdom, headless Chromium, real browser)
// imports use the package subpath so a bundler resolves them at build time

import {
  registerPreloadEntries,
  setModuleFetcher,
  evaluateModuleToComponent,
  configureRuntime,
  resetModules,
  type FetchResult,
  type PreloadEntry,
} from 'mdx-forge/browser';

// 1. register preloaded modules — React, MDX runtime, framework shims, etc.
//    the one-arg form targets the runtime's singleton module registry
const preloadEntries: PreloadEntry[] = [
  // example shape — actual entries import the modules you want preloaded
  // { id: 'npm://react@18', exports: React, aliases: ['react'] },
];
registerPreloadEntries(preloadEntries);

// 2. configure runtime budgets (optional — defaults are sensible)
configureRuntime({
  maxModuleLoadDepth: 32,
  maxConcurrentFetches: 8,
});

// 3. supply a fetcher the runtime calls for each listed dependency
//    `request` is the module specifier (e.g., './sibling.tsx', 'lodash')
//    `isBare` distinguishes bare specifiers from relative paths
//    `parentId` is the resolved id of the importer (for relative resolution)
setModuleFetcher(
  async (
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined> => {
    // typically: RPC back to the host that ran compileTrusted
    // the host resolves the module on disk, transpiles if needed, returns:
    //
    // return {
    //   fsPath: '/abs/path/to/module.tsx',
    //   code: '/* transpiled JS */',
    //   dependencies: [/* further dependencies of this module */],
    //   css: '/* optional inline CSS to inject */',
    // };

    return undefined;
  }
);

// 4. evaluate a Trusted Mode entry into a React component
//    `code` is the output of compileTrusted on the Node side
//    `entryFilePath` is the canonical path used for relative resolution
//    `dependencies` must list the entry's direct import specifiers — the
//    runtime fetches exactly this list (recursively via each returned
//    FetchResult.dependencies); unlisted non-preloaded imports fail
async function renderEntry(
  code: string,
  entryFilePath: string,
  dependencies: string[]
) {
  const Component = await evaluateModuleToComponent(
    code,
    entryFilePath,
    dependencies
  );
  return Component;
}

// 5. reset between full re-renders (different entry files)
//    use invalidateModule for HMR-style partial updates instead
function reset() {
  resetModules();
}

export { renderEntry, reset };
