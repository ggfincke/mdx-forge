// src/components/base/useTabState.ts
// shared hook for tab state management across framework shims

import {
  useState,
  useCallback,
  useEffect,
  ReactNode,
  HTMLAttributes,
  isValidElement,
  Children,
} from 'react';

const ITEM_IS_DISABLED = () => false;

// tab item extracted from children
export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  panelProps: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
}

// tab definition (value, label & optional icon)
export interface TabDefinition {
  value: string;
  label: string;
  icon?: ReactNode;
}

// props for a TabItem component
export interface TabItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  children: ReactNode;
  // optional - can use label as fallback (Starlight uses label only)
  value?: string;
  label?: string;
  default?: boolean;
  // optional icon (Starlight icon name or custom node)
  icon?: ReactNode;
}

// options for useTabState hook
export interface UseTabStateOptions {
  children: ReactNode;
  defaultValue?: string;
  values?: TabDefinition[];
}

// result from useTabState hook
export interface UseTabStateResult {
  activeValue: string;
  setActiveValue: (value: string) => void;
  tabs: TabDefinition[];
  tabItems: TabItem[];
}

function extractPanelProps(
  props: TabItemProps
): Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  const panelProps: Partial<TabItemProps> = { ...props };
  delete panelProps.children;
  delete panelProps.value;
  delete panelProps.label;
  delete panelProps.default;
  delete panelProps.icon;
  return panelProps;
}

// extract TabItem children w/ their props
export function extractTabItems(children: ReactNode): TabItem[] {
  const items: TabItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const props = child.props as TabItemProps;
    // accept either 'value' (Docusaurus) or 'label' (Starlight) as identifier
    const value = props.value ?? props.label;
    if (value !== undefined) {
      items.push({
        value,
        label: props.label || value,
        icon: props.icon,
        content: props.children,
        panelProps: extractPanelProps(props),
      });
    }
  });

  return items;
}

// find default tab value from children
function findDefaultFromChildren(
  children: ReactNode,
  tabItems: TabItem[]
): string | undefined {
  const childArray = Children.toArray(children);

  for (const item of tabItems) {
    // match w/ the same value-extraction fallback chain as extractTabItems
    const child = childArray.find((c) => {
      if (!isValidElement(c)) {
        return false;
      }
      const props = c.props as TabItemProps;
      return (props.value ?? props.label) === item.value;
    });
    if (
      child &&
      isValidElement(child) &&
      (child.props as TabItemProps).default
    ) {
      return item.value;
    }
  }

  return undefined;
}

// resolve keyboard-nav target index for tab lists
// skips disabled tabs; returns undefined for unhandled keys
export function resolveTabNavIndex(
  key: string,
  currentIndex: number,
  count: number,
  isDisabled: (index: number) => boolean = () => false
): number | undefined {
  let newIndex = currentIndex;

  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      // find previous non-disabled tab
      for (let i = 1; i <= count; i++) {
        const idx = (currentIndex - i + count) % count;
        if (!isDisabled(idx)) {
          newIndex = idx;
          break;
        }
      }
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      // find next non-disabled tab
      for (let i = 1; i <= count; i++) {
        const idx = (currentIndex + i) % count;
        if (!isDisabled(idx)) {
          newIndex = idx;
          break;
        }
      }
      break;
    case 'Home':
      // find first non-disabled tab
      for (let i = 0; i < count; i++) {
        if (!isDisabled(i)) {
          newIndex = i;
          break;
        }
      }
      break;
    case 'End':
      // find last non-disabled tab
      for (let i = count - 1; i >= 0; i--) {
        if (!isDisabled(i)) {
          newIndex = i;
          break;
        }
      }
      break;
    default:
      return undefined;
  }

  return newIndex;
}

