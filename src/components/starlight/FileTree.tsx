// src/components/starlight/FileTree.tsx
// Starlight FileTree component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components FileTree

import React, {
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from 'react';
import { extractTextContent } from '../base/extractTextContent';
import { FILE_TREE_ICONS } from '../base/icons';
import { cn } from '../internal/cn';

// file tree props (compatible w/ Starlight)
export interface FileTreeProps {
  children: ReactNode;
}

// internal representation of a file tree entry
// comments keep their original inline nodes (formatting preserved)
interface FileTreeEntry {
  name: string;
  isDirectory: boolean;
  isHighlighted: boolean;
  comment?: ReactNode[];
  isPlaceholder: boolean;
  children?: FileTreeEntry[];
}

// check if a child is a bold element (strong)
function isBoldElement(node: ReactNode): boolean {
  if (!isValidElement(node)) {
    return false;
  }
  return node.type === 'strong' || node.type === 'b';
}

// parse li element content: the first significant inline node is the
// filename (text/code/bold wrappers all valid, spaces preserved inside
// wrappers); everything after stays comment content w/ its formatting
function parseLiContent(children: ReactNode): {
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
    // check for nested ul (subdirectory)
    if (isValidElement(child) && child.type === 'ul') {
      nestedList = child;
      continue;
    }

    if (!name) {
      // plain text: first whitespace-separated token is the filename
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

      // formatted wrapper (code/strong/em/...): whole content is the name
      if (isValidElement(child)) {
        name = extractTextContent(child).trim();
        isHighlighted = isBoldElement(child);
        continue;
      }

      continue;
    }

    // after the filename everything stays comment content; later bold or
    // other formatting is never reinterpreted as a replacement filename
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

// parse a single <li> element into a FileTreeEntry
function parseLiElement(li: ReactElement): FileTreeEntry | null {
  const { name, isHighlighted, comment, nestedList } = parseLiContent(
    (li.props as { children?: ReactNode }).children
  );

  if (!name) {
    return null;
  }

  // check for placeholder
  if (name === '...' || name === '…') {
    return {
      name: '...',
      isDirectory: false,
      isHighlighted: false,
      isPlaceholder: true,
    };
  }

  // determine if directory (trailing / or has nested children)
  const isDirectory = name.endsWith('/') || nestedList !== undefined;
  const cleanName = name.endsWith('/') ? name.slice(0, -1) : name;

  // parse nested children if present
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

// parse children (unordered list) into structured entries
// handle both nested structure (<li>folder/<ul>...</ul></li>) &
// sibling structure (<li>folder/</li><ul>...</ul>)
function parseFileTreeChildren(children: ReactNode): FileTreeEntry[] {
  const entries: FileTreeEntry[] = [];
  const childArray = Children.toArray(children);

  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];

    if (!isValidElement(child)) {
      continue;
    }

    // handle <ul> wrapper - recursively process its children
    if (child.type === 'ul') {
      entries.push(
        ...parseFileTreeChildren(
          (child.props as { children?: ReactNode }).children
        )
      );
      continue;
    }

    // handle <li> items
    if (child.type === 'li') {
      const entry = parseLiElement(child);
      if (!entry) {
        continue;
      }

      // check if next sibling is a <ul> that should be this directory's children
      // handle the sibling pattern: <li>folder/</li><ul>...</ul>
      const nextChild = childArray[i + 1];
      if (
        entry.isDirectory &&
        !entry.children?.length &&
        isValidElement(nextChild) &&
        nextChild.type === 'ul'
      ) {
        entry.children = parseFileTreeChildren(
          (nextChild.props as { children?: ReactNode }).children
        );
        // skip the <ul> since we've processed it as children
        i++;
      }

      entries.push(entry);
    }
  }

  return entries;
}

// render a single file tree entry
function FileTreeItem({ entry }: { entry: FileTreeEntry }): ReactElement {
  if (entry.isPlaceholder) {
    return (
      <li className="mdx-preview-starlight-file-tree-placeholder">
        <span className="placeholder-dots">...</span>
      </li>
    );
  }

  if (entry.isDirectory) {
    return (
      <li className="mdx-preview-starlight-file-tree-directory">
        <details open>
          <summary className={entry.isHighlighted ? 'highlighted' : ''}>
            <span
              className="icon chevron"
              dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.chevron }}
            />
            <span
              className="icon folder"
              dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.folder }}
            />
            <span className="name">{entry.name}</span>
            {entry.comment && <span className="comment">{entry.comment}</span>}
          </summary>
          {entry.children && entry.children.length > 0 && (
            <ul>
              {entry.children.map((child, i) => (
                <FileTreeItem key={i} entry={child} />
              ))}
            </ul>
          )}
        </details>
      </li>
    );
  }

  return (
    <li
      className={cn(
        'mdx-preview-starlight-file-tree-file',
        entry.isHighlighted && 'highlighted'
      )}
    >
      <span
        className="icon file"
        dangerouslySetInnerHTML={{ __html: FILE_TREE_ICONS.file }}
      />
      <span className="name">{entry.name}</span>
      {entry.comment && <span className="comment">{entry.comment}</span>}
    </li>
  );
}

// file tree component - render a file/folder tree structure
export function FileTree({ children }: FileTreeProps): ReactElement {
  const entries = parseFileTreeChildren(children);

  return (
    <div className="mdx-preview-starlight-file-tree">
      <ul>
        {entries.map((entry, i) => (
          <FileTreeItem key={i} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

export default FileTree;
