// skills/mdx-forge/examples/browser-setup.ts
// minimal browser runtime setup for Trusted Mode rendering

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

// 1. register preloaded modules — React, MDX runtime, framework shims, etc
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

// 3. supply a fetcher for each listed dependency
// `request` = './sibling.tsx' or 'lodash'; `isBare` distinguishes bare
// from relative; `parentId` = resolved importer id for relative resolution
setModuleFetcher(
  async (
    request: string,
    isBare: boolean,
    parentId: string
  ): Promise<FetchResult | undefined> => {
    // typical flow: RPC to compileTrusted host -> resolve disk module -> transpile
    // return fsPath, code, dependencies & optional CSS in this shape

    // return { fsPath: '/abs/path/to/module.tsx',
    //   code: '/* transpiled JS */', dependencies: [/* further dependencies */],
    //   css: '/* optional inline CSS to inject */' }

    return undefined;
  }
);

// 4. evaluate Trusted Mode `code` from compileTrusted as a React component
// `entryFilePath` is canonical for relatives; `dependencies` lists direct imports
// runtime fetches recursively; unlisted non-preloaded imports fail
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
