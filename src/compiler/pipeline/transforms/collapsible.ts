// src/compiler/pipeline/transforms/collapsible.ts
// transform Collapsible/Accordion/Details components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';
import {
  getStaticStringProp,
  getStaticBooleanProp,
  escapeHtml,
  createNode,
} from './utils';
import {
  SAFE_COLLAPSIBLE,
  SAFE_COLLAPSIBLE_SUMMARY,
  SAFE_COLLAPSIBLE_CONTENT,
} from '../../internal/css-classes';

// transform Collapsible/Accordion/Details component to semantic HTML
export function transformCollapsible(node: MdxJsxElement): RootContent {
  const title =
    getStaticStringProp(node, 'title') ||
    getStaticStringProp(node, 'summary') ||
    'Details';
  const defaultOpen = getStaticBooleanProp(node, 'defaultOpen') || false;

  return createNode({
    type: 'collapsible',
    hName: 'details',
    className: SAFE_COLLAPSIBLE,
    additionalProps: defaultOpen ? { open: true } : {},
    children: [
      createNode({
        type: 'collapsibleSummary',
        hName: 'summary',
        className: SAFE_COLLAPSIBLE_SUMMARY,
        children: [{ type: 'text', value: escapeHtml(title) }],
      }),
      createNode({
        type: 'collapsibleContent',
        hName: 'div',
        className: SAFE_COLLAPSIBLE_CONTENT,
        children: node.children,
      }),
    ],
  });
}
