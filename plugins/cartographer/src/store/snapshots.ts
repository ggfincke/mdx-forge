// plugins/cartographer/src/store/snapshots.ts
// snapshot history in .cartographer/graph.db via node:sqlite

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CartographerGraph } from '../types.js';
import { outDirPath } from './paths.js';

export interface SnapshotMeta {
  id: number;
  createdAt: string;
  gitRef?: string;
  scope: string;
  nodes: number;
  edges: number;
  cycles: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  git_ref TEXT,
  scope TEXT NOT NULL,
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  cycles INTEGER NOT NULL,
  graph_json TEXT NOT NULL
);
`;

export function dbPath(root: string, outDir?: string): string {
  return join(outDirPath(root, outDir), 'graph.db');
}

// node:sqlite emits an ExperimentalWarning on Node 22 -> mute just that one
export function suppressSqliteWarning(): void {
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === 'string' ? warning : warning.message;
    if (text.includes('SQLite is an experimental feature')) {
      return;
    }
    (original as (...args: unknown[]) => void)(warning, ...rest);
  }) as typeof process.emitWarning;
}

function openDb(root: string, outDir?: string): DatabaseSync {
  mkdirSync(outDirPath(root, outDir), { recursive: true });
  const db = new DatabaseSync(dbPath(root, outDir));
  db.exec(SCHEMA);
  return db;
}

function withDb<T>(
  root: string,
  outDir: string | undefined,
  callback: (db: DatabaseSync) => T
): T {
  const db = openDb(root, outDir);
  try {
    return callback(db);
  } finally {
    db.close();
  }
}

export function recordSnapshot(
  graph: CartographerGraph,
  root: string,
  outDir?: string
): number {
  return withDb(root, outDir, (db) => {
    const result = db
      .prepare(
        `INSERT INTO snapshots
           (created_at, git_ref, scope, node_count, edge_count, cycles, graph_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        graph.generatedAt,
        graph.gitRef ?? null,
        graph.scope,
        graph.nodes.length,
        graph.edges.length,
        graph.metrics.cycles,
        JSON.stringify(graph)
      );
    return Number(result.lastInsertRowid);
  });
}

export function listSnapshots(root: string, outDir?: string): SnapshotMeta[] {
  return withDb(root, outDir, (db) => {
    const rows = db
      .prepare(
        `SELECT id, created_at, git_ref, scope, node_count, edge_count, cycles
         FROM snapshots ORDER BY id DESC`
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: Number(row.id),
      createdAt: String(row.created_at),
      ...(row.git_ref ? { gitRef: String(row.git_ref) } : {}),
      scope: String(row.scope),
      nodes: Number(row.node_count),
      edges: Number(row.edge_count),
      cycles: Number(row.cycles),
    }));
  });
}

export function loadSnapshot(
  root: string,
  id: number,
  outDir?: string
): CartographerGraph {
  return withDb(root, outDir, (db) => {
    const row = db
      .prepare('SELECT graph_json FROM snapshots WHERE id = ?')
      .get(id) as { graph_json: string } | undefined;
    if (!row) {
      throw new Error(
        `no snapshot #${id} -> run \`cartographer snapshots\` to list`
      );
    }
    return JSON.parse(row.graph_json) as CartographerGraph;
  });
}
