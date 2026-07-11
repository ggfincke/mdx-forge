// src/components/base/BaseTabs.tsx
// factory for creating framework-specific Tabs components w/ shared logic

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useSyncExternalStore,
  ReactNode,
  ReactElement,
  Context,
  Children,
  isValidElement,
  HTMLAttributes,
} from 'react';
import { cn } from '../internal/cn';
import {
  useTabState,
  useIndexTabs,
  type TabDefinition,
  type TabItemProps,
} from './useTabState';
import { useTabListInteraction } from './useTabListInteraction';
import {
  subscribeTabGroup,
  getTabGroupChoice,
  setTabGroupChoice,
  publishTabGroupChoice,
  restoreTabGroupChoice,
} from './tabGroupSync';

// configuration for creating a Tabs component
export interface BaseTabsConfig {
  classPrefix: string;
  wrapperClass?: string;
  // groupId-based sync & persistence (Docusaurus/generic)
  supportsGroupId?: boolean;
  // syncKey-based sync & persistence (Starlight)
  supportsSyncKey?: boolean;
  // localStorage namespace for synced group choices
  groupStoragePrefix?: string;
  // URL query-string selection sync (Docusaurus)
  supportsQueryString?: boolean;
  // enable TabItem icons; maps icon names/nodes to rendered nodes
  renderTabIcon?: (icon: ReactNode) => ReactNode;
  // standalone TabItem class
  tabItemClassName?: string;
  // debug name
  contextName: string;
}

// base props for all Tabs implementations
export interface BaseTabsProps {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
  className?: string;
  // sync & persist selection across groups w/ the same ID
  groupId?: string;
  // Starlight alias for group synchronization
  syncKey?: string;
  // URL sync: true derives the param name from groupId, string names it
  queryString?: string | boolean;
  // mount only the selected panel
  lazy?: boolean;
}

// result from createTabs factory
export interface CreateTabsResult {
  Tabs: React.FC<BaseTabsProps>;
  TabItem: React.FC<TabItemProps>;
  useTabsContext: () => boolean;
  TabsContext: Context<boolean>;
}

