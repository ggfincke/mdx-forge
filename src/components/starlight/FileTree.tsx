// src/components/starlight/FileTree.tsx
// preview-compatible @astrojs/starlight FileTree shim

import React, {
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { BaseFileTree, renderBaseFileTreeChildren } from '../base/BaseFileTree';

export interface FileTreeProps extends Omit<
  HTMLAttributes<HTMLUListElement>,
  'children'
> {
  children: ReactNode;
}

export function FileTree({
  children,
  className,
  ...props
}: FileTreeProps): ReactElement {
  return (
    <BaseFileTree {...props} className={className}>
      {renderBaseFileTreeChildren(children)}
    </BaseFileTree>
  );
}

export default FileTree;
