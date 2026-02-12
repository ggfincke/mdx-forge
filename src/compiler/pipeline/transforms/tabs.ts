// src/compiler/pipeline/transforms/tabs.ts
// transform Tabs/TabItem/Tab components to semantic HTML

import type { RootContent } from 'mdast';
import type { MdxJsxElement } from '../../types';
import {
  getStaticStringProp,
  escapeHtml,
  createNode,
  createTrustedModeNotice,
} from './utils';
import {
  SAFE_TABS,
  SAFE_TABS_NOTICE,
  SAFE_TABS_CONTENT,
  SAFE_TAB_PANEL,
  SAFE_TAB_PANEL_HEADER,
  SAFE_TAB_PANEL_CONTENT,
} from '../../internal/css-classes';

// transform Tabs container component to semantic HTML (non-interactive in Safe Mode)
export function transformTabs(node: MdxJsxElement): RootContent {
  return createNode({
    type: 'tabs',
    hName: 'div',
    className: SAFE_TABS,
    children: [
      createTrustedModeNotice(
        SAFE_TABS_NOTICE,
        'Tab content (interactive tabs require Trusted Mode)'
      ),
      createNode({
        type: 'tabsContent',
        hName: 'div',
        className: SAFE_TABS_CONTENT,
        children: node.children,
      }),
    ],
  });
}

// transform TabItem/Tab component to semantic HTML
export function transformTabItem(node: MdxJsxElement): RootContent {
  const label =
    getStaticStringProp(node, 'label') ||
    getStaticStringProp(node, 'value') ||
    'Tab';

  return createNode({
    type: 'tabItem',
    hName: 'div',
    className: SAFE_TAB_PANEL,
    children: [
      createNode({
        type: 'tabItemHeader',
        hName: 'div',
        className: SAFE_TAB_PANEL_HEADER,
        children: [{ type: 'text', value: escapeHtml(label) }],
      }),
      createNode({
        type: 'tabItemContent',
        hName: 'div',
        className: SAFE_TAB_PANEL_CONTENT,
        children: node.children,
      }),
    ],
  });
}
