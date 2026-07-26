// src/compiler/pipeline/transforms/collapsible.ts
// transform Collapsible/Accordion/Details components to semantic HTML

import type { RootContent } from 'mdast'
import type { MdxJsxElement } from '../../types'
import { getStaticStringProp, getStaticBooleanProp, createNode } from './utils'
import {
  SAFE_COLLAPSIBLE,
  SAFE_COLLAPSIBLE_SUMMARY,
  SAFE_COLLAPSIBLE_CONTENT,
} from '../../internal/css-classes'

// transform Collapsible/Accordion/Details component to semantic HTML
// canonical contract (matches the React shim): summary takes precedence
// over title & `open ?? defaultOpen` resolves the initial open state
export function transformCollapsible(node: MdxJsxElement): RootContent
{
  const title =
    getStaticStringProp(node, 'summary') ??
    getStaticStringProp(node, 'title') ??
    'Details'
  const open =
    getStaticBooleanProp(node, 'open') ??
    getStaticBooleanProp(node, 'defaultOpen') ??
    false

  return createNode({
    type: 'collapsible',
    hName: 'details',
    className: SAFE_COLLAPSIBLE,
    additionalProps: open ? { open: true } : {},
    children: [
      createNode({
        type: 'collapsibleSummary',
        hName: 'summary',
        className: SAFE_COLLAPSIBLE_SUMMARY,
        // text nodes are escaped at the HTML sink; never pre-escape here
        children: [{ type: 'text', value: title }],
      }),
      createNode({
        type: 'collapsibleContent',
        hName: 'div',
        className: SAFE_COLLAPSIBLE_CONTENT,
        children: node.children,
      }),
    ],
  })
}
