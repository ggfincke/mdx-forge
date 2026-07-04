// plugins/cartographer/src/emit/pr-summary.ts
// render a GraphDiff as a markdown PR comment body

import type { GraphDiff } from '../analyze/index.js';
import type { CartographerGraph } from '../types.js';

// keep PR comments scannable -> cap each change list
const LIST_CAP = 20;

export function formatPrSummary(
  diff: GraphDiff,
  base: CartographerGraph,
  head: CartographerGraph
): string {
  const sections = [
    '### Architecture check',
    '',
    driftLine(diff),
    '',
    metricsDeltaTable(base, head),
    '',
    ...changeList('Added files', diff.addedNodes),
    ...changeList('Removed files', diff.removedNodes),
    ...changeList('Added imports', diff.addedEdges),
    ...changeList('Removed imports', diff.removedEdges),
  ];
  return `${sections.join('\n').trimEnd()}\n`;
}

function driftLine(diff: GraphDiff): string {
  const refs =
    diff.baseGitRef || diff.headGitRef
      ? ` (\`${diff.baseGitRef ?? '?'}\` -> \`${diff.headGitRef ?? '?'}\`)`
      : '';
  if (!diff.changed) {
    return `**No architectural drift.**${refs}`;
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
  return `**Drift:** ${parts.join(', ')}${refs}`;
}

function metricsDeltaTable(
  base: CartographerGraph,
  head: CartographerGraph
): string {
  const rows: Array<[string, number, number]> = [
    ['Files', base.nodes.length, head.nodes.length],
    ['Imports', base.edges.length, head.edges.length],
    ['Cycles', base.metrics.cycles, head.metrics.cycles],
    ['Orphans', base.metrics.orphans, head.metrics.orphans],
    ['Max fan-in', base.metrics.maxFanIn, head.metrics.maxFanIn],
    ['Max fan-out', base.metrics.maxFanOut, head.metrics.maxFanOut],
  ];
  const delta = (from: number, to: number): string =>
    to === from ? '—' : to > from ? `+${to - from}` : `${to - from}`;
  return [
    '| Metric | Base | Head | Δ |',
    '| --- | ---: | ---: | ---: |',
    ...rows.map(
      ([label, from, to]) =>
        `| ${label} | ${from} | ${to} | ${delta(from, to)} |`
    ),
  ].join('\n');
}

function changeList(title: string, items: string[]): string[] {
  if (items.length === 0) {
    return [];
  }
  const shown = items.slice(0, LIST_CAP);
  const lines = [
    `<details><summary>${title} (${items.length})</summary>`,
    '',
    ...shown.map((item) => `- \`${item}\``),
  ];
  if (items.length > LIST_CAP) {
    lines.push(`- …plus ${items.length - LIST_CAP} more`);
  }
  lines.push('', '</details>', '');
  return lines;
}
