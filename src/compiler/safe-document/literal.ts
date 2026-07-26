// src/compiler/safe-document/literal.ts
// decode bounded JSON literals from MDX expression ASTs

import type { Expression, ObjectExpression, Program, Property } from 'estree';
import { isReservedObjectKey } from '../../internal/object-key';
import type { SafeDocumentJsonValue } from './types';

const MAX_LITERAL_DEPTH = 16;
const MAX_LITERAL_NODES = 1000;

export type SafeLiteralResult =
  { ok: true; value: SafeDocumentJsonValue } | { ok: false; reason: string };

interface LiteralState {
  nodes: number;
}

export function readSafeLiteral(
  program: Program | undefined
): SafeLiteralResult {
  if (
    !program ||
    program.body.length !== 1 ||
    program.body[0]?.type !== 'ExpressionStatement'
  ) {
    return { ok: false, reason: 'expected one literal expression' };
  }
  return readExpression(program.body[0].expression, 0, { nodes: 0 });
}

function readExpression(
  expression: Expression,
  depth: number,
  state: LiteralState
): SafeLiteralResult {
  state.nodes++;
  if (depth > MAX_LITERAL_DEPTH) {
    return {
      ok: false,
      reason: `literal nesting exceeds depth ${MAX_LITERAL_DEPTH}`,
    };
  }
  if (state.nodes > MAX_LITERAL_NODES) {
    return {
      ok: false,
      reason: `literal exceeds ${MAX_LITERAL_NODES} nodes`,
    };
  }

  if (expression.type === 'Literal') {
    const { value } = expression;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return { ok: true, value };
    }
    return { ok: false, reason: 'literal is not JSON-compatible' };
  }

  if (expression.type === 'UnaryExpression') {
    if (
      expression.operator !== '-' ||
      expression.argument.type !== 'Literal' ||
      typeof expression.argument.value !== 'number'
    ) {
      return {
        ok: false,
        reason: 'only negative numeric literals are allowed',
      };
    }
    const value = -expression.argument.value;
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, reason: 'number must be finite' };
  }

  if (expression.type === 'TemplateLiteral') {
    if (expression.expressions.length !== 0 || expression.quasis.length !== 1) {
      return {
        ok: false,
        reason: 'template literals cannot contain expressions',
      };
    }
    const value = expression.quasis[0]?.value.cooked;
    return value === null || value === undefined
      ? { ok: false, reason: 'template literal is not valid text' }
      : { ok: true, value };
  }

  if (expression.type === 'ArrayExpression') {
    const values: SafeDocumentJsonValue[] = [];
    for (const element of expression.elements) {
      if (!element || element.type === 'SpreadElement') {
        return { ok: false, reason: 'array holes and spreads are not allowed' };
      }
      const result = readExpression(element, depth + 1, state);
      if (!result.ok) {
        return result;
      }
      values.push(result.value);
    }
    return { ok: true, value: values };
  }

  if (expression.type === 'ObjectExpression') {
    return readObject(expression, depth, state);
  }

  return {
    ok: false,
    reason: `${expression.type} is executable or non-literal syntax`,
  };
}

function readObject(
  expression: ObjectExpression,
  depth: number,
  state: LiteralState
): SafeLiteralResult {
  const value: Record<string, SafeDocumentJsonValue> = {};
  for (const entry of expression.properties) {
    if (entry.type !== 'Property') {
      return { ok: false, reason: 'object spreads are not allowed' };
    }
    const key = propertyKey(entry);
    if (!key || isReservedObjectKey(key)) {
      return { ok: false, reason: 'object key is unsupported' };
    }
    if (
      entry.kind !== 'init' ||
      entry.method ||
      entry.computed ||
      entry.shorthand ||
      entry.value.type === 'AssignmentPattern'
    ) {
      return { ok: false, reason: 'object property must be a plain literal' };
    }
    const result = readExpression(entry.value as Expression, depth + 1, state);
    if (!result.ok) {
      return result;
    }
    value[key] = result.value;
  }
  return { ok: true, value };
}

function propertyKey(property: Property): string | null {
  if (property.key.type === 'Identifier') {
    return property.key.name;
  }
  if (property.key.type === 'Literal') {
    const { value } = property.key;
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}
