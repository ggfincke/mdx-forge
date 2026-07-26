// src/components/base/BaseFileTree.tsx
// own shared file-tree parsing & structural rendering

import React, {
  Children,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../internal/cn';
import { extractTextContent } from './extractTextContent';
import { FILE_TREE_ICONS } from './icons';

export interface BaseFileTreeProps extends Omit<
  HTMLAttributes<HTMLUListElement>,
  'children'
> {
  children: ReactNode;
}

export interface BaseFileTreeFolderProps {
  name: ReactNode;
  open: boolean;
  children?: ReactNode;
  highlighted?: boolean;
  comment?: ReactNode;
}

export interface BaseFileTreeFileProps {
  name: ReactNode;
  highlighted?: boolean;
  comment?: ReactNode;
}

interface FileTreeEntry {
  name: string;
  isDirectory: boolean;
  isHighlighted: boolean;
  comment?: ReactNode[];
  isPlaceholder: boolean;
  children?: FileTreeEntry[];
}

function isBoldElement(node: ReactNode): boolean {
  return isValidElement(node) && (node.type === 'strong' || node.type === 'b');
}

function parseListItemContent(children: ReactNode): {
  name: string;
  isHighlighted: boolean;
  comment?: ReactNode[];
  nestedList?: ReactNode;
} {
  const childArray = Children.toArray(children);
  let name = '';
  let isHighlighted = false;
  const comment: ReactNode[] = [];
  let nestedList: ReactNode | undefined;

  for (const child of childArray) {
    if (isValidElement(child) && child.type === 'ul') {
      nestedList = child;
      continue;
    }

    if (!name) {
      if (typeof child === 'string') {
        const text = child.replace(/^\s+/, '');
        if (!text) {
          continue;
        }
        const match = text.match(/^(\S+)([\s\S]*)$/);
        name = match?.[1] ?? '';
        const rest = match?.[2].replace(/^\s+/, '');
        if (rest) {
          comment.push(rest);
        }
        continue;
      }

      if (isValidElement(child)) {
        name = extractTextContent(child).trim();
        isHighlighted = isBoldElement(child);
      }
      continue;
    }

    if (typeof child === 'string' && !child.trim()) {
      continue;
    }
    comment.push(child);
  }

  return {
    name,
    isHighlighted,
    comment: comment.length > 0 ? comment : undefined,
    nestedList,
  };
}

function parseListItem(li: ReactElement): FileTreeEntry | null {
  const { name, isHighlighted, comment, nestedList } = parseListItemContent(
    (li.props as { children?: ReactNode }).children
  );

  if (!name) {
    return null;
  }

  if (name === '...' || name === '…') {
    return {
      name: '...',
      isDirectory: false,
      isHighlighted: false,
      isPlaceholder: true,
    };
  }

  const isDirectory = name.endsWith('/') || nestedList !== undefined;
  const cleanName = name.endsWith('/') ? name.slice(0, -1) : name;
  let entryChildren: FileTreeEntry[] | undefined;
  if (nestedList && isValidElement(nestedList)) {
    entryChildren = parseFileTreeChildren(
      (nestedList.props as { children?: ReactNode }).children
    );
  }

  return {
    name: cleanName,
    isDirectory,
    isHighlighted,
    comment,
    isPlaceholder: false,
    children: entryChildren,
  };
}

function parseFileTreeChildren(children: ReactNode): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];
  const childArray = Children.toArray(children);

  for (let index = 0; index < childArray.length; index++) {
    const child = childArray[index];
    if (!isValidElement(child)) {
      continue;
    }

    if (child.type === 'ul') {
      entries.push(
        ...parseFileTreeChildren(
          (child.props as { children?: ReactNode }).children
        )
      );
      continue;
    }

    if (child.type !== 'li') {
      continue;
    }

    const entry = parseListItem(child);
    if (!entry) {
      continue;
    }

    const nextChild = childArray[index + 1];
    if (
      entry.isDirectory &&
      !entry.children?.length &&
      isValidElement(nextChild) &&
      nextChild.type === 'ul'
    ) {
      entry.children = parseFileTreeChildren(
        (nextChild.props as { children?: ReactNode }).children
      );
      index++;
    }

    entries.push(entry);
  }

  return entries;
}

export function BaseFileTree({
  children,
  className,
  ...props
}: BaseFileTreeProps): ReactElement {
  return (
    <div className="mdx-preview-starlight-file-tree">
      <ul {...props} className={className}>
        {children}
      </ul>
    </div>
  );
}

export function BaseFileTreeFolder({
  name,
  open,
  children,
  highlighted,
  comment,
}: BaseFileTreeFolderProps): ReactElement {
  const summaryClassName =
    highlighted === undefined ? undefined : cn(highlighted && 'highlighted');

  return (
    <li className="mdx-preview-starlight-file-tree-directory">
      <details open={open}>
        <summary className={summaryClassName}>
          <span
            className="icon chevron"
            dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.chevron }}
          />
          <span
            className="icon folder"
            dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.folder }}
          />
          <span className="name">{name}</span>
          {comment && <span className="comment">{comment}</span>}
        </summary>
        {children !== undefined && children !== null && <ul>{children}</ul>}
      </details>
    </li>
  );
}

export function BaseFileTreeFile({
  name,
  highlighted = false,
  comment,
}: BaseFileTreeFileProps): ReactElement {
  return (
    <li
      className={cn(
        'mdx-preview-starlight-file-tree-file',
        highlighted && 'highlighted'
      )}
    >
      <span
        className="icon file"
        dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.file }}
      />
      <span className="name">{name}</span>
      {comment && <span className="comment">{comment}</span>}
    </li>
  );
}

function BaseFileTreePlaceholder(): ReactElement {
  return (
    <li className="mdx-preview-starlight-file-tree-placeholder">
      <span className="placeholder-dots">...</span>
    </li>
  );
}

function renderFileTreeEntry(entry: FileTreeEntry, key: number): ReactElement {
  if (entry.isPlaceholder) {
    return <BaseFileTreePlaceholder key={key} />;
  }

  if (entry.isDirectory) {
    const children =
      entry.children && entry.children.length > 0
        ? entry.children.map(renderFileTreeEntry)
        : undefined;
    return (
      <BaseFileTreeFolder
        key={key}
        name={entry.name}
        open
        highlighted={entry.isHighlighted}
        comment={entry.comment}
      >
        {children}
      </BaseFileTreeFolder>
    );
  }

  return (
    <BaseFileTreeFile
      key={key}
      name={entry.name}
      highlighted={entry.isHighlighted}
      comment={entry.comment}
    />
  );
}

export function renderBaseFileTreeChildren(children: ReactNode): ReactNode {
  return parseFileTreeChildren(children).map(renderFileTreeEntry);
}
