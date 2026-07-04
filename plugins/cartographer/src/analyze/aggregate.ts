// plugins/cartographer/src/analyze/aggregate.ts
// fold file-level graph into group-level nodes & edges

import type { CartographerGraph, GraphGroup } from '../types.js';

// structural subset -> callers w/ partial graph payloads (web app) qualify
export type GraphSlice = Pick<CartographerGraph, 'nodes' | 'edges' | 'groups'>;

export interface GroupEdge {
  from: string;
  to: string;
  count: number;
}

// groups list w/ fallback derivation for graph.json predating groups[]
export function graphGroups(graph: GraphSlice): GraphGroup[] {
  if (graph.groups && graph.groups.length > 0) {
    return graph.groups;
  }
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    counts.set(node.group, (counts.get(node.group) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, fileCount]) => ({ id, label: id, fileCount }));
}

// cross-group import counts, heaviest first; intra-group edges dropped
export function aggregateGroupEdges(graph: GraphSlice): GroupEdge[] {
  const groupOf = new Map(graph.nodes.map((n) => [n.id, n.group]));
  const counts = new Map<string, Map<string, number>>();
  for (const edge of graph.edges) {
    const from = groupOf.get(edge.from);
    const to = groupOf.get(edge.to);
    if (!from || !to || from === to) {
      continue;
    }
    let row = counts.get(from);
    if (!row) {
      row = new Map<string, number>();
      counts.set(from, row);
    }
    row.set(to, (row.get(to) ?? 0) + 1);
  }
  const edges: GroupEdge[] = [];
  for (const [from, row] of counts) {
    for (const [to, count] of row) {
      edges.push({ from, to, count });
    }
  }
  return edges.sort(
    (a, b) =>
      b.count - a.count ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to)
  );
}
