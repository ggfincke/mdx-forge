// src/components/nextra/Tabs.tsx
// nextra Tabs shim w/ compound panels & render props

import { ReactElement } from 'react'
import {
  createIndexTabs,
  type IndexTabPanelProps,
  type IndexTabsProps,
} from '../base/BaseTabs'

export type TabLabel = string | ReactElement
export interface TabObjectItem
{
  label: TabLabel
  disabled?: boolean
}
export type TabItem = TabLabel | TabObjectItem

function isTabObjectItem(item: TabItem): item is TabObjectItem
{
  return typeof item === 'object' && 'label' in item
}

// helper to get label from TabItem
function getTabLabel(item: TabItem): TabLabel
{
  return isTabObjectItem(item) ? item.label : item
}

// helper to check if tab is disabled
function isTabDisabled(item: TabItem): boolean
{
  return isTabObjectItem(item) && item.disabled === true
}

// create Nextra Tabs using factory
const { Tabs: NextraTabs, TabsContext } = createIndexTabs<TabItem>(
  {
    classPrefix: 'mdx-preview-nextra-tabs',
    contextName: 'NextraTabs',
  },
  {
    getLabel: getTabLabel,
    isDisabled: isTabDisabled,
  }
)

// re-export types for API compatibility
export type TabsProps = IndexTabsProps<TabItem>
export type TabProps = IndexTabPanelProps

// export Tab subcomponent separately for convenience
export const Tab = NextraTabs.Tab

// export Tabs w/ compound component pattern
export const Tabs = NextraTabs

// export context for advanced use cases
export { TabsContext }

export default Tabs
