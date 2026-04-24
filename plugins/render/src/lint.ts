// plugins/render/src/lint.ts
// MDX AST lint pass — walks JSX & frontmatter pre-compile, emits Diagnostics
// for unknown components, prop shape mismatches, & schema gaps.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import matter from 'gray-matter';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Diagnostic } from './diagnostics.js';
import {
  buildMissingFrontmatterDiagnostic,
  buildUnknownComponentDiagnostic,
  normalizeCompileError,
  suggestMatch,
  suggestProp,
} from './diagnostics.js';
import type {
  ComponentSpec,
  FrameworkId,
  FrontmatterField,
  FrontmatterSchema,
  PropSpec,
} from './registry.js';
import {
  findComponent,
  getFrontmatterSchema,
  isCompoundChild,
  isIntrinsicTag,
} from './registry.js';

// lowercase-start JSX member expressions (Tabs.Tab) have their "name"
// encoded with a dot. the owner identifier is the segment before the dot.
function rootIdentifier(name: string): string {
  return name.split('.')[0];
}

export interface LintResult {
  frontmatter: Record<string, unknown>;
  content: string;
  diagnostics: Diagnostic[];
  // populated when remark can't parse the source at all
  fatal?: Diagnostic;
}

interface Position {
  line?: number;
  column?: number;
}

interface JsxAttributeNode {
  type: 'mdxJsxAttribute' | 'mdxJsxExpressionAttribute';
  name?: string;
  value?:
    | string
    | null
    | {
        type: string;
        value?: string;
        data?: { estree?: unknown };
      };
}

interface JsxElementNode {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: JsxAttributeNode[];
  children?: unknown[];
  position?: {
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
}

function nodePosition(node: JsxElementNode): Position {
  const start = node.position?.start;
  return { line: start?.line, column: start?.column };
}

// build a lookup from attribute name -> node so we can iterate both
// the declared attrs (for type checks) and the required props (for missing)
function attributesByName(node: JsxElementNode): Map<string, JsxAttributeNode> {
  const map = new Map<string, JsxAttributeNode>();
  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute' && typeof attr.name === 'string') {
      map.set(attr.name, attr);
    }
  }
  return map;
}

