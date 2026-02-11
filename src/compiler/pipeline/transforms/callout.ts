// src/compiler/pipeline/transforms/callout.ts
// transform Callout/Alert/Admonition components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';
import { getStaticStringProp, escapeHtml, createNode } from './utils';
import { CALLOUT_ICONS } from '../../../internal/icons';
import {
  type CalloutType,
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
export const CALLOUT_DEFAULTS: Record<
  CalloutType,
  { label: string; className: string; icon: string }
> = {
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
