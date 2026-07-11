// src/components/nextra/Steps.tsx
// Nextra Steps shim: numbered rail around heading-delimited content

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react';
import { cn } from '../internal/cn';

// steps props (compatible w/ Nextra)
export type StepsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

// steps component - CSS counters number the h2/h3/h4 headings inside
export function Steps({
  children,
  className,
  ...props
}: StepsProps): ReactElement {
  return (
    <div className={cn('mdx-preview-nextra-steps', className)} {...props}>
      {children}
    </div>
  );
}

export default Steps;
