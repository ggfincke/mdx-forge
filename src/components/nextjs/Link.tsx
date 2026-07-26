// src/components/nextjs/Link.tsx
// shim for next/link - provide basic anchor rendering w/o Next.js routing

import { AnchorHTMLAttributes, ReactNode } from 'react';
import { classifyExternalHref, mergeBlankTargetRel } from '../internal/link';

// Next.js Link component props subset (relevant props for preview)
export interface LinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  href:
    | string
    | { pathname?: string; query?: Record<string, string>; hash?: string };
  children: ReactNode;
  as?: string;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  prefetch?: boolean;
  locale?: string | false;
  legacyBehavior?: boolean;
}

// resolve href object to string
function resolveHref(href: LinkProps['href']): string {
  if (typeof href === 'string') {
    return href;
  }

  let url = href.pathname ?? '';

  // add query string
  if (href.query && Object.keys(href.query).length > 0) {
    const params = new URLSearchParams(href.query);
    url += `?${params.toString()}`;
  }

  // add hash
  if (href.hash) {
    url += href.hash.startsWith('#') ? href.hash : `#${href.hash}`;
  }

  return url;
}

// render link as a simple anchor element
export function Link({
  href,
  children,
  as: _as,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  prefetch: _prefetch,
  locale: _locale,
  legacyBehavior: _legacyBehavior,
  className,
  ...rest
}: LinkProps) {
  const resolvedHref = resolveHref(href);

  const hrefKind = classifyExternalHref(resolvedHref);
  const isExternal = hrefKind === 'http' || hrefKind === 'protocol-relative';
  const target = isExternal ? '_blank' : undefined;

  return (
    <a
      href={resolvedHref}
      className={className}
      target={target}
      rel={mergeBlankTargetRel(target, undefined)}
      {...rest}
    >
      {children}
    </a>
  );
}

export default Link;
