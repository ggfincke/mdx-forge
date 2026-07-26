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
import {
  TabScaffold,
  type TabScaffoldButton,
  type TabScaffoldPanel,
} from './TabScaffold';
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
export interface BaseTabsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
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
    ...rootProps
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

    const selectIndex = useCallback(
      (index: number) => selectValue(tabs[index].value),
      [tabs, selectValue]
    );
    const tabIndexOf = (value: string) =>
      tabs.findIndex((tab) => tab.value === value);
    const scaffoldButtons: TabScaffoldButton[] = tabs.map((tab) => {
      const selected = tab.value === currentValue;
      return {
        key: tab.value,
        selected,
        panelPresent: !lazy || selected,
        className: cn(`${classPrefix}-button`, selected && 'active'),
        content: (
          <>
            {renderTabIcon && tab.icon !== undefined && (
              <span className={`${classPrefix}-icon`} aria-hidden="true">
                {renderTabIcon(tab.icon)}
              </span>
            )}
            {tab.label}
          </>
        ),
      };
    });
    const scaffoldPanels: TabScaffoldPanel[] = tabItems.flatMap((item) => {
      const selected = item.value === currentValue;
      if (lazy && !selected) {
        return [];
      }
      const index = tabIndexOf(item.value);
      const { className: panelClassName, ...panelProps } = item.panelProps;
      return [
        {
          key: item.value,
          index,
          content: item.content,
          className: cn(
            `${classPrefix}-panel`,
            selected && 'active',
            panelClassName
          ),
          hidden: !selected,
          props: panelProps,
        },
      ];
    });

    // build wrapper class
    const wrapperClassName = cn(wrapperClass || classPrefix, className);

    return (
      <TabsContext.Provider value={true}>
        <div
          {...rootProps}
          className={wrapperClassName}
          data-component="tabs"
          data-group-id={group}
        >
          <TabScaffold
            buttons={scaffoldButtons}
            panels={scaffoldPanels}
            headerClassName={`${classPrefix}-header`}
            contentClassName={`${classPrefix}-content`}
            onSelect={selectIndex}
          />
        </div>
      </TabsContext.Provider>
    );
  }

  Tabs.displayName = contextName;

  // provide TabItem for shared props extraction
  function TabItem({
    children,
    value: _value,
    label: _label,
    default: _default,
    icon: _icon,
    className,
    ...props
  }: TabItemProps): ReactElement {
    const isInsideTabs = useContext(TabsContext);

    // if used outside of Tabs context, render directly
    if (!isInsideTabs) {
      return (
        <div {...props} className={cn(tabItemClassName, className)}>
          {children}
        </div>
      );
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

export interface IndexTabsListRenderProps {
  selectedIndex: number;
}

export interface IndexTabRenderProps {
  hover: boolean;
  focus: boolean;
  active: boolean;
  autofocus: boolean;
  selected: boolean;
  disabled: boolean;
}

export interface IndexTabPanelRenderProps {
  selected: boolean;
  focus: boolean;
}

export interface IndexTabPanelProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'className'
> {
  children: ReactNode | ((props: IndexTabPanelRenderProps) => ReactNode);
  className?:
    string | ((props: IndexTabPanelRenderProps) => string | undefined);
}

// props for index-based Tabs components
export interface IndexTabsProps<T> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'className' | 'onChange'
> {
  children: ReactNode;
  items: T[];
  defaultIndex?: number;
  selectedIndex?: number;
  storageKey?: string;
  onChange?: (index: number) => void;
  className?:
    string | ((props: IndexTabsListRenderProps) => string | undefined);
  tabClassName?: string | ((props: IndexTabRenderProps) => string | undefined);
}

// item accessors for index-based tabs
export interface IndexTabsItemAccessors<T> {
  getLabel: (item: T) => ReactNode;
  isDisabled?: (item: T) => boolean;
}

// result from createIndexTabs factory
export interface CreateIndexTabsResult<T> {
  Tabs: React.FC<IndexTabsProps<T>> & {
    Tab: React.FC<IndexTabPanelProps>;
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
  function Tab({ children }: IndexTabPanelProps): ReactElement {
    return (
      <>
        {typeof children === 'function'
          ? children({ selected: true, focus: false })
          : children}
      </>
    );
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

    const itemDisabled = useCallback(
      (index: number) => isDisabled(items[index]),
      [items]
    );

    const tabChildren = Children.toArray(children).filter(
      (child) => isValidElement(child) && child.type === Tab
    );
    const tabsListRenderProps = { selectedIndex: activeIndex };
    const rootClassName =
      typeof className === 'function'
        ? className(tabsListRenderProps)
        : className;
    const scaffoldButtons: TabScaffoldButton[] = items.map((item, index) => {
      const label = getLabel(item);
      const disabled = isDisabled(item);
      const selected = index === activeIndex;
      const tabRenderProps: IndexTabRenderProps = {
        hover: false,
        focus: false,
        active: false,
        autofocus: false,
        selected,
        disabled,
      };
      const customClass = tabClassName
        ? typeof tabClassName === 'function'
          ? tabClassName(tabRenderProps)
          : tabClassName
        : undefined;

      return {
        key: index,
        content: label,
        selected,
        disabled,
        className: cn(
          `${classPrefix}-button`,
          selected && `${classPrefix}-button-active`,
          disabled && `${classPrefix}-button-disabled`,
          customClass
        ),
      };
    });
    const scaffoldPanels: TabScaffoldPanel[] = tabChildren.map(
      (child, index) => {
        const {
          children: panelChildren,
          className: panelClassName,
          ...panelProps
        } = (child as ReactElement<IndexTabPanelProps>).props;
        const panelRenderProps: IndexTabPanelRenderProps = {
          selected: index === activeIndex,
          focus: false,
        };
        const customClass =
          typeof panelClassName === 'function'
            ? panelClassName(panelRenderProps)
            : panelClassName;

        return {
          key: index,
          index,
          content:
            panelRenderProps.selected &&
            (typeof panelChildren === 'function'
              ? panelChildren(panelRenderProps)
              : panelChildren),
          className: cn(`${classPrefix}-panel`, customClass),
          hidden: !panelRenderProps.selected,
          props: panelProps,
        };
      }
    );

    return (
      <TabsContext.Provider value={true}>
        <div className={cn(classPrefix, rootClassName)} {...props}>
          <TabScaffold
            buttons={scaffoldButtons}
            panels={scaffoldPanels}
            headerClassName={`${classPrefix}-header`}
            contentClassName={`${classPrefix}-content`}
            onSelect={setActiveIndex}
            isDisabled={itemDisabled}
          />
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
