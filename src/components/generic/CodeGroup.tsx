// src/components/generic/CodeGroup.tsx
// Generic CodeGroup component shim for MDX Preview
// provide tabbed code blocks w/o framework dependency

import React, {
  ReactElement,
  ReactNode,
  Children,
  isValidElement,
} from 'react';
import { CodeGroupProps } from './types';
import { cn } from '../internal/cn';
import { useIndexTabs } from '../base/useTabState';
import { useTabListInteraction } from '../base/useTabListInteraction';

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

  // shared interaction machinery
  const { tabId, panelId, tabButtonProps } = useTabListInteraction({
    count: tabs.length,
    onSelect: setActiveIndex,
  });

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
            {...tabButtonProps(index, index === activeIndex)}
            className={cn(
              'mdx-preview-generic-code-group-button',
              index === activeIndex && 'active'
            )}
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
