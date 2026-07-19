// src/compiler/pipeline/transforms/utils.ts
// shared utilities for Safe Mode component transforms

import type { RootContent } from 'mdast';
import type { Properties } from 'hast';
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
// support boolean shorthand (e.g., `<Comp open />` = true) & the literal
// expression forms {true}/{false}; other expressions are ignored
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
    return undefined;
  }
  // literal boolean expressions match the React runtime contract
  if (attr.value && typeof attr.value === 'object') {
    const expression = attr.value.value?.trim();
    if (expression === 'true') {
      return true;
    }
    if (expression === 'false') {
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

// how the card header renders its icon + title
// split-icon-text: <span class=icon>icon</span> + text node (callout/admonition)
// combined-html: single raw `icon<span>title</span>` string (github alert)
export type HeaderMode = 'split-icon-text' | 'combined-html';

// params for the shared callout/admonition/alert card scaffold
export interface CalloutCardConfig {
  outerType: string;
  wrapperTag: string;
  outerClassNames: string[];
  additionalProps?: Properties;
  headerType: string;
  headerTag: string;
  headerClassName: string;
  headerMode: HeaderMode;
  iconClassName?: string;
  icon: string;
  title: string;
  contentType: string;
  contentClassName: string;
  contentChildren: RootContent[];
}

// build header children for the requested header mode
function buildCardHeaderChildren(config: CalloutCardConfig): RootContent[] {
  if (config.headerMode === 'combined-html') {
    return [
      {
        type: 'html',
        value: `${config.icon}<span>${config.title}</span>`,
      } as RootContent,
    ];
  }
  // title is a hast text node escaped at the HTML sink; never pre-escape
  return [
    {
      type: 'html',
      value: `<span class="${config.iconClassName}">${config.icon}</span>`,
    } as RootContent,
    { type: 'text', value: config.title } as RootContent,
  ];
}

// shared scaffold for callout/admonition/github-alert cards
// callers parameterize the divergent tags, classes, header shape & escaping
export function createCalloutCard(config: CalloutCardConfig): TransformNode {
  return createNode({
    type: config.outerType,
    hName: config.wrapperTag,
    className: config.outerClassNames,
    additionalProps: config.additionalProps,
    children: [
      createNode({
        type: config.headerType,
        hName: config.headerTag,
        className: config.headerClassName,
        children: buildCardHeaderChildren(config),
      }),
      createNode({
        type: config.contentType,
        hName: 'div',
        className: config.contentClassName,
        children: config.contentChildren,
      }),
    ],
  });
}
