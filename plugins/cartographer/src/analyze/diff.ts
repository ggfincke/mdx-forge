// plugins/cartographer/src/analyze/diff.ts
// structural diff between two graph snapshots

import type { CartographerGraph } from '../types.js';

export interface GraphDiff {
  baseGeneratedAt: string;
  headGeneratedAt: string;
  baseGitRef?: string;
  headGitRef?: string;
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  changed: boolean;
}

export function diffGraphs(
  base: CartographerGraph,
  head: CartographerGraph
): GraphDiff {
  const baseNodes = new Set(base.nodes.map((n) => n.id));
  const headNodes = new Set(head.nodes.map((n) => n.id));
  const edgeKey = (e: { from: string; to: string }): string =>
    `${e.from} -> ${e.to}`;
  const baseEdges = new Set(base.edges.map(edgeKey));
  const headEdges = new Set(head.edges.map(edgeKey));

  const addedNodes = [...headNodes].filter((id) => !baseNodes.has(id)).sort();
  const removedNodes = [...baseNodes].filter((id) => !headNodes.has(id)).sort();
  const addedEdges = [...headEdges].filter((k) => !baseEdges.has(k)).sort();
  const removedEdges = [...baseEdges].filter((k) => !headEdges.has(k)).sort();

  return {
    baseGeneratedAt: base.generatedAt,
    headGeneratedAt: head.generatedAt,
    ...(base.gitRef ? { baseGitRef: base.gitRef } : {}),
    ...(head.gitRef ? { headGitRef: head.gitRef } : {}),
    addedNodes,
    removedNodes,
    addedEdges,
    removedEdges,
    changed:
      addedNodes.length > 0 ||
      removedNodes.length > 0 ||
      addedEdges.length > 0 ||
      removedEdges.length > 0,
  };
}

export function formatDiffSummary(diff: GraphDiff): string {
  if (!diff.changed) {
    return 'no architectural drift';
  }
  const parts: string[] = [];
  if (diff.addedNodes.length > 0) {
    parts.push(`+${diff.addedNodes.length} file(s)`);
  }
  if (diff.removedNodes.length > 0) {
    parts.push(`-${diff.removedNodes.length} file(s)`);
  }
  if (diff.addedEdges.length > 0) {
    parts.push(`+${diff.addedEdges.length} import(s)`);
  }
  if (diff.removedEdges.length > 0) {
    parts.push(`-${diff.removedEdges.length} import(s)`);
  }
  return parts.join(', ');
}
