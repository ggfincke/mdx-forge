// plugins/cartographer/src/types.ts
// shared graph JSON types (report schema, version 1)

export interface GraphNode {
  id: string;
  kind: 'file';
  label: string;
  group: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: 'imports';
  dynamic?: boolean;
}

export interface GraphGroup {
  id: string;
  label: string;
  description?: string;
  fileCount: number;
}

export interface GraphMetrics {
  cycles: number;
  orphans: number;
  maxFanIn: number;
  maxFanOut: number;
}

export interface CartographerGraph {
  version: 1;
  repoRoot: string;
  mode: 'imports';
  generatedAt: string;
  gitRef?: string;
  scope: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  // optional -> graph.json written before grouping landed lacks it
  groups?: GraphGroup[];
  metrics: GraphMetrics;
}