// factory function to create framework-specific Tabs components
// all implementations share the same core logic via useTabState hook
export function createTabs(config: BaseTabsConfig): CreateTabsResult {
  const {
    classPrefix,
    wrapperClass,
    supportsGroupId = false,
    supportsSyncKey = false,
    groupStoragePrefix = 'mdx.tab.',
    supportsQueryString = false,
    renderTabIcon,
    tabItemClassName = `${classPrefix}-item`,
    contextName,
  } = config;

  // create a unique context for this tabs implementation
  const TabsContext = createContext<boolean>(false);
  TabsContext.displayName = `${contextName}Context`;

  // the Tabs component
  function Tabs({
    children,
    defaultValue,
    values,
    className,
    groupId,
    syncKey,
    queryString,
    lazy = false,
  }: BaseTabsProps): ReactElement {
    const { activeValue, setActiveValue, tabs, tabItems } = useTabState({
      children,
      defaultValue,
      values,
    });

    // resolve sync group -> namespaced storage key
    const effectiveGroupId = supportsGroupId ? groupId : undefined;
    const group = effectiveGroupId ?? (supportsSyncKey ? syncKey : undefined);
    const storeKey = group ? `${groupStoragePrefix}${group}` : undefined;

    // URL param name: true derives from groupId (Docusaurus convention)
    const queryParam = supportsQueryString
      ? typeof queryString === 'string' && queryString !== ''
        ? queryString
        : queryString === true && effectiveGroupId
          ? effectiveGroupId
          : undefined
      : undefined;

    // synced group choice; server snapshot stays undefined for determinism
    const subscribe = useCallback(
      (listener: () => void) =>
        storeKey ? subscribeTabGroup(storeKey, listener) : () => {},
      [storeKey]
    );
    const syncedValue = useSyncExternalStore(
      subscribe,
      () => (storeKey ? getTabGroupChoice(storeKey) : undefined),
      () => undefined
    );

    // restore URL selection (wins), then persisted group choice, post-mount
    const restoredRef = useRef(false);
    useEffect(() => {
      if (restoredRef.current) {
        return;
      }
      restoredRef.current = true;
      if (queryParam) {
        const fromUrl = new URLSearchParams(window.location.search).get(
          queryParam
        );
        if (fromUrl !== null && tabs.some((tab) => tab.value === fromUrl)) {
          setActiveValue(fromUrl);
          if (storeKey) {
            publishTabGroupChoice(storeKey, fromUrl);
          }
        }
      }
      if (storeKey) {
        restoreTabGroupChoice(storeKey);
      }
    }, [queryParam, storeKey, tabs, setActiveValue]);

    // synced choice wins whenever it names an existing tab
    const currentValue =
      syncedValue !== undefined && tabs.some((tab) => tab.value === syncedValue)
        ? syncedValue
        : activeValue;

    // select a tab: update local state, group store & URL
    const selectValue = useCallback(
      (value: string) => {
        setActiveValue(value);
        if (storeKey) {
          setTabGroupChoice(storeKey, value);
        }
        if (queryParam) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set(queryParam, value);
            window.history.replaceState(window.history.state, '', url);
          } catch {
            // URL update is best-effort
          }
        }
      },
      [setActiveValue, storeKey, queryParam]
    );

    // shared interaction machinery; selection maps index -> tab value
    const selectIndex = useCallback(
      (index: number) => selectValue(tabs[index].value),
      [tabs, selectValue]
    );
    const { tabId, panelId, tabButtonProps } = useTabListInteraction({
      count: tabs.length,
      onSelect: selectIndex,
    });
    const tabIndexOf = (value: string) =>
      tabs.findIndex((tab) => tab.value === value);

    // build wrapper class
    const wrapperClassName = cn(wrapperClass || classPrefix, className);

    return (
      <TabsContext.Provider value={true}>
        <div
          className={wrapperClassName}
          data-component="tabs"
          data-group-id={group}
        >
          {/* tab headers */}
          <div className={`${classPrefix}-header`} role="tablist">
            {tabs.map((tab, index) => (
              <button
                key={tab.value}
                {...tabButtonProps(index, tab.value === currentValue)}
                className={cn(
                  `${classPrefix}-button`,
                  tab.value === currentValue && 'active'
                )}
              >
                {renderTabIcon && tab.icon !== undefined && (
                  <span className={`${classPrefix}-icon`} aria-hidden="true">
                    {renderTabIcon(tab.icon)}
                  </span>
                )}
                {tab.label}
              </button>
            ))}
          </div>

          {/* tab content; lazy mode mounts only the selected panel */}
          <div className={`${classPrefix}-content`}>
            {tabItems.map((item) => {
              const selected = item.value === currentValue;
              if (lazy && !selected) {
                return null;
              }
              const index = tabIndexOf(item.value);
              return (
                <div
                  key={item.value}
                  id={index >= 0 ? panelId(index) : undefined}
                  role="tabpanel"
                  aria-labelledby={index >= 0 ? tabId(index) : undefined}
                  className={cn(`${classPrefix}-panel`, selected && 'active')}
                  hidden={!selected}
                >
                  {item.content}
                </div>
              );
            })}
          </div>
        </div>
      </TabsContext.Provider>
    );
  }

  Tabs.displayName = contextName;

  // provide TabItem for shared props extraction
  function TabItem({ children }: TabItemProps): ReactElement {
    const isInsideTabs = useContext(TabsContext);

    // if used outside of Tabs context, render directly
    if (!isInsideTabs) {
      return <div className={tabItemClassName}>{children}</div>;
    }

    // render content via parent when inside Tabs
    return <>{children}</>;
  }

  TabItem.displayName = `${contextName}TabItem`;

  // hook to check if inside Tabs context
  function useTabsContext(): boolean {
    return useContext(TabsContext);
  }

  return { Tabs, TabItem, useTabsContext, TabsContext };
}

