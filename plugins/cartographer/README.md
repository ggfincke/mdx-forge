# cartographer

Local-first architecture cockpit for agent-driven coding. Builds a TS/JS
imports graph via dependency-cruiser, emits MDX architecture artifacts
rendered through mdx-forge, and exposes the graph to Claude Code / Codex
via MCP.

**Status: MVP complete + blocks.** Graph build, MDX + HTML emission, diff,
blast radius, watch mode, SQLite snapshot history, React Flow preview w/
blocks view + filtering, CLI (incl `check-pr`), MCP tools, and a GitHub
Action template all work. See `dev-docs/cartographer-research-report.md` at
the repo root for the plan.

## Blocks

Every file belongs to a block — a named group from `.cartographer.json` at
the target repo root, or a folder-prefix heuristic (`groupDepth` path
segments, default 2) when no rule matches:

```json
{
  "groups": [
    {
      "match": "src/compiler/**",
      "name": "Compiler",
      "description": "MDX -> HTML/JS pipeline"
    }
  ],
  "groupDepth": 2
}
```

`match` is a glob (`*` within a segment, `**` across) or a plain path prefix;
first rule wins. Blocks feed every surface: `graph.json` (`groups[]`), the
preview's blocks view, the Blocks section + Mermaid subgraphs in
`architecture.mdx`, and `graph_repo`'s `blocks`/`blockImports` MCP output.

## CLI

```bash
# build graph.json (+ optional artifacts) into <root>/.cartographer/
cartographer build . --scope src --emit-mdx --render --open

# re-emit / re-render from the saved graph
cartographer emit-mdx .
cartographer render . --open

# drift since the saved baseline (exits 1 on drift; --save promotes the new baseline)
cartographer diff . --save

# drift since a historical snapshot
cartographer snapshots .
cartographer diff . --base 3

# CI-friendly drift check -> writes .cartographer/pr-summary.md, exits 1 on drift
cartographer check-pr .

# impacted files from a change to one file
cartographer blast-radius . --target src/auth/session.ts --direction both --max-depth 4

# rebuild + diff summary on every source change
cartographer watch . --emit-mdx --render

# interactive React Flow graph at http://127.0.0.1:4977/ (pair w/ watch for live updates)
# blocks view by default (click a block to drill into its files);
# header filter box dims non-matching nodes & shows the match count
cartographer serve . --open
```

## MCP tools

- `graph_repo` — build the imports graph, write `graph.json` (and optionally
  `architecture.mdx`), record a snapshot, return metrics + hotspots + the
  block-level rollup (`blocks`, `blockImports`).
- `graph_diff` — fresh build vs the saved baseline (or a historical snapshot
  via `baseSnapshotId`): added/removed files & imports, drift summary.
- `blast_radius` — upstream (dependents) and downstream (dependencies) of a
  target file, from the saved graph (builds on demand when missing).
- `list_snapshots` — snapshot history from `graph.db` w/ per-snapshot counts.

## Artifacts

Everything lands in `<root>/.cartographer/` (gitignored):

- `graph.json` — nodes, edges, blocks, metrics (cycles, orphans, fan-in/out)
- `graph.db` — SQLite snapshot history (via `node:sqlite`, zero deps)
- `architecture.mdx` — frontmatter, metrics tables, hotspots, Mermaid graph
- `architecture.html` — self-contained Safe Mode render (mermaid diagrams
  render live via the `mdx-forge-render` plugin's preview instead)
- `pr-summary.md` — markdown drift report from `check-pr` (metrics deltas,
  added/removed files & imports) sized for a PR comment

## Layout

- `src/cli/` — command entry points + preview http server
- `src/mcp/` — stdio MCP server (`dist/mcp/server.js`)
- `src/analyze/` — graph extraction, diff, blast radius
- `src/emit/` — MDX emission + compileSafe HTML rendering
- `src/store/` — artifact paths, graph JSON load/save, SQLite snapshots
- `src/web/` — React Flow preview app (esbuild bundle -> `dist/web/`)
- `templates/` — GitHub Action starting point (`architecture-check.yml`)

## Install

```bash
cd plugins/cartographer
npm install
npm run build

# CLI
node dist/cli/index.js build /path/to/repo --render

# MCP (stdio)
npm start
```
