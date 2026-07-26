// src/components/base/createCollapsible.tsx
// factory for creating framework-specific collapsible/details components

import React, {
  useState,
  ReactNode,
  ReactElement,
  MouseEvent,
  ComponentPropsWithoutRef,
} from 'react';
import { cn } from '../internal/cn';
import { ChevronIcon } from './icons';

// class names configuration for collapsible components
export interface CollapsibleClassNames {
  container: string;
  summary: string;
  icon: string;
  // appended when open
  iconOpen: string;
  title: string;
  content: string;
}

// configuration for creating a collapsible component
export interface CollapsibleConfig {
  classNames: CollapsibleClassNames;
  iconSize?: number;
  useNativeToggle?: boolean;
  applyOpenClassToWrapper?: boolean;
  defaultSummary?: string;
}

type DetailsProps = ComponentPropsWithoutRef<'details'>;

// common collapsible props
export interface BaseCollapsibleProps extends Omit<
  DetailsProps,
  'children' | 'title' | 'open' | 'onToggle' | 'onClick'
> {
  children: ReactNode;
  summary?: ReactNode;
  // alias for summary
  title?: ReactNode;
  defaultOpen?: boolean;
  // alias for defaultOpen
  open?: boolean;
  className?: string;
  onToggle?: DetailsProps['onToggle'];
  onClick?: DetailsProps['onClick'];
}

// preset class configurations for each framework

// class names for Generic Collapsible
export const GENERIC_COLLAPSIBLE_CLASSES: CollapsibleClassNames = {
  container: 'mdx-preview-generic-collapsible',
  summary: 'mdx-preview-generic-collapsible-summary',
  icon: 'mdx-preview-generic-collapsible-icon',
  iconOpen: 'open',
  title: 'mdx-preview-generic-collapsible-title',
  content: 'mdx-preview-generic-collapsible-content',
};

// class names for Docusaurus Details
export const DOCUSAURUS_DETAILS_CLASSES: CollapsibleClassNames = {
  container: 'docusaurus-details',
  summary: 'details-summary',
  icon: 'details-toggle-icon',
  iconOpen: 'expanded',
  title: 'details-summary-text',
  content: 'details-content',
};

// factory function to create framework-specific Collapsible components
export function createCollapsible(
  config: CollapsibleConfig
): React.FC<BaseCollapsibleProps> {
  const {
    classNames,
    iconSize = 16,
    useNativeToggle = true,
    applyOpenClassToWrapper = true,
    defaultSummary = 'Details',
  } = config;

  function Collapsible({
    children,
    summary,
    title,
    defaultOpen = false,
    open,
    className,
    onToggle,
    onClick,
    ...detailsProps
  }: BaseCollapsibleProps): ReactElement {
    // resolve prop aliases
    const effectiveSummary = summary ?? title ?? defaultSummary;
    const effectiveDefaultOpen = open ?? defaultOpen;

    const [isOpen, setIsOpen] = useState(effectiveDefaultOpen);

    // native toggle handler (Docusaurus pattern)
    const handleNativeToggle: NonNullable<DetailsProps['onToggle']> = (e) => {
      if (useNativeToggle) {
        setIsOpen((e.target as HTMLDetailsElement).open);
      }
      onToggle?.(e);
    };

    // custom click handler (Generic Collapsible pattern)
    const handleSummaryClick = !useNativeToggle
      ? (e: MouseEvent) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }
      : undefined;

    // prevent native toggle when using custom click handling
    const handleDetailsClick = (e: MouseEvent<HTMLDetailsElement>) => {
      if (!useNativeToggle) {
        if ((e.target as HTMLElement).tagName === 'SUMMARY') {
          e.preventDefault();
        }
      }
      onClick?.(e);
    };

    // determine icon class based on applyOpenClassToWrapper
    const iconWrapperClass = applyOpenClassToWrapper
      ? cn(classNames.icon, isOpen && classNames.iconOpen)
      : classNames.icon;

    const iconSvgClass =
      !applyOpenClassToWrapper && isOpen ? classNames.iconOpen : undefined;

    return (
      <details
        {...detailsProps}
        className={cn(classNames.container, className)}
        data-component="collapsible"
        open={isOpen}
        onToggle={handleNativeToggle}
        onClick={handleDetailsClick}
      >
        <summary className={classNames.summary} onClick={handleSummaryClick}>
          <span className={iconWrapperClass}>
            <ChevronIcon size={iconSize} className={iconSvgClass} />
          </span>
          <span className={classNames.title}>{effectiveSummary}</span>
        </summary>
        <div className={classNames.content}>{children}</div>
      </details>
    );
  }

  return Collapsible;
}
