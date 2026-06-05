// src/components/starlight/Aside.tsx
// Starlight Aside shim for JSX callouts

import { ReactElement } from 'react';
import { createCallout, type BaseCalloutProps } from '../base/BaseCallout';
import { CALLOUT_ICONS } from '../base/icons';

// aside types (same as admonitions)
export type AsideType = 'note' | 'tip' | 'caution' | 'danger';

// canonical aside type list - single source for metadata
export const ASIDE_TYPES: readonly AsideType[] = [
  'note',
  'tip',
  'caution',
  'danger',
] as const;

// aside component props
export type AsideProps = BaseCalloutProps<AsideType>;

// default titles for each aside type
const ASIDE_TITLES: Record<AsideType, string> = {
  note: 'Note',
  tip: 'Tip',
  caution: 'Caution',
  danger: 'Danger',
};

// create the Aside using factory
const BaseAside = createCallout<AsideType>({
  classPrefix: 'mdx-preview-starlight-aside',
  defaultType: 'note',
  icons: { type: 'svg', icons: CALLOUT_ICONS },
  defaultTitles: ASIDE_TITLES,
  layout: 'header',
});

// aside component
export function Aside(props: AsideProps): ReactElement {
  return <BaseAside {...props} />;
}

export default Aside;
