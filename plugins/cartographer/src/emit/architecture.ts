// plugins/cartographer/src/emit/architecture.ts
// render a CartographerGraph as an architecture.mdx artifact

import { aggregateGroupEdges, graphGroups } from '../analyze/index.js';
import type { CartographerGraph, GraphGroup } from '../types.js';

// keep Mermaid readable -> truncate past this many edges
const MERMAID_EDGE_CAP = 150;
const HOTSPOT_COUNT = 5;

export function emitArchitectureMdx(graph: CartographerGraph): string {
  const groups = graphGroups(graph);
  return [
    frontmatter(graph),
    '',
    '# Architecture',
    '',
    summaryLine(graph),
    '',
    '## Metrics',
    '',
    metricsTable(graph),
    '',
    ...blocksSection(graph, groups),
    '## Hotspots',
    '',
    hotspotTables(graph),
    '## Import graph',
    '',
    mermaidBlock(graph, groups),
    '',
  ].join('\n');
}

function frontmatter(graph: CartographerGraph): string {
  const lines = [
    '---',
    'title: Architecture',
    'generatedBy: cartographer',
    `generatedAt: ${graph.generatedAt}`,
    `repoRoot: ${graph.repoRoot}`,
    ...(graph.gitRef ? [`gitRef: ${graph.gitRef}`] : []),
    `mode: ${graph.mode}`,
    `scope: ${graph.scope}`,
    `nodes: ${graph.nodes.length}`,
    `edges: ${graph.edges.length}`,
    `cycles: ${graph.metrics.cycles}`,
    'artifacts:',
    '  graphJson: ./graph.json',
    '---',
  ];
  return lines.join('\n');
}

function summaryLine(graph: CartographerGraph): string {
  const ref = graph.gitRef ? ` at \`${graph.gitRef}\`` : '';
  return (
    `Imports graph of \`${graph.scope}\`${ref} — ` +
    `${graph.nodes.length} files, ${graph.edges.length} imports, ` +
    `${graph.metrics.cycles} cycle${graph.metrics.cycles === 1 ? '' : 's'}.`
  );
}

function metricsTable(graph: CartographerGraph): string {
  const m = graph.metrics;
  return [
    '| Metric | Value |',
    '| --- | ---: |',
    `| Files | ${graph.nodes.length} |`,
    `| Imports | ${graph.edges.length} |`,
    `| Cycles | ${m.cycles} |`,
    `| Orphans | ${m.orphans} |`,
    `| Max fan-in | ${m.maxFanIn} |`,
    `| Max fan-out | ${m.maxFanOut} |`,
  ].join('\n');
}

// block-level rollup -> table + aggregated mermaid, skipped for single-group graphs
function blocksSection(
  graph: CartographerGraph,
  groups: GraphGroup[]
): string[] {
  if (groups.length < 2) {
    return [];
  }
  const groupEdges = aggregateGroupEdges(graph);
  const shortId = new Map(groups.map((g, index) => [g.id, `g${index}`]));

  const table = [
    '| Block | Files | Description |',
    '| --- | ---: | --- |',
    ...groups.map(
      (g) =>
        `| ${mermaidLabel(g.label)} | ${g.fileCount} | ${g.description ?? ''} |`
    ),
  ];

  const diagram = ['```mermaid', 'flowchart LR'];
  for (const group of groups) {
    diagram.push(
      `  ${shortId.get(group.id)}["${mermaidLabel(group.label)} (${group.fileCount})"]`
    );
  }
  for (const edge of groupEdges) {
    diagram.push(
      `  ${shortId.get(edge.from)} -->|${edge.count}| ${shortId.get(edge.to)}`
    );
  }
  diagram.push('```');

  return ['## Blocks', '', ...table, '', ...diagram, '', ''];
}

function mermaidLabel(text: string): string {
  return text.replaceAll('"', "'");
}

function hotspotTables(graph: CartographerGraph): string {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const edge of graph.edges) {
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
  }

  const top = (map: Map<string, number>): Array<[string, number]> =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, HOTSPOT_COUNT);

  const table = (
    title: string,
    header: string,
    rows: Array<[string, number]>
  ): string[] =>
    rows.length === 0
      ? []
      : [
          `### ${title}`,
          '',
          `| File | ${header} |`,
          '| --- | ---: |',
          ...rows.map(([id, count]) => `| \`${id}\` | ${count} |`),
          '',
        ];

  return [
    ...table('Most imported (fan-in)', 'Dependents', top(fanIn)),
    ...table('Most imports (fan-out)', 'Dependencies', top(fanOut)),
  ].join('\n');
}

function mermaidBlock(graph: CartographerGraph, groups: GraphGroup[]): string {
  if (graph.edges.length === 0) {
    return '_No internal imports found._';
  }

  const shown = graph.edges.slice(0, MERMAID_EDGE_CAP);
  const shownIds = new Set(shown.flatMap((edge) => [edge.from, edge.to]));
  const ids = new Map<string, string>();
  const shortId = (id: string): string => {
    let short = ids.get(id);
    if (!short) {
      short = `n${ids.size}`;
      ids.set(id, short);
    }
    return short;
  };

  const groupOf = new Map(graph.nodes.map((n) => [n.id, n.group]));
  const lines = ['```mermaid', 'flowchart TD'];

  // declare shown nodes inside a subgraph per block
  for (const [index, group] of groups.entries()) {
    const members = [...shownIds].filter((id) => groupOf.get(id) === group.id);
    if (members.length === 0) {
      continue;
    }
    lines.push(`  subgraph sg${index}["${mermaidLabel(group.label)}"]`);
    for (const id of members) {
      lines.push(`    ${shortId(id)}["${id}"]`);
    }
    lines.push('  end');
  }
  // nodes outside any known group (stale graph.json) -> declare flat
  for (const id of shownIds) {
    if (!ids.has(id)) {
      lines.push(`  ${shortId(id)}["${id}"]`);
    }
  }

  for (const edge of shown) {
    lines.push(`  ${shortId(edge.from)} --> ${shortId(edge.to)}`);
  }
  lines.push('```');

  if (graph.edges.length > MERMAID_EDGE_CAP) {
    lines.push(
      '',
      `_Showing ${MERMAID_EDGE_CAP} of ${graph.edges.length} imports — see \`graph.json\` for the full graph._`
    );
  }
  return lines.join('\n');
}
