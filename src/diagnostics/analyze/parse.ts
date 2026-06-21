// src/diagnostics/analyze/parse.ts
// remark/remark-mdx parse + import & JSX-element collection (positions file-relative)

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Position } from 'unist';
import type { Program } from 'estree';
import type { DiagnosticRange } from '../types';

export interface DetectedComponent {
  name: string;
  range: DiagnosticRange;
}

export interface ParsedMdx {
  imports: Set<string>;
  components: DetectedComponent[];
}

// reusable stateless parser; same wiring the Safe pipeline uses (no full compile)
const parser = unified().use(remarkParse).use(remarkMdx);

// PascalCase = React component convention; also excludes html & dotted member names
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;

// mdxjsEsm node: estree is attached at parse time by mdast-util-mdxjs-esm
interface MdxEsmNode {
  type: 'mdxjsEsm';
  value: string;
  data?: { estree?: Program };
}

// mdxJsxFlowElement / mdxJsxTextElement carry a tag name & position
interface MdxJsxNode {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  position?: Position;
}

// parse stripped content & shift positions back to original-file ranges
export function parseMdxForAnalysis(
  content: string,
  bodyStartLine: number
): ParsedMdx {
  const tree = parser.parse(content) as Root;
  const lineOffset = bodyStartLine - 1;

  // first pass: collect ESM import binding names from the estree program
  const imports = new Set<string>();
  visit(tree, 'mdxjsEsm', (node) => {
    const estree = (node as unknown as MdxEsmNode).data?.estree;
    if (!estree) {
      return;
    }
    for (const stmt of estree.body) {
      if (stmt.type !== 'ImportDeclaration') {
        continue;
      }
      for (const spec of stmt.specifiers) {
        imports.add(spec.local.name);
      }
    }
  });

  // second pass: collect PascalCase JSX element names w/ file-relative ranges
  const components: DetectedComponent[] = [];
  visit(tree, (node) => {
    if (
      node.type !== 'mdxJsxFlowElement' &&
      node.type !== 'mdxJsxTextElement'
    ) {
      return;
    }
    const jsx = node as unknown as MdxJsxNode;
    if (!jsx.name || !PASCAL_CASE.test(jsx.name) || !jsx.position) {
      return;
    }
    components.push({
      name: jsx.name,
      range: toRange(jsx.position, lineOffset),
    });
  });

  return { imports, components };
}

// convert a 1-based unist position to a 1-based DiagnosticRange
// offset is omitted; the helper only sees stripped content w/o the original index
function toRange(position: Position, lineOffset: number): DiagnosticRange {
  return {
    start: {
      line: position.start.line + lineOffset,
      column: position.start.column,
    },
    end: {
      line: position.end.line + lineOffset,
      column: position.end.column,
    },
  };
}