// hook for managing tab state
// extract tab items from children, determine initial active value
// & provide state management for tab selection
export function useTabState(options: UseTabStateOptions): UseTabStateResult {
  const { children, defaultValue, values } = options;

  // extract tab items from children
  const tabItems = extractTabItems(children);

  // use provided values or extracted ones
  const tabs: TabDefinition[] =
    values ||
    tabItems.map((item) => ({
      value: item.value,
      label: item.label,
      icon: item.icon,
    }));

  // determine initial active value lazily (read only on mount)
  const [activeValue, setActiveValue] = useState(
    () =>
      defaultValue ||
      findDefaultFromChildren(children, tabItems) ||
      tabs[0]?.value ||
      ''
  );

  // ensure activeValue is valid (in case tabs change)
  const validActiveValue = tabs.find((t) => t.value === activeValue)
    ? activeValue
    : tabs[0]?.value || '';

  return {
    activeValue: validActiveValue,
    setActiveValue,
    tabs,
    tabItems,
  };
}

export default useTabState;

// index-based tab state management (for Nextra-style tabs)

// options for useIndexTabs hook
export interface UseIndexTabsOptions<T> {
  items: T[];
  defaultIndex?: number;
  // override internal state
  controlledIndex?: number;
  // localStorage persistence key
  storageKey?: string;
  // selection change handler
  onChange?: (index: number) => void;
  // disabled check
  isDisabled?: (item: T) => boolean;
}

// result from useIndexTabs hook
export interface UseIndexTabsResult {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

// normalize a candidate index against the currently-enabled items
// invalid, out-of-range & disabled candidates fall back to the first
// enabled item (or 0 when all items are disabled) so a panel always shows
function normalizeEnabledIndex<T>(
  candidate: number,
  items: T[],
  isDisabled: (item: T) => boolean
): number {
  if (items.length === 0) {
    return 0;
  }
  if (
    Number.isInteger(candidate) &&
    candidate >= 0 &&
    candidate < items.length &&
    !isDisabled(items[candidate])
  ) {
    return candidate;
  }
  const firstEnabled = items.findIndex((item) => !isDisabled(item));
  return firstEnabled >= 0 ? firstEnabled : 0;
}

// hook for index-based tab state management
// server & first client render are deterministic (no storage read in
// render); stored indices restore after hydration & indices normalize
export function useIndexTabs<T>({
  items,
  defaultIndex = 0,
  controlledIndex,
  storageKey,
  onChange,
  isDisabled = ITEM_IS_DISABLED,
}: UseIndexTabsOptions<T>): UseIndexTabsResult {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);

  // restore persisted index after hydration & whenever its inputs change
  useEffect(() => {
    if (!storageKey) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(`nextra-tabs-${storageKey}`);
      if (stored === null) {
        setInternalIndex(
          normalizeEnabledIndex(defaultIndex, items, isDisabled)
        );
        return;
      }
      const parsed = Number.parseInt(stored, 10);
      setInternalIndex(normalizeEnabledIndex(parsed, items, isDisabled));
    } catch {
      // ignore localStorage errors
    }
  }, [storageKey, defaultIndex, items, isDisabled]);

  // controlled wins over internal; invalid values normalize to first enabled
  const activeIndex = normalizeEnabledIndex(
    controlledIndex ?? internalIndex,
    items,
    isDisabled
  );

  // handle tab selection
  const setActiveIndex = useCallback(
    (index: number) => {
      // check if tab is disabled
      if (items[index] !== undefined && isDisabled(items[index])) {
        return;
      }

      // update internal state if not controlled
      if (controlledIndex === undefined) {
        setInternalIndex(index);
      }

      // save to localStorage if storageKey is provided
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            `nextra-tabs-${storageKey}`,
            String(index)
          );
        } catch {
          // ignore localStorage errors
        }
      }

      // call onChange callback
      onChange?.(index);
    },
    [controlledIndex, items, isDisabled, onChange, storageKey]
  );

  return { activeIndex, setActiveIndex };
}
