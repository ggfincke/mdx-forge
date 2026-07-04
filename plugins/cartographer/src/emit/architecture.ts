// plugins/cartographer/src/emit/architecture.ts
// render a CartographerGraph as an architecture.mdx artifact

import type { CartographerGraph } from '../types.js';

// keep Mermaid readable -> truncate past this many edges
const MERMAID_EDGE_CAP = 150;
const HOTSPOT_COUNT = 5;

export function emitArchitectureMdx(graph: CartographerGraph): string {
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
    '## Hotspots',
    '',
    hotspotTables(graph),
    '## Import graph',
    '',
    mermaidBlock(graph),
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

function mermaidBlock(graph: CartographerGraph): string {
  if (graph.edges.length === 0) {
    return '_No internal imports found._';
  }

  const shown = graph.edges.slice(0, MERMAID_EDGE_CAP);
  const ids = new Map<string, string>();
  const nodeLine = (id: string): string => {
    let short = ids.get(id);
    if (!short) {
      short = `n${ids.size}`;
      ids.set(id, short);
    }
    return short;
  };

  const lines = ['```mermaid', 'flowchart TD'];
  const declared = new Set<string>();
  for (const edge of shown) {
    for (const id of [edge.from, edge.to]) {
      const short = nodeLine(id);
      if (!declared.has(short)) {
        declared.add(short);
        lines.push(`  ${short}["${id}"]`);
      }
    }
    lines.push(`  ${nodeLine(edge.from)} --> ${nodeLine(edge.to)}`);
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
