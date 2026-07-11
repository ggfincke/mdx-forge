// plugins/render/src/lint.ts
// MDX AST lint pass for JSX props & frontmatter diagnostics

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
import { normalizeFrontmatterData } from './frontmatter-bounds.js';
import {
  fromCoreDiagnostic,
  loadCoreEngine,
  type CoreAnalyzeEngine,
} from './core-engine.js';

// get owner id from lowercase-start JSX member names like Tabs.Tab
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

// index attributes by name for declared-prop & required-prop passes
function attributesByName(node: JsxElementNode): Map<string, JsxAttributeNode> {
  const map = new Map<string, JsxAttributeNode>();
  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute' && typeof attr.name === 'string') {
      map.set(attr.name, attr);
    }
  }
  return map;
}

// resolve static string values for enum checks; skip dynamic expressions
function literalStringValue(attr: JsxAttributeNode): string | undefined {
  const value = attr.value;
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value.type === 'mdxJsxAttributeValueExpression') {
    // read {'danger'} expressions as static string literals
    // skip complex expressions so runtime owns final behavior
    const raw = value.value ?? '';
    const m = /^\s*['"`]([^'"`]*)['"`]\s*$/.exec(raw);
    return m?.[1];
  }
  return undefined;
}

function isBooleanAttribute(attr: JsxAttributeNode): boolean {
  // JSX boolean shorthand `<Foo bar />` surfaces as value === null
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

  // warn only when numeric string props cannot be coerced
  // avoid noise for common width="100" style shim props
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
    // permit standard DOM escape-hatch props even when undeclared
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

// frozen processor reused across calls; parse() is stateless
const mdxProcessor = unified().use(remarkParse).use(remarkMdx).freeze();

// bounded parse: neutralize the eval engine & clamp the parsed graph so cyclic
// or amplified YAML aliases can't reach downstream JSON.stringify (F22)
function safeMatter(source: string) {
  const parsed = matter(source, {
    engines: {
      javascript: () => ({}),
    },
  });
  parsed.data = normalizeFrontmatterData(
    parsed.data as Record<string, unknown>
  );
  return parsed;
}

function frontmatterFatal(err: unknown): Diagnostic {
  return {
    kind: 'mdx-syntax',
    severity: 'error',
    message: `frontmatter parse failed: ${err instanceof Error ? err.message : String(err)}`,
  };
}

// unified path: one core parse feeds component, member & prop rules w/
// file-relative positions; frontmatter schema lint stays plugin-owned
function lintWithCoreEngine(
  engine: CoreAnalyzeEngine,
  source: string,
  framework: FrameworkId
): LintResult {
  const result = engine.analyzeMdxDocument(source, { framework });
  if (result.parseError?.phase === 'frontmatter') {
    return {
      frontmatter: {},
      content: source,
      diagnostics: [],
      fatal: frontmatterFatal(result.parseError.error),
    };
  }
  const frontmatter = result.frontmatter;
  const content = result.content;
  const frontmatterDiagnostics = lintFrontmatter(frontmatter, framework);
  if (result.parseError) {
    return {
      frontmatter,
      content,
      diagnostics: frontmatterDiagnostics,
      fatal: normalizeCompileError(result.parseError.error, {
        source,
        framework,
      }),
    };
  }
  const componentDiagnostics: Diagnostic[] = [];
  for (const diag of result.diagnostics) {
    const mapped = fromCoreDiagnostic(diag, framework);
    if (mapped) {
      componentDiagnostics.push(mapped);
    }
  }
  return {
    frontmatter,
    content,
    diagnostics: [...frontmatterDiagnostics, ...componentDiagnostics],
  };
}

export async function lintMdxSource(
  source: string,
  framework: FrameworkId
): Promise<LintResult> {
  const engine = await loadCoreEngine();
  if (engine) {
    return lintWithCoreEngine(engine, source, framework);
  }
  return lintLegacyMdxSource(source, framework);
}

// legacy path for the locked minimum core (0.6.2, no analyze subpath)
// body reparse + kind-based walk; positions stay body-relative
async function lintLegacyMdxSource(
  source: string,
  framework: FrameworkId
): Promise<LintResult> {
  // parse frontmatter first; keep body parse attempt after YAML failure
  let frontmatter: Record<string, unknown> = {};
  let content = source;
  try {
    const parsed = safeMatter(source);
    frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
    content = parsed.content;
  } catch (err) {
    return {
      frontmatter: {},
      content: source,
      diagnostics: [],
      fatal: frontmatterFatal(err),
    };
  }

  const frontmatterDiagnostics = lintFrontmatter(frontmatter, framework);

  // parse raw MDX AST for lint without rehype or stringify
  let tree: Root;
  try {
    tree = mdxProcessor.parse(content) as Root;
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
