// src/internal/frontmatter.ts
// gray-matter wrapper that disables executable JS frontmatter (eval) & bounds
// the parsed data into acyclic plain values to stop amplification / cycles

import matter from 'gray-matter';

// bounds for normalized frontmatter; reject graphs that exceed any of them
// depth guards deep alias nesting; nodes/bytes guard exponential alias fan-out
export const MAX_FRONTMATTER_DEPTH = 8;
export const MAX_FRONTMATTER_NODES = 5000;
export const MAX_FRONTMATTER_SERIALIZED_BYTES = 256 * 1024;
const FORBIDDEN_FRONTMATTER_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
const UTF8_ENCODER = new TextEncoder();

// ! thrown deterministically when frontmatter is cyclic or over the caps above
export class FrontmatterBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterBoundsError';
  }
}

interface NormalizeState {
  nodes: number;
  bytes: number;
}

// approximate serialized size of a scalar so we can bound projected JSON output
function scalarBytes(value: unknown): number {
  if (typeof value === 'string') {
    return UTF8_ENCODER.encode(value).byteLength + 2;
  }
  return UTF8_ENCODER.encode(String(value)).byteLength;
}

// deep-clone into plain acyclic data; throw once any bound is exceeded
// ancestors set rejects true cycles; nodes/bytes reject DAG fan-out amplification
function cloneBounded(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
  state: NormalizeState
): unknown {
  if (value === null || typeof value !== 'object') {
    state.nodes++;
    state.bytes += scalarBytes(value);
    if (state.nodes > MAX_FRONTMATTER_NODES) {
      throw new FrontmatterBoundsError(
        `frontmatter exceeds ${MAX_FRONTMATTER_NODES} nodes; refusing to expand YAML aliases`
      );
    }
    if (state.bytes > MAX_FRONTMATTER_SERIALIZED_BYTES) {
      throw new FrontmatterBoundsError(
        `frontmatter projected size exceeds ${MAX_FRONTMATTER_SERIALIZED_BYTES} bytes; refusing to expand YAML aliases`
      );
    }
    return value;
  }

  if (value instanceof Date) {
    state.nodes++;
    state.bytes += 24;
    return value;
  }

  if (depth > MAX_FRONTMATTER_DEPTH) {
    throw new FrontmatterBoundsError(
      `frontmatter nesting exceeds depth ${MAX_FRONTMATTER_DEPTH}`
    );
  }

  const container = value as object;
  if (ancestors.has(container)) {
    throw new FrontmatterBoundsError(
      'frontmatter contains a cyclic reference (YAML alias loop)'
    );
  }
  ancestors.add(container);
  state.nodes++;
  if (state.nodes > MAX_FRONTMATTER_NODES) {
    throw new FrontmatterBoundsError(
      `frontmatter exceeds ${MAX_FRONTMATTER_NODES} nodes; refusing to expand YAML aliases`
    );
  }

  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((entry) =>
      cloneBounded(entry, depth + 1, ancestors, state)
    );
  } else {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_FRONTMATTER_KEYS.has(key)) {
        continue;
      }
      state.bytes += UTF8_ENCODER.encode(key).byteLength + 4;
      out[key] = cloneBounded(entry, depth + 1, ancestors, state);
    }
    result = out;
  }

  ancestors.delete(container);
  return result;
}

// normalize gray-matter data into bounded acyclic plain data
export function normalizeFrontmatterData(
  data: unknown
): Record<string, unknown> {
  const state: NormalizeState = { nodes: 0, bytes: 0 };
  const normalized = cloneBounded(data, 0, new Set(), state);
  if (
    normalized === null ||
    typeof normalized !== 'object' ||
    Array.isArray(normalized)
  ) {
    return {};
  }
  const prototype = Object.getPrototypeOf(normalized);
  return prototype === Object.prototype || prototype === null
    ? (normalized as Record<string, unknown>)
    : {};
}

// parse frontmatter w/o eval before mode-specific normalization
export function parseRawFrontmatter(input: string) {
  return matter(input, {
    engines: {
      javascript: () => ({}),
    },
  });
}

// neutralize gray-matter's default `javascript` engine (runs eval) w/ a no-op
// covers `---js` & `---javascript` fences (engine aliases js -> javascript)
export function safeMatter(input: string) {
  const parsed = parseRawFrontmatter(input);
  // bound the parsed graph so downstream JSON.stringify / consumers stay safe
  parsed.data = normalizeFrontmatterData(parsed.data);
  return parsed;
}
