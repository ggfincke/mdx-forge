// src/components/nextra/FileTree.tsx
// Nextra FileTree shim w/ compound Folder & File statics

import React, {
  Children,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  BaseFileTree,
  BaseFileTreeFile,
  BaseFileTreeFolder,
  renderBaseFileTreeChildren,
} from '../base/BaseFileTree';
import { cn } from '../internal/cn';

export interface FileTreeFolderProps {
  name: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

export interface FileTreeFileProps {
  name: string;
}

export type FileTreeProps = HTMLAttributes<HTMLUListElement> & {
  children: ReactNode;
};

function Folder({
  name,
  defaultOpen = false,
  children,
}: FileTreeFolderProps): ReactElement {
  return (
    <BaseFileTreeFolder name={name} open={defaultOpen}>
      {children}
    </BaseFileTreeFolder>
  );
}

Folder.displayName = 'NextraFileTreeFolder';

function File({ name }: FileTreeFileProps): ReactElement {
  return <BaseFileTreeFile name={name} />;
}

File.displayName = 'NextraFileTreeFile';

function hasCompoundChildren(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) =>
      isValidElement(child) && (child.type === Folder || child.type === File)
  );
}

function NextraFileTree({
  children,
  className,
  ...props
}: FileTreeProps): ReactElement {
  const content = hasCompoundChildren(children)
    ? children
    : renderBaseFileTreeChildren(children);

  return (
    <div className={cn('mdx-preview-nextra-file-tree')}>
      <BaseFileTree {...props} className={className}>
        {content}
      </BaseFileTree>
    </div>
  );
}

NextraFileTree.displayName = 'NextraFileTree';

export const FileTree = Object.assign(NextraFileTree, { Folder, File });

export default FileTree;
