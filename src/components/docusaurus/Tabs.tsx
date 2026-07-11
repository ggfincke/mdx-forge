// src/components/docusaurus/Tabs.tsx
// Docusaurus Tabs/TabItem component shim for MDX Preview
// provide preview-compatible versions of @theme/Tabs & @theme/TabItem

import {
  createTabs,
  type BaseTabsProps,
  type TabDefinition,
  type TabItemProps as BaseTabItemProps,
} from '../base';

// docusaurus surface: groupId sync/persistence, queryString URL sync, lazy
export type TabsProps = Omit<BaseTabsProps, 'syncKey'>;
// docusaurus TabItem has no icon prop
export type TabItemProps = Omit<BaseTabItemProps, 'icon'>;
export type { TabDefinition };

// create Docusaurus-compatible tabs using the factory
// groupId selections sync across groups & persist via localStorage
// queryString mirrors the selection into the URL & lazy mounts one panel
const { Tabs, TabItem, useTabsContext, TabsContext } = createTabs({
  classPrefix: 'mdx-preview-tabs',
  wrapperClass: 'docusaurus-tabs',
  supportsGroupId: true,
  groupStoragePrefix: 'docusaurus.tab.',
  supportsQueryString: true,
  contextName: 'DocusaurusTabs',
});

export { Tabs, TabItem, useTabsContext, TabsContext };
export default Tabs;