// attribute value shape -> resolvable string for enum checks. expressions
// ({foo}) aren't statically analyzable — skip enum validation in that case.
function literalStringValue(attr: JsxAttributeNode): string | undefined {
  const value = attr.value;
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value.type === 'mdxJsxAttributeValueExpression') {
    // {'danger'} style — check if the expression is a single string literal.
    // for anything more complex we silently give up (runtime decides).
    const raw = value.value ?? '';
    const m = /^\s*['"`]([^'"`]*)['"`]\s*$/.exec(raw);
    return m?.[1];
  }
  return undefined;
}

function isBooleanAttribute(attr: JsxAttributeNode): boolean {
  // JSX boolean shorthand `<Foo bar />` surfaces as value === null.
  return attr.value === null;
}

function expressionValue(attr: JsxAttributeNode): string | undefined {
  const value = attr.value;
  if (value && typeof value === 'object' && 'type' in value) {
    if (value.type === 'mdxJsxAttributeValueExpression') {
      return typeof value.value === 'string' ? value.value : undefined;
    }
  }
  return undefined;
}

function validatePropValue(
  attr: JsxAttributeNode,
  prop: PropSpec,
  componentName: string,
  position: Position
): Diagnostic | undefined {
  // boolean shorthand is always valid for boolean props, invalid for others
  if (isBooleanAttribute(attr)) {
    if (prop.type === 'boolean' || prop.type === 'node') {
      return undefined;
    }
    return {
      kind: 'invalid-prop-value',
      severity: 'warning',
      message: `Prop "${prop.name}" on <${componentName}> expects ${prop.type}, got boolean shorthand.`,
      component: componentName,
      prop: prop.name,
      line: position.line,
      column: position.column,
    };
  }

  // enum validation — only when we can read a literal string
  if (prop.type === 'enum' && prop.values) {
    const literal = literalStringValue(attr);
    if (literal === undefined) {
      return undefined;
    }
    const aliased = prop.valueAliases?.[literal];
    if (aliased !== undefined) {
      return {
        kind: 'deprecated-alias',
        severity: 'warning',
        message: `Value "${literal}" for prop "${prop.name}" is an alias for "${aliased}".`,
        component: componentName,
        prop: prop.name,
        line: position.line,
        column: position.column,
        suggestion: aliased,
      };
    }
    if (!prop.values.includes(literal)) {
      return {
        kind: 'invalid-prop-value',
        severity: 'warning',
        message: `Value "${literal}" is not valid for prop "${prop.name}" on <${componentName}>. Expected one of: ${prop.values.join(', ')}.`,
        component: componentName,
        prop: prop.name,
        line: position.line,
        column: position.column,
        suggestion: suggestMatch(literal, prop.values) ?? prop.values[0],
      };
    }
    return undefined;
  }

  // numeric props written as strings — only warn when the string can't be
  // coerced. valid numeric strings (width="100") are widely accepted by
  // shims & flagging them produced noise on every Next.js Image render.
  if (prop.type === 'number' && typeof attr.value === 'string') {
    if (Number.isNaN(Number(attr.value))) {
      return {
        kind: 'invalid-prop-value',
        severity: 'warning',
        message: `Prop "${prop.name}" on <${componentName}> expects a number; got "${attr.value}".`,
        component: componentName,
        prop: prop.name,
        line: position.line,
        column: position.column,
      };
    }
  }

  if (prop.type === 'boolean') {
    const expr = expressionValue(attr);
    if (
      expr !== undefined &&
      expr.trim() !== 'true' &&
      expr.trim() !== 'false'
    ) {
      return {
        kind: 'invalid-prop-value',
        severity: 'warning',
        message: `Prop "${prop.name}" on <${componentName}> expects a boolean expression.`,
        component: componentName,
        prop: prop.name,
        line: position.line,
        column: position.column,
      };
    }
  }

  if (prop.deprecated) {
    return {
      kind: 'deprecated-alias',
      severity: 'warning',
      message: `Prop "${prop.name}" on <${componentName}> is deprecated${
        prop.deprecatedIn ? ` in ${prop.deprecatedIn}` : ''
      }.`,
      component: componentName,
      prop: prop.name,
      line: position.line,
      column: position.column,
    };
  }

  return undefined;
}

function lintComponent(
  node: JsxElementNode,
  spec: ComponentSpec,
  effectiveName: string
): Diagnostic[] {
  const position = nodePosition(node);
  const attrs = attributesByName(node);
  const out: Diagnostic[] = [];

  // unknown props
  const known = new Set(spec.props.map((p) => p.name));
  for (const [name, attr] of attrs) {
    if (known.has(name)) {
      continue;
    }
    // `className` / `style` / `id` / `data-*` / `aria-*` / event handlers
    // are universally permissible even if not declared.
    if (isUniversallyAllowedProp(name)) {
      continue;
    }
    // expression attributes (<Foo {...rest}/>) bail out early — can't validate
    if (attr.type === 'mdxJsxExpressionAttribute') {
      continue;
    }
    out.push({
      kind: 'invalid-prop',
      severity: 'warning',
      message: `Unknown prop "${name}" on <${effectiveName}>.`,
      component: effectiveName,
      prop: name,
      line: position.line,
      column: position.column,
      suggestion: suggestProp(name, spec),
    });
  }

  // missing required props
  for (const prop of spec.props) {
    if (!prop.required) {
      continue;
    }
    if (!attrs.has(prop.name)) {
      out.push({
        kind: 'missing-required-prop',
        severity: 'warning',
        message: `Required prop "${prop.name}" is missing on <${effectiveName}>.`,
        component: effectiveName,
        prop: prop.name,
        line: position.line,
        column: position.column,
      });
    }
  }

  // per-prop value checks
  for (const prop of spec.props) {
    const attr = attrs.get(prop.name);
    if (!attr) {
      continue;
    }
    const diag = validatePropValue(attr, prop, effectiveName, position);
    if (diag) {
      out.push(diag);
    }
  }

  return out;
}

const UNIVERSAL_ATTR_PREFIXES = ['data-', 'aria-', 'on'];
const UNIVERSAL_ATTRS = new Set([
  'className',
  'class',
  'style',
  'id',
  'key',
  'ref',
  'title',
  'role',
  'tabIndex',
  'hidden',
  'lang',
  'dir',
  'draggable',
  'contentEditable',
]);

function isUniversallyAllowedProp(name: string): boolean {
  if (UNIVERSAL_ATTRS.has(name)) {
    return true;
  }
  for (const prefix of UNIVERSAL_ATTR_PREFIXES) {
    if (name.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function lintJsxElement(
  node: JsxElementNode,
  framework: FrameworkId
): Diagnostic[] {
  const name = node.name;
  if (!name) {
    // fragment <>...</> — nothing to check
    return [];
  }
  if (isIntrinsicTag(name)) {
    return [];
  }
  if (isCompoundChild(name)) {
    // Tabs.Tab etc. — look up parent component; if parent exists, accept child
    const parent = rootIdentifier(name);
    if (findComponent(framework, parent)) {
      return [];
    }
    return [
      buildUnknownComponentDiagnostic(parent, framework, nodePosition(node)),
    ];
  }

  const spec = findComponent(framework, name);
  if (!spec) {
    return [
      buildUnknownComponentDiagnostic(name, framework, nodePosition(node)),
    ];
  }
  return lintComponent(node, spec, name);
}

// --- frontmatter lint -------------------------------------------------------

function typeOfFrontmatterValue(value: unknown): FrontmatterField['type'] {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'object';
  }
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return t as FrontmatterField['type'];
  }
  return 'object';
}

export function lintFrontmatter(
  frontmatter: Record<string, unknown>,
  framework: FrameworkId
): Diagnostic[] {
  const schema = getFrontmatterSchema(framework);
  const fieldsByName = new Map(schema.fields.map((f) => [f.name, f]));
  const out: Diagnostic[] = [];

  // required-missing checks upgrade to errors (callers decide whether to fail)
  for (const field of schema.fields) {
    if (field.required && !(field.name in frontmatter)) {
      out.push(buildMissingFrontmatterDiagnostic(field.name, framework));
    }
  }

  for (const [name, value] of Object.entries(frontmatter)) {
    const field = fieldsByName.get(name);
    if (!field) {
      if (schema.allowUnknown === false) {
        out.push({
          kind: 'unknown-frontmatter',
          severity: 'warning',
          message: `Unknown frontmatter field "${name}" for framework "${framework}".`,
          field: name,
          suggestion: suggestMatch(
            name,
            schema.fields.map((f) => f.name)
          ),
        });
      }
      continue;
    }
    const actual = typeOfFrontmatterValue(value);
    if (actual !== field.type) {
      out.push({
        kind: 'invalid-frontmatter-type',
        severity: 'warning',
        message: `Frontmatter field "${name}" should be ${field.type}, got ${actual}.`,
        field: name,
      });
      continue;
    }
    if (
      field.values &&
      typeof value === 'string' &&
      !field.values.includes(value)
    ) {
      out.push({
        kind: 'invalid-frontmatter-type',
        severity: 'warning',
        message: `Frontmatter field "${name}" value "${value}" is not one of ${field.values.join(', ')}.`,
        field: name,
        suggestion: suggestMatch(value, field.values),
      });
    }
  }

  return out;
}

// --- main entry point -------------------------------------------------------

export async function lintMdxSource(
  source: string,
  framework: FrameworkId
): Promise<LintResult> {
  // frontmatter first — if gray-matter blows up on the YAML block we still
  // want to try parsing the MDX body.
  let frontmatter: Record<string, unknown> = {};
  let content = source;
  try {
    const parsed = matter(source);
    frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
    content = parsed.content;
  } catch (err) {
    return {
      frontmatter: {},
      content: source,
      diagnostics: [],
      fatal: {
        kind: 'mdx-syntax',
        severity: 'error',
        message: `frontmatter parse failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  const frontmatterDiagnostics = lintFrontmatter(frontmatter, framework);

  // parse MDX. we don't need rehype / stringify for lint — just the raw AST.
  let tree: Root;
  try {
    const processor = unified().use(remarkParse).use(remarkMdx);
    tree = processor.parse(content) as Root;
  } catch (err) {
    const diagnostic = normalizeCompileError(err, { source, framework });
    return {
      frontmatter,
      content,
      diagnostics: frontmatterDiagnostics,
      fatal: diagnostic,
    };
  }

  const componentDiagnostics: Diagnostic[] = [];
  visit(tree, (node) => {
    if (
      node.type === 'mdxJsxFlowElement' ||
      node.type === 'mdxJsxTextElement'
    ) {
      const diags = lintJsxElement(
        node as unknown as JsxElementNode,
        framework
      );
      componentDiagnostics.push(...diags);
    }
  });

  return {
    frontmatter,
    content,
    diagnostics: [...frontmatterDiagnostics, ...componentDiagnostics],
  };
}
