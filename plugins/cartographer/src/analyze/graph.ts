// plugins/cartographer/src/analyze/graph.ts
// build the imports graph for a repo via dependency-cruiser

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cruise } from 'dependency-cruiser';
import type {
  CartographerGraph,
  GraphEdge,
  GraphGroup,
  GraphMetrics,
  GraphNode,
} from '../types.js';
import { loadConfig, resolveGroup, type CartographerConfig } from './config.js';

interface CruisedDependency {
  resolved: string;
  coreModule: boolean;
  couldNotResolve: boolean;
  dynamic: boolean;
}

interface CruisedModule {
  source: string;
  dependencies: CruisedDependency[];
}

export interface BuildGraphOptions {
  root: string;
  scope?: string;
}

export const DEFAULT_SCOPE = 'src';

export async function buildGraph(
  opts: BuildGraphOptions
): Promise<CartographerGraph> {
  const root = resolve(opts.root);
  const scope = opts.scope ?? DEFAULT_SCOPE;
  if (!existsSync(resolve(root, scope))) {
    throw new Error(
      `scope "${scope}" not found under ${root} -> pass a different --scope`
    );
  }

  // dependency-cruiser resolves relative to cwd, so pin it to the repo root
  const previousCwd = process.cwd();
  process.chdir(root);
  let modules: CruisedModule[];
  try {
    const result = await cruise([scope], {
      doNotFollow: { path: 'node_modules' },
      exclude: { path: ['node_modules', 'dist', 'coverage'] },
      tsPreCompilationDeps: true,
      outputType: 'json',
    });
    const raw =
      typeof result.output === 'string'
        ? result.output
        : JSON.stringify(result.output);
    modules = (JSON.parse(raw) as { modules: CruisedModule[] }).modules;
  } finally {
    process.chdir(previousCwd);
  }

  // drop builtins & unresolved externals cruise reports as modules (path, shiki/core, ...)
  const repoModules = modules.filter(
    (m) =>
      !m.source.includes('node_modules') && existsSync(resolve(root, m.source))
  );
  const nodeIds = new Set(repoModules.map((m) => m.source));

  const config = loadConfig(root);
  const nodes: GraphNode[] = repoModules.map((m) => ({
    id: m.source,
    kind: 'file',
    label: m.source.split('/').pop() ?? m.source,
    group: resolveGroup(m.source, config).id,
  }));

  const edges: GraphEdge[] = [];
  for (const m of repoModules) {
    for (const dep of m.dependencies) {
      if (dep.coreModule || dep.couldNotResolve) {
        continue;
      }
      if (!nodeIds.has(dep.resolved)) {
        continue;
      }
      edges.push({
        id: `e${edges.length}`,
        from: m.source,
        to: dep.resolved,
        kind: 'imports',
        ...(dep.dynamic ? { dynamic: true } : {}),
      });
    }
  }

  return {
    version: 1,
    repoRoot: root,
    mode: 'imports',
    generatedAt: new Date().toISOString(),
    ...gitRef(root),
    scope,
    nodes,
    edges,
    groups: collectGroups(nodes, config),
    metrics: computeMetrics(nodes, edges),
  };
}

// config-defined groups in rule order, heuristic groups alphabetical after
function collectGroups(
  nodes: GraphNode[],
  config: CartographerConfig
): GraphGroup[] {
  const fileCounts = new Map<string, number>();
  for (const node of nodes) {
    fileCounts.set(node.group, (fileCounts.get(node.group) ?? 0) + 1);
  }

  const groups: GraphGroup[] = [];
  const seen = new Set<string>();
  for (const rule of config.groups) {
    const fileCount = fileCounts.get(rule.name);
    if (!fileCount || seen.has(rule.name)) {
      continue;
    }
    seen.add(rule.name);
    groups.push({
      id: rule.name,
      label: rule.name,
      ...(rule.description ? { description: rule.description } : {}),
      fileCount,
    });
  }
  const heuristic = [...fileCounts.keys()]
    .filter((id) => !seen.has(id))
    .sort((a, b) => a.localeCompare(b));
  for (const id of heuristic) {
    groups.push({ id, label: id, fileCount: fileCounts.get(id) ?? 0 });
  }
  return groups;
}

function gitRef(root: string): { gitRef?: string } {
  try {
    const ref = execSync('git rev-parse --short HEAD', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return ref ? { gitRef: ref } : {};
  } catch {
    return {};
  }
}

function computeMetrics(nodes: GraphNode[], edges: GraphEdge[]): GraphMetrics {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  let maxFanIn = 0;
  let maxFanOut = 0;
  for (const node of nodes) {
    fanIn.set(node.id, 0);
    fanOut.set(node.id, 0);
  }
  for (const edge of edges) {
    const nextFanOut = (fanOut.get(edge.from) ?? 0) + 1;
    const nextFanIn = (fanIn.get(edge.to) ?? 0) + 1;
    fanOut.set(edge.from, nextFanOut);
    fanIn.set(edge.to, nextFanIn);
    maxFanOut = Math.max(maxFanOut, nextFanOut);
    maxFanIn = Math.max(maxFanIn, nextFanIn);
  }

  let orphans = 0;
  for (const node of nodes) {
    if ((fanIn.get(node.id) ?? 0) === 0 && (fanOut.get(node.id) ?? 0) === 0) {
      orphans += 1;
    }
  }

  return {
    cycles: countCycles(nodes, edges),
    orphans,
    maxFanIn,
    maxFanOut,
  };
}

// Kosaraju SCC count -> components w/ more than one node, plus self-loops
function countCycles(nodes: GraphNode[], edges: GraphEdge[]): number {
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  for (const node of nodes) {
    forward.set(node.id, []);
    reverse.set(node.id, []);
  }
  let selfLoops = 0;
  for (const edge of edges) {
    if (edge.from === edge.to) {
      selfLoops += 1;
      continue;
    }
    forward.get(edge.from)?.push(edge.to);
    reverse.get(edge.to)?.push(edge.from);
  }

  const visited = new Set<string>();
  const order: string[] = [];
  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }
    // iterative post-order DFS
    const stack: Array<{ id: string; index: number }> = [
      { id: node.id, index: 0 },
    ];
    visited.add(node.id);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = forward.get(frame.id) ?? [];
      if (frame.index < neighbors.length) {
        const next = neighbors[frame.index];
        frame.index += 1;
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, index: 0 });
        }
      } else {
        order.push(frame.id);
        stack.pop();
      }
    }
  }

  const assigned = new Set<string>();
  let cyclicComponents = 0;
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const rootId = order[i];
    if (assigned.has(rootId)) {
      continue;
    }
    let size = 0;
    const stack = [rootId];
    assigned.add(rootId);
    while (stack.length > 0) {
      const id = stack.pop() as string;
      size += 1;
      for (const prev of reverse.get(id) ?? []) {
        if (!assigned.has(prev)) {
          assigned.add(prev);
          stack.push(prev);
        }
      }
    }
    if (size > 1) {
      cyclicComponents += 1;
    }
  }

  return cyclicComponents + selfLoops;
}
