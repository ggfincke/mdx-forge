// plugins/cartographer/src/analyze/blast-radius.ts
// BFS traversal of impacted files from a target node

import type { CartographerGraph } from '../types.js';

export type BlastDirection = 'upstream' | 'downstream' | 'both';

export interface BlastRadiusResult {
  target: string;
  direction: BlastDirection;
  maxDepth: number;
  // files that import the target (directly or transitively)
  upstream: string[];
  // files the target imports (directly or transitively)
  downstream: string[];
}

export const DEFAULT_MAX_DEPTH = 4;

export function computeBlastRadius(
  graph: CartographerGraph,
  target: string,
  direction: BlastDirection = 'both',
  maxDepth: number = DEFAULT_MAX_DEPTH
): BlastRadiusResult {
  let foundTarget = false;
  const hint: string[] = [];
  for (const node of graph.nodes) {
    if (node.id === target) {
      foundTarget = true;
    }
    if (
      hint.length < 5 &&
      (node.id.endsWith(target) || node.id.includes(target))
    ) {
      hint.push(node.id);
    }
  }
  if (!foundTarget) {
    throw new Error(
      `target "${target}" not in graph${hint.length > 0 ? ` -> did you mean: ${hint.join(', ')}` : ''}`
    );
  }

  const importsOf =
    direction === 'upstream' ? undefined : new Map<string, string[]>();
  const importedBy =
    direction === 'downstream' ? undefined : new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (importsOf) {
      push(importsOf, edge.from, edge.to);
    }
    if (importedBy) {
      push(importedBy, edge.to, edge.from);
    }
  }

  return {
    target,
    direction,
    maxDepth,
    upstream: importedBy ? bfs(importedBy, target, maxDepth) : [],
    downstream: importsOf ? bfs(importsOf, target, maxDepth) : [],
  };
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

function bfs(
  adjacency: Map<string, string[]>,
  start: string,
  maxDepth: number
): string[] {
  const seen = new Set<string>([start]);
  const result: string[] = [];
  let frontier = [start];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          result.push(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return result.sort();
}
