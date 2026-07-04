#!/usr/bin/env node
// plugins/cartographer/src/mcp/server.ts
// cartographer MCP tools -> graph_repo, blast_radius

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import {
  buildGraph,
  computeBlastRadius,
  DEFAULT_MAX_DEPTH,
  diffGraphs,
  formatDiffSummary,
} from '../analyze/index.js';
import { emitArchitectureMdx } from '../emit/index.js';
import {
  architectureMdxPath,
  hasGraph,
  listSnapshots,
  loadGraph,
  loadSnapshot,
  recordSnapshot,
  saveGraph,
  suppressSqliteWarning,
} from '../store/index.js';
import type { CartographerGraph } from '../types.js';

suppressSqliteWarning();

const server = new McpServer({
  name: 'cartographer',
  version: '0.1.0',
});

// --- graph_repo ---------------------------------------------------------------

server.tool(
  'graph_repo',
  'Build the TS/JS imports graph for a repository via dependency-cruiser. Writes graph.json (nodes, edges, metrics) to <root>/.cartographer/ & returns a structured summary: file/import counts, cycles, orphans, fan-in/fan-out hotspots. Optionally also emits architecture.mdx (frontmatter, metrics tables, Mermaid diagram) renderable through mdx-forge. Call this first — blast_radius reuses the saved graph.',
  {
    root: z
      .string()
      .describe('Absolute path to the repository root to analyze.'),
    scope: z
      .string()
      .optional()
      .describe(
        "Directory under root to graph, relative to root. Default: 'src'."
      ),
    emitMdx: z
      .boolean()
      .optional()
      .describe(
        'Also write architecture.mdx next to graph.json. Default: false.'
      ),
  },
  async (args) => {
    try {
      const graph = await buildGraph({ root: args.root, scope: args.scope });
      const graphJsonPath = saveGraph(graph, args.root);
      const snapshotId = recordSnapshot(graph, args.root);
      let mdxPath: string | undefined;
      if (args.emitMdx) {
        mdxPath = architectureMdxPath(args.root);
        writeFileSync(mdxPath, emitArchitectureMdx(graph));
      }
      return jsonResult({
        graphJsonPath,
        snapshotId,
        ...(mdxPath ? { mdxPath } : {}),
        ...summarize(graph),
      });
    } catch (err) {
      return errorResult('graph_repo', err);
    }
  }
);

// --- graph_diff -----------------------------------------------------------------

server.tool(
  'graph_diff',
  'Compare a baseline graph against a fresh build of the current working tree. Baseline is the saved graph.json by default, or a historical snapshot when baseSnapshotId is set. Returns added/removed files & imports plus a one-line drift summary. Requires a prior graph_repo call (or CLI build) to establish the baseline. Pass save: true to promote the fresh build to the new baseline after diffing.',
  {
    root: z
      .string()
      .describe('Absolute path to the repository root to analyze.'),
    scope: z
      .string()
      .optional()
      .describe('Directory under root to graph. Default: the baseline scope.'),
    baseSnapshotId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Diff against this snapshot from graph.db instead of the saved graph.json. Get ids from list_snapshots.'
      ),
    save: z
      .boolean()
      .optional()
      .describe(
        'Overwrite the saved baseline w/ the fresh build. Default: false.'
      ),
  },
  async (args) => {
    try {
      if (!args.baseSnapshotId && !hasGraph(args.root)) {
        return errorResult(
          'graph_diff',
          new Error('no baseline graph -> call graph_repo first')
        );
      }
      const base = args.baseSnapshotId
        ? loadSnapshot(args.root, args.baseSnapshotId)
        : loadGraph(args.root);
      const head = await buildGraph({
        root: args.root,
        scope: args.scope ?? base.scope,
      });
      const diff = diffGraphs(base, head);
      let snapshotId: number | undefined;
      if (args.save) {
        saveGraph(head, args.root);
        snapshotId = recordSnapshot(head, args.root);
      }
      return jsonResult({
        summary: formatDiffSummary(diff),
        ...(snapshotId ? { snapshotId } : {}),
        ...diff,
      });
    } catch (err) {
      return errorResult('graph_diff', err);
    }
  }
);

// --- list_snapshots -------------------------------------------------------------

server.tool(
  'list_snapshots',
  'List the snapshot history recorded in <root>/.cartographer/graph.db — id, timestamp, git ref, file/import/cycle counts per snapshot. Use ids w/ graph_diff baseSnapshotId to measure drift over time.',
  {
    root: z
      .string()
      .describe('Absolute path to the repository root to analyze.'),
  },
  async (args) => {
    try {
      return jsonResult({ snapshots: listSnapshots(args.root) });
    } catch (err) {
      return errorResult('list_snapshots', err);
    }
  }
);

// --- blast_radius ---------------------------------------------------------------

server.tool(
  'blast_radius',
  'List the files impacted by a change to one file, from the saved imports graph (builds it on demand when missing). Returns upstream (files that import the target, directly or transitively — the change ripple) & downstream (files the target imports). Target is a path relative to the repo root, as it appears in graph.json.',
  {
    root: z
      .string()
      .describe('Absolute path to the repository root to analyze.'),
    target: z
      .string()
      .describe(
        "File to analyze, relative to root (e.g. 'src/auth/session.ts')."
      ),
    direction: z
      .enum(['both', 'upstream', 'downstream'])
      .optional()
      .describe("Traversal direction. Default: 'both'."),
    maxDepth: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(`Max traversal depth. Default: ${DEFAULT_MAX_DEPTH}.`),
    scope: z
      .string()
      .optional()
      .describe(
        "Directory to graph when no saved graph exists. Default: 'src'."
      ),
  },
  async (args) => {
    try {
      const graph = hasGraph(args.root)
        ? loadGraph(args.root)
        : await buildGraph({ root: args.root, scope: args.scope });
      const result = computeBlastRadius(
        graph,
        args.target,
        args.direction,
        args.maxDepth
      );
      return jsonResult({
        ...result,
        impactedCount: result.upstream.length + result.downstream.length,
        graphGeneratedAt: graph.generatedAt,
      });
    } catch (err) {
      return errorResult('blast_radius', err);
    }
  }
);

// --- helpers ----------------------------------------------------------------

function summarize(graph: CartographerGraph): Record<string, unknown> {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const edge of graph.edges) {
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
  }
  const top = (map: Map<string, number>): Array<Record<string, unknown>> =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([file, count]) => ({ file, count }));

  return {
    repoRoot: graph.repoRoot,
    scope: graph.scope,
    gitRef: graph.gitRef,
    files: graph.nodes.length,
    imports: graph.edges.length,
    metrics: graph.metrics,
    topFanIn: top(fanIn),
    topFanOut: top(fanOut),
  };
}

function jsonResult(payload: Record<string, unknown>): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(
  tool: string,
  err: unknown
): {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
} {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: 'text', text: `${tool} failed: ${message}` }],
  };
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('cartographer failed to start:', err);
  process.exit(1);
});
