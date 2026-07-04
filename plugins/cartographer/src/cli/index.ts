#!/usr/bin/env node
// plugins/cartographer/src/cli/index.ts
// cartographer CLI -> build, emit-mdx, render, diff, blast-radius, watch

import { spawn } from 'node:child_process';
import { readFileSync, watch as watchFs, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  buildGraph,
  computeBlastRadius,
  DEFAULT_MAX_DEPTH,
  DEFAULT_SCOPE,
  diffGraphs,
  formatDiffSummary,
  type BlastDirection,
} from '../analyze/index.js';
import {
  emitArchitectureMdx,
  formatPrSummary,
  renderArchitectureHtml,
} from '../emit/index.js';
import {
  architectureHtmlPath,
  architectureMdxPath,
  DEFAULT_OUT_DIR,
  graphJsonPath,
  hasGraph,
  listSnapshots,
  loadGraph,
  loadSnapshot,
  prSummaryPath,
  recordSnapshot,
  saveGraph,
  suppressSqliteWarning,
} from '../store/index.js';
import type { CartographerGraph } from '../types.js';

suppressSqliteWarning();

const DEFAULT_PORT = 4977;

const USAGE = `cartographer — local-first repo graph & MDX architecture artifacts

Usage:
  cartographer build [root] [--scope <dir>] [--out <dir>] [--emit-mdx] [--render] [--open]
  cartographer emit-mdx [root] [--out <dir>]
  cartographer render [root] [--out <dir>] [--open]
  cartographer diff [root] [--scope <dir>] [--out <dir>] [--base <snapshot-id>] [--save]
  cartographer check-pr [root] [--scope <dir>] [--out <dir>] [--base <snapshot-id>]
  cartographer snapshots [root] [--out <dir>]
  cartographer blast-radius [root] --target <file> [--direction both|upstream|downstream] [--max-depth <n>]
  cartographer watch [root] [--scope <dir>] [--out <dir>] [--emit-mdx] [--render]
  cartographer serve [root] [--scope <dir>] [--out <dir>] [--port <n>] [--open]

Defaults: root ".", --scope "${DEFAULT_SCOPE}", --out "${DEFAULT_OUT_DIR}", --direction both, --max-depth ${DEFAULT_MAX_DEPTH}, --port ${DEFAULT_PORT}
`;

const WATCH_DEBOUNCE_MS = 300;
const WATCH_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

interface CliValues {
  scope?: string;
  out?: string;
  'emit-mdx'?: boolean;
  render?: boolean;
  open?: boolean;
  save?: boolean;
  base?: string;
  target?: string;
  direction?: string;
  'max-depth'?: string;
  port?: string;
  help?: boolean;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      scope: { type: 'string' },
      out: { type: 'string' },
      'emit-mdx': { type: 'boolean' },
      render: { type: 'boolean' },
      open: { type: 'boolean' },
      save: { type: 'boolean' },
      base: { type: 'string' },
      target: { type: 'string' },
      direction: { type: 'string' },
      'max-depth': { type: 'string' },
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const [command, rootArg] = positionals;
  if (values.help || !command) {
    process.stdout.write(USAGE);
    process.exitCode = command ? 0 : 1;
    return;
  }
  const root = rootArg ?? '.';

  switch (command) {
    case 'build':
      await runBuild(root, values);
      return;
    case 'emit-mdx': {
      const graph = loadGraph(root, values.out);
      console.log(`mdx -> ${writeMdx(graph, root, values.out)}`);
      return;
    }
    case 'render': {
      const graph = loadGraph(root, values.out);
      const mdxSource = emitArchitectureMdx(graph);
      writeMdxSource(mdxSource, root, values.out);
      const htmlPath = await writeHtml(mdxSource, root, values.out);
      console.log(`html -> ${htmlPath}`);
      if (values.open) {
        openInBrowser(htmlPath);
      }
      return;
    }
    case 'diff':
      await runDiff(root, values);
      return;
    case 'check-pr':
      await runCheckPr(root, values);
      return;
    case 'snapshots':
      runSnapshots(root, values);
      return;
    case 'blast-radius':
      await runBlastRadius(root, values);
      return;
    case 'watch':
      await runWatch(root, values);
      return;
    case 'serve':
      await runServe(root, values);
      return;
    default:
      throw new Error(`unknown command "${command}"\n\n${USAGE}`);
  }
}