// index-based Tabs factory (for Nextra-style tabs)

// configuration for index-based tabs
export interface IndexTabsConfig {
  classPrefix: string;
  // debug name
  contextName: string;
}

// props for index-based Tabs components
export interface IndexTabsProps<T> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  children: ReactNode;
  items: T[];
  defaultIndex?: number;
  selectedIndex?: number;
  storageKey?: string;
  onChange?: (index: number) => void;
  tabClassName?: string | ((index: number, selected: boolean) => string);
}

// item accessors for index-based tabs
export interface IndexTabsItemAccessors<T> {
  getLabel: (item: T) => string;
  isDisabled?: (item: T) => boolean;
}

// result from createIndexTabs factory
export interface CreateIndexTabsResult<T> {
  Tabs: React.FC<IndexTabsProps<T>> & {
    Tab: React.FC<{ children: ReactNode }>;
  };
  TabsContext: Context<boolean>;
}

// factory for creating index-based Tabs components (Nextra style)
// use items array instead of extracting tabs from children
export function createIndexTabs<T>(
  config: IndexTabsConfig,
  accessors: IndexTabsItemAccessors<T>
): CreateIndexTabsResult<T> {
  const { classPrefix, contextName } = config;
  const { getLabel, isDisabled = () => false } = accessors;

  const TabsContext = createContext<boolean>(false);
  TabsContext.displayName = `${contextName}Context`;

  // tab subcomponent (compound component pattern)
  function Tab({ children }: { children: ReactNode }): ReactElement {
    return <>{children}</>;
  }

  function TabsComponent({
    children,
    items,
    defaultIndex = 0,
    selectedIndex: controlledIndex,
    storageKey,
    onChange,
    className,
    tabClassName,
    ...props
  }: IndexTabsProps<T>): ReactElement {
    const { activeIndex, setActiveIndex } = useIndexTabs({
      items,
      defaultIndex,
      controlledIndex,
      storageKey,
      onChange,
      isDisabled,
    });

    // shared interaction machinery (disabled-aware)
    const itemDisabled = useCallback(
      (index: number) => isDisabled(items[index]),
      [items]
    );
    const { tabId, panelId, tabButtonProps } = useTabListInteraction({
      count: items.length,
      onSelect: setActiveIndex,
      isDisabled: itemDisabled,
    });

    // get Tab children for content panels
    const tabChildren = Children.toArray(children).filter(
      (child) => isValidElement(child) && child.type === Tab
    );

    return (
      <TabsContext.Provider value={true}>
        <div className={cn(classPrefix, className)} {...props}>
          <div className={`${classPrefix}-header`} role="tablist">
            {items.map((item, index) => {
              const label = getLabel(item);
              const disabled = isDisabled(item);
              const selected = index === activeIndex;

              const customClass = tabClassName
                ? typeof tabClassName === 'function'
                  ? tabClassName(index, selected)
                  : tabClassName
                : undefined;

              return (
                <button
                  key={index}
                  {...tabButtonProps(index, selected)}
                  aria-disabled={disabled}
                  className={cn(
                    `${classPrefix}-button`,
                    selected && `${classPrefix}-button-active`,
                    disabled && `${classPrefix}-button-disabled`,
                    customClass
                  )}
                  disabled={disabled}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className={`${classPrefix}-content`}>
            {tabChildren.map((child, index) => (
              <div
                key={index}
                id={panelId(index)}
                role="tabpanel"
                aria-labelledby={tabId(index)}
                hidden={index !== activeIndex}
                className={`${classPrefix}-panel`}
              >
                {index === activeIndex && child}
              </div>
            ))}
          </div>
        </div>
      </TabsContext.Provider>
    );
  }

  const Tabs = Object.assign(TabsComponent, { Tab });
  (Tabs as { displayName?: string }).displayName = contextName;

  return { Tabs, TabsContext };
}

// re-export types for convenience
export type { TabDefinition, TabItemProps };
