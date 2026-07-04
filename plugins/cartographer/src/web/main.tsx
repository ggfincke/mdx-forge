// plugins/cartographer/src/web/main.tsx
// React Flow preview app -> renders graph.json w/ dagre layout, polls for changes

import dagre from '@dagrejs/dagre';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CartographerGraph } from '../types.js';

type GraphJson = Pick<
  CartographerGraph,
  'generatedAt' | 'gitRef' | 'scope' | 'nodes' | 'edges' | 'metrics'
>;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 34;
const POLL_MS = 2000;

function groupColor(group: string): string {
  let hash = 0;
  for (const char of group) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 55% 88%)`;
}

function toFlow(graph: GraphJson): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 70, nodesep: 14 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to);
  }
  dagre.layout(g);

  const groupColors = new Map<string, string>();
  const getGroupColor = (group: string): string => {
    const cached = groupColors.get(group);
    if (cached) {
      return cached;
    }
    const color = groupColor(group);
    groupColors.set(group, color);
    return color;
  };

  const nodes: Node[] = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: { label: node.id },
      style: {
        width: NODE_WIDTH,
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        background: getGroupColor(node.group),
        border: '1px solid #9aa4af',
        borderRadius: 6,
        padding: '4px 8px',
      },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    style: { stroke: '#8b95a1' },
  }));

  return { nodes, edges };
}

// dim non-matching nodes instead of hiding -> layout stays stable
const DIM_NODE_OPACITY = 0.15;
const DIM_EDGE_OPACITY = 0.08;

function applyFilter(
  flow: { nodes: Node[]; edges: Edge[] },
  query: string
): { nodes: Node[]; edges: Edge[]; matchCount: number } {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { ...flow, matchCount: flow.nodes.length };
  }
  const matched = new Set(
    flow.nodes
      .filter((node) => node.id.toLowerCase().includes(needle))
      .map((node) => node.id)
  );
  return {
    nodes: flow.nodes.map((node) =>
      matched.has(node.id)
        ? node
        : { ...node, style: { ...node.style, opacity: DIM_NODE_OPACITY } }
    ),
    edges: flow.edges.map((edge) =>
      matched.has(edge.source) || matched.has(edge.target)
        ? edge
        : { ...edge, style: { ...edge.style, opacity: DIM_EDGE_OPACITY } }
    ),
    matchCount: matched.size,
  };
}

function App(): React.JSX.Element {
  const [graph, setGraph] = useState<GraphJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const flow = useMemo(() => (graph ? toFlow(graph) : null), [graph]);

  useEffect(() => {
    let generatedAt = '';
    let cancelled = false;
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch('/graph.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`graph.json -> HTTP ${response.status}`);
        }
        const next = (await response.json()) as GraphJson;
        if (!cancelled && next.generatedAt !== generatedAt) {
          generatedAt = next.generatedAt;
          setGraph(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return (): void => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <div className="cartographer-status">error: {error}</div>;
  }
  if (!graph || !flow) {
    return <div className="cartographer-status">loading graph.json ...</div>;
  }

  const { nodes, edges, matchCount } = applyFilter(flow, filter);
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <header className="cartographer-header">
        <strong>cartographer</strong>
        <span>
          {graph.scope}
          {graph.gitRef ? ` @ ${graph.gitRef}` : ''} — {graph.nodes.length}{' '}
          files, {graph.edges.length} imports, {graph.metrics.cycles} cycles
        </span>
        <input
          className="cartographer-filter"
          type="search"
          placeholder="filter files..."
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        {filter.trim() !== '' && (
          <span className="cartographer-match-count">
            {matchCount}/{graph.nodes.length}
          </span>
        )}
      </header>
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.05}>
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
