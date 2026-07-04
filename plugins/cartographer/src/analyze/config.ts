// plugins/cartographer/src/analyze/config.ts
// optional .cartographer.json -> named group rules + depth heuristic fallback

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface GroupRule {
  // glob (* & **) or plain path prefix
  match: string;
  name: string;
  description?: string;
}

export interface CartographerConfig {
  groups: GroupRule[];
  groupDepth: number;
}

export interface ResolvedGroup {
  id: string;
  label: string;
  description?: string;
}

export const CONFIG_FILE = '.cartographer.json';
const DEFAULT_GROUP_DEPTH = 2;
const ROOT_GROUP = '(root)';

export function loadConfig(root: string): CartographerConfig {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) {
    return { groups: [], groupDepth: DEFAULT_GROUP_DEPTH };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(
      `invalid ${CONFIG_FILE}: ${err instanceof Error ? err.message : err}`,
      { cause: err }
    );
  }
  const raw = parsed as {
    groups?: unknown;
    groupDepth?: unknown;
  };
  const groups = Array.isArray(raw.groups)
    ? raw.groups.map((rule, index) => parseRule(rule, index))
    : [];
  const groupDepth =
    typeof raw.groupDepth === 'number' &&
    Number.isInteger(raw.groupDepth) &&
    raw.groupDepth >= 1
      ? raw.groupDepth
      : DEFAULT_GROUP_DEPTH;
  return { groups, groupDepth };
}

function parseRule(rule: unknown, index: number): GroupRule {
  const r = rule as Record<string, unknown>;
  if (typeof r?.match !== 'string' || typeof r?.name !== 'string') {
    throw new Error(
      `invalid ${CONFIG_FILE}: groups[${index}] needs string "match" & "name"`
    );
  }
  return {
    match: r.match,
    name: r.name,
    ...(typeof r.description === 'string'
      ? { description: r.description }
      : {}),
  };
}

// first matching rule wins; heuristic prefix group otherwise
export function resolveGroup(
  fileId: string,
  config: CartographerConfig
): ResolvedGroup {
  for (const rule of config.groups) {
    if (matchesRule(fileId, rule.match)) {
      return {
        id: rule.name,
        label: rule.name,
        ...(rule.description ? { description: rule.description } : {}),
      };
    }
  }
  const prefix = heuristicGroup(fileId, config.groupDepth);
  return { id: prefix, label: prefix };
}

function matchesRule(fileId: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return fileId === pattern || fileId.startsWith(`${pattern}/`);
  }
  return globToRegExp(pattern).test(fileId);
}

// minimal glob: ** crosses slashes, * stays within a segment
function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}

function heuristicGroup(fileId: string, depth: number): string {
  const dir = dirname(fileId);
  if (dir === '.') {
    return ROOT_GROUP;
  }
  return dir.split('/').slice(0, depth).join('/');
}
