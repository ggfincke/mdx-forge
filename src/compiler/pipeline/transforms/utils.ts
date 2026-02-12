// src/compiler/pipeline/transforms/utils.ts
// shared utilities for Safe Mode component transforms

import type { RootContent } from 'mdast';
import type { MdxJsxElement, NodeConfig, TransformNode } from '../../types';

// extract a static string prop from an MDX JSX element
// only processes string literal values; expression values are ignored
export function getStaticStringProp(
  node: MdxJsxElement,
  propName: string
): string | undefined {
  const attr = node.attributes.find(
    (a) => a.type === 'mdxJsxAttribute' && a.name === propName
  );
  if (!attr) {
    return undefined;
  }
  if (typeof attr.value === 'string') {
    return attr.value;
  }
  return undefined;
}

// extract a static boolean prop from an MDX JSX element
// support boolean shorthand (e.g., `<Comp open />` = true)
// only processes literal values; expression values are ignored
export function getStaticBooleanProp(
  node: MdxJsxElement,
  propName: string
): boolean | undefined {
  const attr = node.attributes.find(
    (a) => a.type === 'mdxJsxAttribute' && a.name === propName
  );
  if (!attr) {
    return undefined;
  }
  // boolean shorthand
  if (attr.value === null) {
    return true;
  }
  if (typeof attr.value === 'string') {
    if (attr.value === 'true') {
      return true;
    }
    if (attr.value === 'false') {
      return false;
    }
  }
  return undefined;
}

// escape HTML special characters to prevent XSS
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// create an MDAST/rehype node w/ proper structure for HTML rendering
export function createNode(config: NodeConfig): TransformNode {
  return {
    type: config.type,
    data: {
      hName: config.hName,
      hProperties: {
        className: Array.isArray(config.className)
          ? config.className
          : [config.className],
        ...config.additionalProps,
      },
    },
    children: config.children,
  };
}

// create an HTML notice div for features that require Trusted Mode
export function createTrustedModeNotice(
  className: string,
  message: string
): RootContent {
  return {
    type: 'html',
    value: `<div class="${className}">${message}</div>`,
  } as RootContent;
}

// type guard to check if a node is an MDX JSX element
export function isMdxJsxElement(node: unknown): node is MdxJsxElement {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    ((node as { type: string }).type === 'mdxJsxFlowElement' ||
      (node as { type: string }).type === 'mdxJsxTextElement')
  );
}
