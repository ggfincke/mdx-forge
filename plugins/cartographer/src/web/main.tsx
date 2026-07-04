// plugins/cartographer/src/web/main.tsx
// React Flow preview -> blocks & files views over graph.json, polls for changes

import dagre from '@dagrejs/dagre';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { aggregateGroupEdges, graphGroups } from '../analyze/aggregate.js';
import type { CartographerGraph, GraphGroup } from '../types.js';

type GraphJson = Pick<
  CartographerGraph,
  'generatedAt' | 'gitRef' | 'scope' | 'nodes' | 'edges' | 'groups' | 'metrics'
>;
type ViewMode = 'blocks' | 'files';
type Flow = { nodes: Node[]; edges: Edge[] };

const NODE_WIDTH = 220;
const NODE_HEIGHT = 34;
const BLOCK_WIDTH = 240;
const BLOCK_HEIGHT = 56;
const POLL_MS = 2000;

// dim non-matching nodes instead of hiding -> layout stays stable
const DIM_NODE_OPACITY = 0.15;
const DIM_EDGE_OPACITY = 0.08;
const FILE_EDGE_COLOR = '#8b95a1';
const BLOCK_EDGE_COLOR = '#6e7781';

function groupColor(group: string): string {
  let hash = 0;
  for (const char of group) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 55% 88%)`;
}

function toFilesFlow(graph: GraphJson, focusGroup: string | null): Flow {
  const graphNodes = focusGroup
    ? graph.nodes.filter((node) => node.group === focusGroup)
    : graph.nodes;
  const shownIds = new Set(graphNodes.map((node) => node.id));
  const graphEdges = graph.edges.filter(
    (edge) => shownIds.has(edge.from) && shownIds.has(edge.to)
  );

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 70, nodesep: 14 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of graphNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of graphEdges) {
    g.setEdge(edge.from, edge.to);
  }
  dagre.layout(g);

  const nodes: Node[] = graphNodes.map((node) => {
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
        background: groupColor(node.group),
        border: '1px solid #9aa4af',
        borderRadius: 6,
        padding: '4px 8px',
      },
    };
  });

  const edges: Edge[] = graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    style: { stroke: FILE_EDGE_COLOR },
    markerEnd: { type: MarkerType.ArrowClosed, color: FILE_EDGE_COLOR },
  }));

  return { nodes, edges };
}

function toBlocksFlow(graph: GraphJson, groups: GraphGroup[]): Flow {
  const groupEdges = aggregateGroupEdges(graph);
  const maxCount = groupEdges[0]?.count ?? 1;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', ranksep: 130, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const group of groups) {
    g.setNode(group.id, { width: BLOCK_WIDTH, height: BLOCK_HEIGHT });
  }
  for (const edge of groupEdges) {
    g.setEdge(edge.from, edge.to);
  }
  dagre.layout(g);

  const nodes: Node[] = groups.map((group) => {
    const pos = g.node(group.id);
    return {
      id: group.id,
      position: {
        x: pos.x - BLOCK_WIDTH / 2,
        y: pos.y - BLOCK_HEIGHT / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div title={group.description ?? group.id}>
            <strong>{group.label}</strong>
            <div className="cartographer-block-meta">
              {group.fileCount} file{group.fileCount === 1 ? '' : 's'}
            </div>
          </div>
        ),
      },
      style: {
        width: BLOCK_WIDTH,
        fontSize: 12,
        background: groupColor(group.id),
        border: '2px solid #6e7781',
        borderRadius: 10,
        padding: '6px 10px',
        cursor: 'pointer',
      },
    };
  });

  const edges: Edge[] = groupEdges.map((edge) => ({
    id: `${edge.from}=>${edge.to}`,
    source: edge.from,
    target: edge.to,
    label: String(edge.count),
    labelStyle: { fontSize: 11, fill: '#57606a' },
    style: {
      stroke: BLOCK_EDGE_COLOR,
      strokeWidth: 1 + 2.5 * (edge.count / maxCount),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: BLOCK_EDGE_COLOR },
  }));

  return { nodes, edges };
}

function applyFilter(
  flow: Flow,
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
  const [mode, setMode] = useState<ViewMode | null>(null);
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => (graph ? graphGroups(graph) : []), [graph]);
  const focusMeta = focusGroup
    ? groups.find((group) => group.id === focusGroup)
    : undefined;
  // focused group may vanish on rebuild -> fall back to blocks view
  const activeFocus = focusMeta?.id ?? null;
  const effectiveMode: ViewMode = activeFocus
    ? 'files'
    : (mode ?? (groups.length >= 2 ? 'blocks' : 'files'));

  const blocksFlow = useMemo(
    () => (graph ? toBlocksFlow(graph, groups) : null),
    [graph, groups]
  );
  const filesFlow = useMemo(
    () => (graph ? toFilesFlow(graph, activeFocus) : null),
    [graph, activeFocus]
  );

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
  if (!graph || !blocksFlow || !filesFlow) {
    return <div className="cartographer-status">loading graph.json ...</div>;
  }

  const baseFlow = effectiveMode === 'blocks' ? blocksFlow : filesFlow;
  const { nodes, edges, matchCount } = applyFilter(baseFlow, filter);

  const pickMode = (next: ViewMode): void => {
    setFocusGroup(null);
    setMode(next);
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <header className="cartographer-header">
        <strong>cartographer</strong>
        <span>
          {graph.scope}
          {graph.gitRef ? ` @ ${graph.gitRef}` : ''} — {graph.nodes.length}{' '}
          files, {graph.edges.length} imports, {groups.length} blocks,{' '}
          {graph.metrics.cycles} cycles
        </span>
        <span className="cartographer-modes">
          <button
            className={effectiveMode === 'blocks' ? 'active' : ''}
            onClick={() => pickMode('blocks')}
          >
            blocks
          </button>
          <button
            className={effectiveMode === 'files' ? 'active' : ''}
            onClick={() => pickMode('files')}
          >
            files
          </button>
        </span>
        {focusMeta && (
          <span className="cartographer-chip">
            {focusMeta.label} ({focusMeta.fileCount} files)
            <button onClick={() => setFocusGroup(null)}>✕</button>
          </span>
        )}
        <input
          className="cartographer-filter"
          type="search"
          placeholder={
            effectiveMode === 'blocks' ? 'filter blocks...' : 'filter files...'
          }
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        {filter.trim() !== '' && (
          <span className="cartographer-match-count">
            {matchCount}/{baseFlow.nodes.length}
          </span>
        )}
      </header>
      <ReactFlow
        key={`${effectiveMode}:${activeFocus ?? ''}`}
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.05}
        onNodeClick={
          effectiveMode === 'blocks'
            ? (_event, node): void => setFocusGroup(node.id)
            : undefined
        }
      >
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
