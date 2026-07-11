// src/components/generic/CodeGroup.tsx
// Generic CodeGroup component shim for MDX Preview
// provide tabbed code blocks w/o framework dependency

import React, {
  ReactElement,
  ReactNode,
  Children,
  isValidElement,
  useRef,
  useCallback,
  useId,
  KeyboardEvent,
} from 'react';
import { CodeGroupProps } from './types';
import { cn } from '../internal/cn';
import { useIndexTabs, resolveTabNavIndex } from '../base/useTabState';

// extract label from code block element
function extractLabelFromCodeBlock(child: ReactElement): string {
  const props = child.props as Record<string, unknown>;

  // try various prop names used by different frameworks
  if (typeof props.title === 'string') {
    return props.title;
  }
  if (typeof props.label === 'string') {
    return props.label;
  }
  if (typeof props.filename === 'string') {
    return props.filename;
  }
  // compiled fences expose their title="..." meta as data-title
  if (typeof props['data-title'] === 'string') {
    return props['data-title'] as string;
  }
  if (typeof props.language === 'string') {
    return props.language;
  }
  if (typeof props.lang === 'string') {
    return props.lang;
  }

  // try to get from className (e.g., "language-javascript")
  if (typeof props.className === 'string') {
    const match = props.className.match(/language-(\w+)/);
    if (match) {
      return match[1];
    }
  }

  return 'Code';
}

// single code-block tab (label + rendered content)
interface CodeGroupTab {
  label: string;
  content: ReactNode;
}

// render tabbed code blocks from children
export function CodeGroup({ children, labels }: CodeGroupProps): ReactElement {
  const childArray = Children.toArray(children).filter(isValidElement);

  // extract tabs from children
  const tabs: CodeGroupTab[] = childArray.map((child, index) => {
    const label =
      labels?.[index] || extractLabelFromCodeBlock(child as ReactElement);
    return { label, content: child };
  });

  // shared index-based tab state (matches base tabs factory)
  const { activeIndex, setActiveIndex } = useIndexTabs({ items: tabs });

  // refs for tab buttons to enable focus management
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // handle keyboard navigation for tabs
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const newIndex = resolveTabNavIndex(e.key, currentIndex, tabs.length);
      if (newIndex === undefined) {
        return;
      }

      e.preventDefault();
      setActiveIndex(newIndex);
      tabRefs.current[newIndex]?.focus();
    },
    [tabs.length, setActiveIndex]
  );

  // reciprocal tab/panel ids for aria-controls & aria-labelledby
  const baseId = useId();
  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const panelId = (index: number) => `${baseId}-panel-${index}`;

  if (tabs.length === 0) {
    return (
      <div className="mdx-preview-generic-code-group-empty">{children}</div>
    );
  }

  // if only one code block, just render it directly
  if (tabs.length === 1) {
    return (
      <div className="mdx-preview-generic-code-group">{tabs[0].content}</div>
    );
  }

  return (
    <div className="mdx-preview-generic-code-group">
      {/* Tab headers */}
      <div className="mdx-preview-generic-code-group-header" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={index}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            id={tabId(index)}
            role="tab"
            aria-controls={panelId(index)}
            className={cn(
              'mdx-preview-generic-code-group-button',
              index === activeIndex && 'active'
            )}
            aria-selected={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={index === activeIndex ? 0 : -1}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mdx-preview-generic-code-group-content">
        {tabs.map((tab, index) => (
          <div
            key={index}
            id={panelId(index)}
            role="tabpanel"
            aria-labelledby={tabId(index)}
            className={cn(
              'mdx-preview-generic-code-group-panel',
              index === activeIndex && 'active'
            )}
            hidden={index !== activeIndex}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CodeGroup;
