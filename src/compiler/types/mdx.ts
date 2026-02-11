// src/compiler/types/mdx.ts
// type definitions for MDX AST transforms

import type { RootContent, BlockContent, PhrasingContent } from 'mdast';
import type { Properties } from 'hast';

// MDX JSX attribute node
export interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value: string | { type: string; value: string } | null;
}

// MDX JSX element node (flow or text)
export interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: Array<BlockContent | PhrasingContent>;
  // optional position for diagnostics & IDE features
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

// configuration for creating AST nodes
export interface NodeConfig {
  type: string;
  hName: string;
  className: string | string[];
  children: RootContent[];
  additionalProps?: Properties;
}

// AST node created by createNode() for Safe Mode HTML rendering
// uses remark-rehype data.hName/hProperties convention to map to HTML elements
export interface TransformNode {
  type: string;
  data: {
    hName: string;
    hProperties: Properties & { className: string[] };
  };
  children: RootContent[];
}

// register TransformNode as a valid mdast RootContent variant
// allows transform functions to return createNode() results w/o unsafe casts
declare module 'mdast' {
  interface RootContentMap {
    transformNode: TransformNode;
  }
}

// transform function signature for MDX element transforms
export type TransformFunction = (node: MdxJsxElement) => RootContent;

export type { CalloutType } from '../../internal/callout';
