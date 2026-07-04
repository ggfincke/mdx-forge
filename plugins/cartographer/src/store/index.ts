// plugins/cartographer/src/store/index.ts
// graph JSON load/save + path helpers + snapshot history

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CartographerGraph } from '../types.js';
import { graphJsonPath, outDirPath } from './paths.js';

export {
  architectureHtmlPath,
  architectureMdxPath,
  DEFAULT_OUT_DIR,
  graphJsonPath,
  outDirPath,
} from './paths.js';
export {
  dbPath,
  listSnapshots,
  loadSnapshot,
  recordSnapshot,
  suppressSqliteWarning,
  type SnapshotMeta,
} from './snapshots.js';

export function saveGraph(
  graph: CartographerGraph,
  root: string,
  outDir?: string
): string {
  const path = graphJsonPath(root, outDir);
  mkdirSync(outDirPath(root, outDir), { recursive: true });
  writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`);
  return path;
}

export function loadGraph(root: string, outDir?: string): CartographerGraph {
  const path = graphJsonPath(root, outDir);
  if (!existsSync(path)) {
    throw new Error(`no graph at ${path} -> run \`cartographer build\` first`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as CartographerGraph;
}

export function hasGraph(root: string, outDir?: string): boolean {
  return existsSync(graphJsonPath(root, outDir));
}
