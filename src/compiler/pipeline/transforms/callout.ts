// src/compiler/pipeline/transforms/callout.ts
// transform Callout/Alert/Admonition components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';
import { getStaticStringProp, escapeHtml, createNode } from './utils';
import { CALLOUT_ICONS } from '../../../internal/icons';
import {
  type CalloutType,
  type CalloutStyleConfig,
  CALLOUT_TITLES,
  normalizeCalloutType,
} from '../../../internal/callout';
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
} from '../../internal/css-classes';

// re-export for consumers that import from this file
export {
  type CalloutType,
  normalizeCalloutType,
} from '../../../internal/callout';

// callout defaults w/ icons & CSS class names for Safe Mode HTML rendering
export const CALLOUT_DEFAULTS: Record<CalloutType, CalloutStyleConfig> = {
  note: {
    label: CALLOUT_TITLES.note,
    className: SAFE_CALLOUT_NOTE,
    icon: CALLOUT_ICONS.note,
  },
  info: {
    label: CALLOUT_TITLES.info,
    className: SAFE_CALLOUT_INFO,
    icon: CALLOUT_ICONS.info,
  },
  tip: {
    label: CALLOUT_TITLES.tip,
    className: SAFE_CALLOUT_TIP,
    icon: CALLOUT_ICONS.tip,
  },
  warning: {
    label: CALLOUT_TITLES.warning,
    className: SAFE_CALLOUT_WARNING,
    icon: CALLOUT_ICONS.warning,
  },
  caution: {
    label: CALLOUT_TITLES.caution,
    className: SAFE_CALLOUT_CAUTION,
    icon: CALLOUT_ICONS.caution,
  },
  danger: {
    label: CALLOUT_TITLES.danger,
    className: SAFE_CALLOUT_DANGER,
    icon: CALLOUT_ICONS.danger,
  },
  important: {
    label: CALLOUT_TITLES.important,
    className: SAFE_CALLOUT_IMPORTANT,
    icon: CALLOUT_ICONS.important,
  },
  summary: {
    label: CALLOUT_TITLES.summary,
    className: SAFE_CALLOUT_SUMMARY,
    icon: CALLOUT_ICONS.summary,
  },
  hint: {
    label: CALLOUT_TITLES.hint,
    className: SAFE_CALLOUT_HINT,
    icon: CALLOUT_ICONS.hint,
  },
  success: {
    label: CALLOUT_TITLES.success,
    className: SAFE_CALLOUT_SUCCESS,
    icon: CALLOUT_ICONS.success,
  },
  question: {
    label: CALLOUT_TITLES.question,
    className: SAFE_CALLOUT_QUESTION,
    icon: CALLOUT_ICONS.question,
  },
  failure: {
    label: CALLOUT_TITLES.failure,
    className: SAFE_CALLOUT_FAILURE,
    icon: CALLOUT_ICONS.failure,
  },
  bug: {
    label: CALLOUT_TITLES.bug,
    className: SAFE_CALLOUT_BUG,
    icon: CALLOUT_ICONS.bug,
  },
  example: {
    label: CALLOUT_TITLES.example,
    className: SAFE_CALLOUT_EXAMPLE,
    icon: CALLOUT_ICONS.example,
  },
  quote: {
    label: CALLOUT_TITLES.quote,
    className: SAFE_CALLOUT_QUOTE,
    icon: CALLOUT_ICONS.quote,
  },
  todo: {
    label: CALLOUT_TITLES.todo,
    className: SAFE_CALLOUT_TODO,
    icon: CALLOUT_ICONS.todo,
  },
  attention: {
    label: CALLOUT_TITLES.attention,
    className: SAFE_CALLOUT_ATTENTION,
    icon: CALLOUT_ICONS.attention,
  },
};

// transform Callout/Alert/Admonition component to semantic HTML
export function transformCallout(node: MdxJsxElement): RootContent {
  const typeStr = getStaticStringProp(node, 'type');
  const calloutType = normalizeCalloutType(typeStr);
  const config = CALLOUT_DEFAULTS[calloutType];
  const title = getStaticStringProp(node, 'title') || config.label;

  return createNode({
    type: 'callout',
    hName: 'aside',
    className: [SAFE_CALLOUT, config.className],
    additionalProps: { 'data-callout-type': calloutType },
    children: [
      createNode({
        type: 'calloutHeader',
        hName: 'div',
        className: SAFE_CALLOUT_HEADER,
        children: [
          {
            type: 'html',
            value: `<span class="${SAFE_CALLOUT_ICON}">${config.icon}</span>`,
          },
          { type: 'text', value: escapeHtml(title) },
        ],
      }),
      createNode({
        type: 'calloutContent',
        hName: 'div',
        className: SAFE_CALLOUT_CONTENT,
        children: node.children,
      }),
    ],
  });
}
