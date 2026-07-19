// src/components/generic/types.ts
// shared prop types for generic component shims
// public aliases derive from the base component contracts

import type { ReactNode } from 'react';
import type { BaseCalloutProps } from '../base/BaseCallout';
import type { BaseCollapsibleProps } from '../base/createCollapsible';
import {
  type CalloutType,
  normalizeCalloutType,
  CALLOUT_TITLES,
} from '../../internal/callout';

// re-export callout types & utilities for consumers
export { type CalloutType, normalizeCalloutType, CALLOUT_TITLES };

// callout props (shared by Callout, Alert, Admonition)
export type CalloutProps = BaseCalloutProps<CalloutType>;

// collapsible/accordion props (summary wins over title; open ?? defaultOpen)
export type CollapsibleProps = BaseCollapsibleProps;

// code group props (multiple code blocks in tabs)
export interface CodeGroupProps {
  children: ReactNode;
  // explicit labels for tabs
  labels?: string[];
}