async function runBuild(root: string, values: CliValues): Promise<void> {
  const graph = await buildGraph({ root, scope: values.scope });
  const graphPath = saveGraph(graph, root, values.out);
  const snapshotId = recordSnapshot(graph, root, values.out);
  console.log(`graph -> ${graphPath} (snapshot #${snapshotId})`);
  logSummary(graph);
  let mdxSource: string | undefined;
  if (values['emit-mdx'] || values.render) {
    mdxSource = emitArchitectureMdx(graph);
    console.log(`mdx -> ${writeMdxSource(mdxSource, root, values.out)}`);
  }
  if (values.render) {
    const htmlPath = await writeHtml(
      mdxSource ?? emitArchitectureMdx(graph),
      root,
      values.out
    );
    console.log(`html -> ${htmlPath}`);
    if (values.open) {
      openInBrowser(htmlPath);
    }
  }
}

async function runDiff(root: string, values: CliValues): Promise<void> {
  const base = values.base
    ? loadSnapshot(root, parsePositiveInt(values.base, '--base'), values.out)
    : loadBaseline(root, values.out);
  const head = await buildGraph({ root, scope: values.scope ?? base.scope });
  const diff = diffGraphs(base, head);
  console.log(formatDiffSummary(diff));
  if (diff.changed) {
    console.log(JSON.stringify(diff, null, 2));
  }
  if (values.save) {
    const snapshotId = recordSnapshot(head, root, values.out);
    console.log(
      `baseline -> ${saveGraph(head, root, values.out)} (snapshot #${snapshotId})`
    );
  }
  process.exitCode = diff.changed ? 1 : 0;
}

async function runCheckPr(root: string, values: CliValues): Promise<void> {
  const base = values.base
    ? loadSnapshot(root, parsePositiveInt(values.base, '--base'), values.out)
    : loadBaseline(root, values.out);
  const head = await buildGraph({ root, scope: values.scope ?? base.scope });
  const diff = diffGraphs(base, head);
  const summary = formatPrSummary(diff, base, head);
  const summaryPath = prSummaryPath(root, values.out);
  writeFileSync(summaryPath, summary);
  process.stdout.write(summary);
  console.error(`summary -> ${summaryPath}`);
  process.exitCode = diff.changed ? 1 : 0;
}

function loadBaseline(root: string, outDir?: string): CartographerGraph {
  if (!hasGraph(root, outDir)) {
    throw new Error(
      `no baseline graph -> run \`cartographer build\` first, then diff after changes`
    );
  }
  return loadGraph(root, outDir);
}

function runSnapshots(root: string, values: CliValues): void {
  const snapshots = listSnapshots(root, values.out);
  if (snapshots.length === 0) {
    console.log('no snapshots -> run `cartographer build` first');
    return;
  }
  for (const s of snapshots) {
    console.log(
      `#${s.id}  ${s.createdAt}  ${s.gitRef ?? '-------'}  ` +
        `${s.nodes} files, ${s.edges} imports, ${s.cycles} cycles  (${s.scope})`
    );
  }
}

async function runBlastRadius(root: string, values: CliValues): Promise<void> {
  if (!values.target) {
    throw new Error('blast-radius requires --target <file>');
  }
  const direction = parseDirection(values.direction);
  const maxDepth = values['max-depth']
    ? parsePositiveInt(values['max-depth'], '--max-depth')
    : DEFAULT_MAX_DEPTH;
  const graph = hasGraph(root, values.out)
    ? loadGraph(root, values.out)
    : await buildGraph({ root, scope: values.scope });
  const result = computeBlastRadius(graph, values.target, direction, maxDepth);
  console.log(JSON.stringify(result, null, 2));
}

