// plugins/cartographer/src/store/paths.ts
// artifact path helpers under <root>/.cartographer/

import { join, resolve } from 'node:path';

export const DEFAULT_OUT_DIR = '.cartographer';

export function outDirPath(root: string, outDir?: string): string {
  return resolve(root, outDir ?? DEFAULT_OUT_DIR);
}

export function graphJsonPath(root: string, outDir?: string): string {
  return join(outDirPath(root, outDir), 'graph.json');
}

export function architectureMdxPath(root: string, outDir?: string): string {
  return join(outDirPath(root, outDir), 'architecture.mdx');
}

export function architectureHtmlPath(root: string, outDir?: string): string {
  return join(outDirPath(root, outDir), 'architecture.html');
}
