// src/components/nextra/FileTree.tsx
// Nextra FileTree shim w/ compound FileTree.Folder / FileTree.File statics

import React, {
  ReactNode,
  ReactElement,
  HTMLAttributes,
  Children,
  isValidElement,
} from 'react';
import { FileTree as StarlightFileTree } from '../starlight/FileTree';
import { FILE_TREE_ICONS } from '../base/icons';
import { cn } from '../internal/cn';

// folder props (compatible w/ Nextra)
export interface FileTreeFolderProps {
  name: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

// file props (compatible w/ Nextra)
export interface FileTreeFileProps {
  name: string;
}

// FileTree props (compatible w/ Nextra)
export type FileTreeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

// folder entry - collapsible directory node
function Folder({
  name,
  defaultOpen = false,
  children,
}: FileTreeFolderProps): ReactElement {
  return (
    <li className="mdx-preview-starlight-file-tree-directory">
      <details open={defaultOpen}>
        <summary>
          <span
            className="icon chevron"
            dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.chevron }}
          />
          <span
            className="icon folder"
            dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.folder }}
          />
          <span className="name">{name}</span>
        </summary>
        {children !== undefined && children !== null && <ul>{children}</ul>}
      </details>
    </li>
  );
}

Folder.displayName = 'NextraFileTreeFolder';

// file entry - leaf node
function File({ name }: FileTreeFileProps): ReactElement {
  return (
    <li className="mdx-preview-starlight-file-tree-file">
      <span
        className="icon file"
        dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.file }}
      />
      <span className="name">{name}</span>
    </li>
  );
}

File.displayName = 'NextraFileTreeFile';

// detect the compound authoring form (FileTree.Folder / FileTree.File)
function hasCompoundChildren(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) =>
      isValidElement(child) && (child.type === Folder || child.type === File)
  );
}

// fileTree component: renders compound Folder/File children directly
// plain ul/li children fall back to the Starlight list parser
function NextraFileTree({
  children,
  className,
  ...props
}: FileTreeProps): ReactElement {
  return (
    <div className={cn('mdx-preview-nextra-file-tree', className)} {...props}>
      {hasCompoundChildren(children) ? (
        <div className="mdx-preview-starlight-file-tree">
          <ul>{children}</ul>
        </div>
      ) : (
        <StarlightFileTree>{children}</StarlightFileTree>
      )}
    </div>
  );
}

NextraFileTree.displayName = 'NextraFileTree';

// compound component export
export const FileTree = Object.assign(NextraFileTree, { Folder, File });

export default FileTree;