async function runWatch(root: string, values: CliValues): Promise<void> {
  let previous = await buildGraph({ root, scope: values.scope });
  saveGraph(previous, root, values.out);
  await writeArtifacts(previous, root, values);
  logSummary(previous);
  console.log(`watching ${resolve(root, previous.scope)} ...`);

  let timer: NodeJS.Timeout | undefined;
  const rebuild = async (): Promise<void> => {
    try {
      const next = await buildGraph({ root, scope: values.scope });
      const diff = diffGraphs(previous, next);
      previous = next;
      saveGraph(next, root, values.out);
      await writeArtifacts(next, root, values);
      const stamp = new Date().toLocaleTimeString();
      console.log(`[${stamp}] ${formatDiffSummary(diff)}`);
    } catch (err) {
      console.error(
        `rebuild failed: ${err instanceof Error ? err.message : err}`
      );
    }
  };

  const watcher = watchFs(
    resolve(root, previous.scope),
    { recursive: true },
    (_event, filename) => {
      if (!filename || !WATCH_EXTENSIONS.test(filename)) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => void rebuild(), WATCH_DEBOUNCE_MS);
    }
  );

  await new Promise<void>((resolvePromise) => {
    const stop = (): void => {
      watcher.close();
      resolvePromise();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

async function runServe(root: string, values: CliValues): Promise<void> {
  if (!hasGraph(root, values.out)) {
    const graph = await buildGraph({ root, scope: values.scope });
    saveGraph(graph, root, values.out);
    recordSnapshot(graph, root, values.out);
  }
  const port = values.port
    ? parsePositiveInt(values.port, '--port')
    : DEFAULT_PORT;
  const webDir = join(dirname(fileURLToPath(import.meta.url)), '../web');
  const assets: Record<string, { path: string; type: string }> = {
    '/': { path: join(webDir, 'index.html'), type: 'text/html' },
    '/app.js': { path: join(webDir, 'app.js'), type: 'text/javascript' },
    '/app.css': { path: join(webDir, 'app.css'), type: 'text/css' },
  };

  const server = createServer((request, response) => {
    const url = request.url ?? '/';
    try {
      if (url.startsWith('/graph.json')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(readFileSync(graphJsonPath(root, values.out)));
        return;
      }
      const asset = assets[url];
      if (!asset) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': asset.type });
      response.end(readFileSync(asset.path));
    } catch (err) {
      response.writeHead(500).end(err instanceof Error ? err.message : 'error');
    }
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}/`;
      console.log(`preview -> ${url}`);
      console.log(
        'tip: run `cartographer watch` in another terminal for live updates'
      );
      if (values.open) {
        openInBrowser(url);
      }
    });
    const stop = (): void => {
      server.close();
      resolvePromise();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

async function writeArtifacts(
  graph: CartographerGraph,
  root: string,
  values: CliValues
): Promise<void> {
  let mdxSource: string | undefined;
  if (values['emit-mdx'] || values.render) {
    mdxSource = emitArchitectureMdx(graph);
    writeMdxSource(mdxSource, root, values.out);
  }
  if (values.render) {
    await writeHtml(mdxSource ?? emitArchitectureMdx(graph), root, values.out);
  }
}

function writeMdx(
  graph: CartographerGraph,
  root: string,
  outDir?: string
): string {
  return writeMdxSource(emitArchitectureMdx(graph), root, outDir);
}

function writeMdxSource(
  mdxSource: string,
  root: string,
  outDir?: string
): string {
  const path = architectureMdxPath(root, outDir);
  writeFileSync(path, mdxSource);
  return path;
}

async function writeHtml(
  mdxSource: string,
  root: string,
  outDir?: string
): Promise<string> {
  const mdxPath = architectureMdxPath(root, outDir);
  const { html } = await renderArchitectureHtml(mdxSource, mdxPath);
  const path = architectureHtmlPath(root, outDir);
  writeFileSync(path, html);
  return path;
}

function openInBrowser(path: string): void {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  spawn(command, [path], { detached: true, stdio: 'ignore' }).unref();
}

function logSummary(graph: CartographerGraph): void {
  const m = graph.metrics;
  const blocks = graph.groups?.length ?? 0;
  console.log(
    `${graph.nodes.length} files, ${graph.edges.length} imports, ` +
      `${blocks} block${blocks === 1 ? '' : 's'} | ` +
      `cycles ${m.cycles}, orphans ${m.orphans}, ` +
      `max fan-in ${m.maxFanIn}, max fan-out ${m.maxFanOut}`
  );
}

function parseDirection(value: string | undefined): BlastDirection {
  const direction = value ?? 'both';
  if (
    direction !== 'both' &&
    direction !== 'upstream' &&
    direction !== 'downstream'
  ) {
    throw new Error(
      `invalid --direction "${direction}" -> use both, upstream, or downstream`
    );
  }
  return direction;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`invalid ${flag} "${value}" -> use a positive integer`);
  }
  return parsed;
}

main().catch((err) => {
  console.error(`cartographer: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
