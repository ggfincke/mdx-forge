// src/diagnostics/analyze/parse.ts
// remark/remark-mdx parse + import & JSX-element collection (positions file-relative)

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Position } from 'unist';
import type {
  ClassDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  Pattern,
  Program,
  VariableDeclaration,
} from 'estree';
import type { DiagnosticRange } from '../types';

export interface DetectedComponent {
  name: string;
  range: DiagnosticRange;
}

export interface ParsedMdx {
  imports: Set<string>;
  components: DetectedComponent[];
}

const parser = unified().use(remarkParse).use(remarkMdx);

const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const HTML_ELEMENTS = new Set([
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
]);

interface MdxEsmNode {
  data?: { estree?: Program };
}

interface MdxJsxNode {
  name: string | null;
  position?: Position;
}

export function parseMdxForAnalysis(
  content: string,
  bodyStartLine: number,
  bodyStartColumn = 1
): ParsedMdx {
  const tree = parser.parse(content) as Root;
  const lineOffset = bodyStartLine - 1;

  const imports = new Set<string>();
  visit(tree, 'mdxjsEsm', (node) => {
    const estree = (node as MdxEsmNode).data?.estree;
    if (!estree) {
      return;
    }
    collectLocalBindings(estree, imports);
  });

  const components: DetectedComponent[] = [];
  visit(tree, (node) => {
    if (
      node.type !== 'mdxJsxFlowElement' &&
      node.type !== 'mdxJsxTextElement'
    ) {
      return;
    }
    const jsx = node as MdxJsxNode;
    if (
      !jsx.name ||
      !PASCAL_CASE.test(jsx.name) ||
      isHtmlElement(jsx.name) ||
      !jsx.position
    ) {
      return;
    }
    components.push({
      name: jsx.name,
      range: toRange(jsx.position, lineOffset, bodyStartColumn),
    });
  });

  return { imports, components };
}

function collectLocalBindings(program: Program, bindings: Set<string>): void {
  for (const stmt of program.body) {
    if (stmt.type === 'ImportDeclaration') {
      collectImportBindings(stmt, bindings);
      continue;
    }
    if (stmt.type === 'ExportNamedDeclaration') {
      collectExportBindings(stmt, bindings);
    }
  }
}

function collectImportBindings(
  stmt: ImportDeclaration,
  bindings: Set<string>
): void {
  for (const spec of stmt.specifiers) {
    bindings.add(spec.local.name);
  }
}

function collectExportBindings(
  stmt: ExportNamedDeclaration,
  bindings: Set<string>
): void {
  if (stmt.declaration) {
    collectDeclarationBindings(stmt.declaration, bindings);
    return;
  }
  if (stmt.source) {
    return;
  }
  for (const spec of stmt.specifiers) {
    if (isIdentifier(spec.local)) {
      bindings.add(spec.local.name);
    }
  }
}

function collectDeclarationBindings(
  declaration: ExportNamedDeclaration['declaration'],
  bindings: Set<string>
): void {
  if (!declaration) {
    return;
  }
  if (declaration.type === 'VariableDeclaration') {
    collectVariableBindings(declaration, bindings);
    return;
  }
  if (isNamedDeclaration(declaration)) {
    bindings.add(declaration.id.name);
  }
}

function collectVariableBindings(
  declaration: VariableDeclaration,
  bindings: Set<string>
): void {
  for (const variable of declaration.declarations) {
    collectPatternBindings(variable.id, bindings);
  }
}

function collectPatternBindings(pattern: Pattern, bindings: Set<string>): void {
  if (pattern.type === 'Identifier') {
    bindings.add(pattern.name);
  }
}

function isNamedDeclaration(
  declaration: ExportNamedDeclaration['declaration']
): declaration is FunctionDeclaration | ClassDeclaration {
  return (
    (declaration?.type === 'FunctionDeclaration' ||
      declaration?.type === 'ClassDeclaration') &&
    isIdentifier(declaration.id)
  );
}

function isIdentifier(node: unknown): node is Identifier {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'Identifier' &&
    'name' in node &&
    typeof node.name === 'string'
  );
}

function isHtmlElement(name: string): boolean {
  return HTML_ELEMENTS.has(name.toLowerCase());
}

function toRange(
  position: Position,
  lineOffset: number,
  bodyStartColumn: number
): DiagnosticRange {
  const startColumn =
    position.start.line === 1
      ? position.start.column + bodyStartColumn - 1
      : position.start.column;
  const endColumn =
    position.end.line === 1
      ? position.end.column + bodyStartColumn - 1
      : position.end.column;
  return {
    start: {
      line: position.start.line + lineOffset,
      column: startColumn,
    },
    end: {
      line: position.end.line + lineOffset,
      column: endColumn,
    },
  };
}
