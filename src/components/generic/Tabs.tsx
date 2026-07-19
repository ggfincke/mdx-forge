// src/components/generic/Tabs.tsx
// generic Tabs component shim for MDX Preview
// provide preview-compatible tabs w/o framework dependency

import { createTabs, type BaseTabsProps, type TabDefinition } from '../base';

// generic surface: groupId sync/persistence (no queryString/syncKey)
export type TabsProps = Omit<BaseTabsProps, 'syncKey' | 'queryString'>;
export type { TabDefinition };

// create generic tabs using the factory
// use 'mdx-preview-generic-tabs' class prefix for styling
// groupId selections sync across groups & persist via localStorage
const {
  Tabs,
  TabItem,
  useTabsContext: useGenericTabsContext,
  TabsContext: GenericTabsContext,
} = createTabs({
  classPrefix: 'mdx-preview-generic-tabs',
  tabItemClassName: 'mdx-preview-generic-tab-item',
  supportsGroupId: true,
  groupStoragePrefix: 'mdx.tab.',
  contextName: 'GenericTabs',
});

export { Tabs, TabItem, useGenericTabsContext, GenericTabsContext };
export default Tabs;
