// src/compiler/pipeline/transforms/callout.ts
// transform Callout/Alert/Admonition components to semantic HTML

import type { RootContent } from 'mdast'
import type { MdxJsxElement } from '../../types'
import { getStaticStringProp, createCalloutCard } from './utils'
import {
  type CalloutType,
  type CalloutStyleConfig,
  normalizeCalloutType,
  buildCalloutStyleMap,
} from '../../../internal/callout'
import {
  SAFE_CALLOUT,
  SAFE_CALLOUT_NOTE,
  SAFE_CALLOUT_INFO,
  SAFE_CALLOUT_TIP,
  SAFE_CALLOUT_WARNING,
  SAFE_CALLOUT_CAUTION,
  SAFE_CALLOUT_DANGER,
  SAFE_CALLOUT_IMPORTANT,
  SAFE_CALLOUT_SUMMARY,
  SAFE_CALLOUT_HINT,
  SAFE_CALLOUT_SUCCESS,
  SAFE_CALLOUT_QUESTION,
  SAFE_CALLOUT_FAILURE,
  SAFE_CALLOUT_BUG,
  SAFE_CALLOUT_EXAMPLE,
  SAFE_CALLOUT_QUOTE,
  SAFE_CALLOUT_TODO,
  SAFE_CALLOUT_ATTENTION,
  SAFE_CALLOUT_HEADER,
  SAFE_CALLOUT_ICON,
  SAFE_CALLOUT_CONTENT,
} from '../../internal/css-classes'

// re-export for consumers that import from this file
export {
  type CalloutType,
  normalizeCalloutType,
} from '../../../internal/callout'

// CSS class lookup for Safe Mode callout types
const SAFE_CALLOUT_CLASSES: Record<CalloutType, string> = {
  note: SAFE_CALLOUT_NOTE,
  info: SAFE_CALLOUT_INFO,
  tip: SAFE_CALLOUT_TIP,
  warning: SAFE_CALLOUT_WARNING,
  caution: SAFE_CALLOUT_CAUTION,
  danger: SAFE_CALLOUT_DANGER,
  important: SAFE_CALLOUT_IMPORTANT,
  summary: SAFE_CALLOUT_SUMMARY,
  hint: SAFE_CALLOUT_HINT,
  success: SAFE_CALLOUT_SUCCESS,
  question: SAFE_CALLOUT_QUESTION,
  failure: SAFE_CALLOUT_FAILURE,
  bug: SAFE_CALLOUT_BUG,
  example: SAFE_CALLOUT_EXAMPLE,
  quote: SAFE_CALLOUT_QUOTE,
  todo: SAFE_CALLOUT_TODO,
  attention: SAFE_CALLOUT_ATTENTION,
}

// callout defaults w/ icons & CSS class names for Safe Mode HTML rendering
export const CALLOUT_DEFAULTS: Record<CalloutType, CalloutStyleConfig> =
  buildCalloutStyleMap((type) => SAFE_CALLOUT_CLASSES[type])

// transform Callout/Alert/Admonition component to semantic HTML
export function transformCallout(node: MdxJsxElement): RootContent
{
  const typeStr = getStaticStringProp(node, 'type')
  const calloutType = normalizeCalloutType(typeStr)
  const config = CALLOUT_DEFAULTS[calloutType]
  const title = getStaticStringProp(node, 'title') || config.label

  return createCalloutCard({
    outerType: 'callout',
    wrapperTag: 'aside',
    outerClassNames: [SAFE_CALLOUT, config.className],
    additionalProps: { 'data-callout-type': calloutType },
    headerType: 'calloutHeader',
    headerTag: 'div',
    headerClassName: SAFE_CALLOUT_HEADER,
    headerMode: 'split-icon-text',
    iconClassName: SAFE_CALLOUT_ICON,
    icon: config.icon,
    title,
    contentType: 'calloutContent',
    contentClassName: SAFE_CALLOUT_CONTENT,
    contentChildren: node.children as RootContent[],
  })
}
