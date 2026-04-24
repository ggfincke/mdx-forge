// structured diagnostics for the render plugin. every failure mode — mdx
// parse errors, runtime crashes, prop lint warnings, frontmatter gaps —
// funnels through this shape so the MCP response is uniform.

import type { FrameworkId, ComponentSpec, FrontmatterSchema } from './registry.js';
import {
  allComponentNamesForFramework,
  findComponent,
  getFrontmatterSchema,
} from './registry.js';

export type DiagnosticKind =
  | 'mdx-syntax'
  | 'unknown-component'
  | 'invalid-prop'
  | 'missing-required-prop'
  | 'invalid-prop-value'
  | 'deprecated-alias'
  | 'missing-frontmatter'
  | 'unknown-frontmatter'
  | 'invalid-frontmatter-type'
  | 'runtime-error';

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  kind: DiagnosticKind;
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  component?: string;
  prop?: string;
  field?: string;
  suggestion?: string;
}

// render-failing diagnostics throw this. the server catches it & emits a
// structured MCP error instead of a stack trace.
export class RenderDiagnosticError extends Error {
  readonly diagnostic: Diagnostic;
  // additional non-fatal diagnostics that accumulated before the failure
  readonly warnings: readonly Diagnostic[];

  constructor(diagnostic: Diagnostic, warnings: readonly Diagnostic[] = []) {
    super(diagnostic.message);
    this.name = 'RenderDiagnosticError';
    this.diagnostic = diagnostic;
    this.warnings = warnings;
  }
}

// --- did-you-mean -----------------------------------------------------------

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

// fuzzy-match a candidate against a fixed vocabulary; return the best match
// within `maxDistance` if any, else undefined. honours length-based weighting
// to avoid suggesting short garbage for long inputs.
export function suggestMatch(
  candidate: string,
  vocabulary: readonly string[],
  maxDistance = 3,
): string | undefined {
  if (!candidate || vocabulary.length === 0) {
    return undefined;
  }
  let best: string | undefined;
  let bestDistance = maxDistance + 1;
  for (const word of vocabulary) {
    const d = levenshtein(candidate, word);
    if (d < bestDistance) {
      bestDistance = d;
      best = word;
    }
  }
  if (best === undefined || bestDistance > maxDistance) {
    return undefined;
  }
  const ratio = bestDistance / Math.max(candidate.length, best.length);
  if (ratio > 0.5) {
    return undefined;
  }
  return best;
}

export function suggestComponent(
  name: string,
  framework: FrameworkId,
): string | undefined {
  return suggestMatch(name, allComponentNamesForFramework(framework));
}

export function suggestProp(
  name: string,
  component: ComponentSpec,
): string | undefined {
  return suggestMatch(
    name,
    component.props.map((p) => p.name),
  );
}

export function suggestFrontmatterField(
  name: string,
  schema: FrontmatterSchema,
): string | undefined {
  return suggestMatch(
    name,
    schema.fields.map((f) => f.name),
  );
}

// --- error normalization ----------------------------------------------------

// extract `{ line, column }` from the "1:5:" prefix that MDX/unified errors
// embed in their messages. best-effort — not every error has a position.
const POSITION_PATTERN = /(\d+):(\d+)/;

function extractPosition(
  err: unknown,
): { line?: number; column?: number } {
  if (err && typeof err === 'object') {
    const vfilePosition = (err as {
      line?: number;
      column?: number;
      position?: { start?: { line?: number; column?: number } };
    });
    if (typeof vfilePosition.line === 'number') {
      return {
        line: vfilePosition.line,
        column:
          typeof vfilePosition.column === 'number'
            ? vfilePosition.column
            : undefined,
      };
    }
    const start = vfilePosition.position?.start;
    if (start && typeof start.line === 'number') {
      return { line: start.line, column: start.column };
    }
  }

  const msg = err instanceof Error ? err.message : String(err);
  const match = POSITION_PATTERN.exec(msg);
  if (match) {
    return { line: Number(match[1]), column: Number(match[2]) };
  }
  return {};
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

// patterns that identify common Trusted Mode runtime failures so we can
// re-tag them from the generic `runtime-error` bucket to a more specific kind.
const EXPECTED_COMPONENT_PATTERN =
  /Expected component `?([A-Za-z_$][A-Za-z0-9_$]*)`? to be defined/;

export interface CompileErrorContext {
  source: string;
  framework: FrameworkId;
}

export function normalizeCompileError(
  err: unknown,
  ctx: CompileErrorContext,
): Diagnostic {
  const msg = errorMessage(err);
  const { line, column } = extractPosition(err);

  // "Expected component 'X' to be defined" — Trusted Mode threw during mount
  // because the MDX referenced a component the shim barrel doesn't export.
  const componentMatch = EXPECTED_COMPONENT_PATTERN.exec(msg);
  if (componentMatch) {
    const component = componentMatch[1];
    return {
      kind: 'unknown-component',
      severity: 'error',
      message: `Component <${component}> is not available in framework "${ctx.framework}".`,
      component,
      suggestion: suggestComponent(component, ctx.framework),
      line,
      column,
    };
  }

  // "Could not parse import/exports" / "Unexpected character" etc. come from
  // micromark-extension-mdx-*. Position is usually embedded in the message.
  if (
    msg.includes('Could not parse') ||
    msg.includes('Unexpected') ||
    msg.includes('Unclosed') ||
    msg.includes('Unterminated')
  ) {
    return {
      kind: 'mdx-syntax',
      severity: 'error',
      message: msg,
      line,
      column,
    };
  }

  return {
    kind: 'runtime-error',
    severity: 'error',
    message: msg,
    line,
    column,
  };
}

// flatten an accumulated diagnostics bundle into MCP-compatible content blocks
export function formatDiagnostic(d: Diagnostic): string {
  const where = d.line ? ` (line ${d.line}${d.column ? `:${d.column}` : ''})` : '';
  const scope = d.component ? ` <${d.component}>` : d.field ? ` ${d.field}` : '';
  const suggestion = d.suggestion ? ` — did you mean "${d.suggestion}"?` : '';
  return `[${d.severity} ${d.kind}]${scope}${where} ${d.message}${suggestion}`;
}

// --- exported for consumers that want to build diagnostics directly --------

export function buildUnknownComponentDiagnostic(
  name: string,
  framework: FrameworkId,
  position?: { line?: number; column?: number },
): Diagnostic {
  return {
    kind: 'unknown-component',
    severity: 'error',
    message: `Component <${name}> is not in the "${framework}" shim registry.`,
    component: name,
    suggestion: suggestComponent(name, framework),
    line: position?.line,
    column: position?.column,
  };
}

// severity is 'warning' because lintMdxSource never treats this as fatal —
// a missing required field surfaces but doesn't block the render.
export function buildMissingFrontmatterDiagnostic(
  field: string,
  framework: FrameworkId,
): Diagnostic {
  return {
    kind: 'missing-frontmatter',
    severity: 'warning',
    message: `Frontmatter field "${field}" is required for framework "${framework}".`,
    field,
    suggestion: suggestFrontmatterField(field, getFrontmatterSchema(framework)),
  };
}

// re-export so callers don't need to import registry + diagnostics separately
export { findComponent };
