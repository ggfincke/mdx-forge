// src/compiler/safe-document/internal.ts
// conversion context, ranges, diagnostics & URL policy

import type { Program } from 'estree';
import type { Node, Position } from 'unist';
import { DIAGNOSTIC_CODES } from '../../diagnostics/types';
import type {
  SafeDocumentCompileOptions,
  SafeDocumentDiagnostic,
  SafeDocumentDiagnosticCode,
  SafeDocumentJsonValue,
  SafeDocumentUrlContext,
} from './types';

export interface SafeDocumentCompileContext {
  options: SafeDocumentCompileOptions;
  diagnostics: SafeDocumentDiagnostic[];
  definitions: Map<string, SafeDocumentDefinition>;
  bodyLineOffset: number;
  bodyStartColumn: number;
  bodyOffset: number;
}

export interface SafeDocumentDefinition {
  url: string;
  title?: string;
  position?: Position;
}

export interface SafeDocumentMdxAttribute extends Node {
  type: 'mdxJsxAttribute' | 'mdxJsxExpressionAttribute';
  name?: string;
  value?: string | null | SafeDocumentMdxExpression;
}

export interface SafeDocumentMdxExpression extends Node {
  type: string;
  value?: string;
  data?: { estree?: Program };
}

export interface SafeDocumentMdastNode extends Node {
  children?: SafeDocumentMdastNode[];
  value?: string;
  depth?: number;
  url?: string;
  title?: string | null;
  alt?: string | null;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  lang?: string | null;
  meta?: string | null;
  align?: Array<'left' | 'right' | 'center' | null>;
  identifier?: string;
  name?: string | null;
  attributes?: SafeDocumentMdxAttribute[];
  data?: { estree?: Program };
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function addSafeDocumentDiagnostic(
  context: SafeDocumentCompileContext,
  code: SafeDocumentDiagnosticCode,
  ruleId: string,
  message: string,
  position?: Position,
  data?: Record<string, SafeDocumentJsonValue>,
  severity: SafeDocumentDiagnostic['severity'] = 'error'
): void {
  context.diagnostics.push({
    code,
    ruleId,
    severity,
    message,
    source: 'mdx-forge',
    ...(position ? { range: toSafeDocumentRange(position, context) } : {}),
    ...(data ? { data } : {}),
  });
}

export function toSafeDocumentRange(
  position: Position,
  context: SafeDocumentCompileContext
) {
  const startColumn =
    position.start.line === 1
      ? position.start.column + context.bodyStartColumn - 1
      : position.start.column;
  const endColumn =
    position.end.line === 1
      ? position.end.column + context.bodyStartColumn - 1
      : position.end.column;
  return {
    start: {
      line: position.start.line + context.bodyLineOffset,
      column: startColumn,
      ...(position.start.offset !== undefined
        ? { offset: position.start.offset + context.bodyOffset }
        : {}),
    },
    end: {
      line: position.end.line + context.bodyLineOffset,
      column: endColumn,
      ...(position.end.offset !== undefined
        ? { offset: position.end.offset + context.bodyOffset }
        : {}),
    },
  };
}

export function allowSafeDocumentUrl(
  url: string,
  urlContext: SafeDocumentUrlContext,
  position: Position | undefined,
  context: SafeDocumentCompileContext
): boolean {
  if (
    url.length === 0 ||
    url !== url.trim() ||
    hasControlOrSpace(url) ||
    url.includes('\\') ||
    url.startsWith('//')
  ) {
    rejectUrl(url, urlContext, position, context);
    return false;
  }

  let protocol: string;
  try {
    protocol = new URL(url, 'https://mdx-forge.invalid/').protocol;
  } catch {
    rejectUrl(url, urlContext, position, context);
    return false;
  }
  if (!SAFE_PROTOCOLS.has(protocol)) {
    rejectUrl(url, urlContext, position, context);
    return false;
  }

  try {
    const allowUrl = context.options.allowUrl;
    if (allowUrl) {
      const decision: unknown = allowUrl(url, urlContext);
      if (decision === true) {
        return true;
      }
      consumeThenableRejection(decision);
      rejectUrl(url, urlContext, position, context);
      return false;
    }
  } catch {
    rejectUrl(url, urlContext, position, context);
    return false;
  }
  return true;
}

function consumeThenableRejection(value: unknown): void {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return;
  }
  let then: unknown;
  try {
    then = Reflect.get(value, 'then');
  } catch {
    return;
  }
  if (typeof then !== 'function') {
    return;
  }
  try {
    Reflect.apply(then, value, [() => undefined, () => undefined]);
  } catch {
    return;
  }
}

function hasControlOrSpace(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 32 || code === 127) {
      return true;
    }
  }
  return false;
}

function rejectUrl(
  url: string,
  urlContext: SafeDocumentUrlContext,
  position: Position | undefined,
  context: SafeDocumentCompileContext
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.UNSAFE_URL,
    'safe-document/unsafe-url',
    `unsafe URL in ${urlContext.name}.${urlContext.prop}`,
    position,
    { ...urlContext, url }
  );
}
