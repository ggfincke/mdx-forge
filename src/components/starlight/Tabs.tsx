// src/components/starlight/Tabs.tsx
// Starlight Tabs/TabItem component shim for MDX Preview
// syncKey-synced tab groups w/ optional TabItem icons

import {
  createTabs,
  type BaseTabsProps,
  type TabDefinition,
  type TabItemProps as BaseTabItemProps,
} from '../base';
import { resolveStarlightIcon } from './icon-map';

// starlight surface: syncKey sync/persistence; no groupId/queryString/lazy
export type TabsProps = Omit<BaseTabsProps, 'groupId' | 'queryString' | 'lazy'>;
// starlight TabItem supports label, value, default & icon
export type TabItemProps = BaseTabItemProps;
export type { TabDefinition };

// create Starlight-compatible tabs using the factory
// syncKey selections sync across groups & persist via localStorage
// string icons resolve through the Starlight icon subset
const { Tabs, TabItem, useTabsContext, TabsContext } = createTabs({
  classPrefix: 'mdx-preview-tabs',
  wrapperClass: 'starlight-tabs',
  supportsSyncKey: true,
  groupStoragePrefix: 'starlight-synced-tabs__',
  renderTabIcon: resolveStarlightIcon,
  contextName: 'StarlightTabs',
});

export { Tabs, TabItem, useTabsContext, TabsContext };
export default Tabs;
