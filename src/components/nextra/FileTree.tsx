// src/components/nextra/FileTree.tsx
// nextra FileTree shim w/ compound Folder & File statics

import React, {
  Children,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  BaseFileTree,
  BaseFileTreeFile,
  BaseFileTreeFolder,
  renderBaseFileTreeChildren,
} from '../base/BaseFileTree'
import { cn } from '../internal/cn'

export interface FileTreeFolderProps
{
  name: string
  defaultOpen?: boolean
  children?: ReactNode
}

export interface FileTreeFileProps
{
  name: string
}

export type FileTreeProps = HTMLAttributes<HTMLUListElement> & {
  children: ReactNode
}

type NamedComponent<Props> = ((props: Props) => ReactElement) & {
  displayName: string
}

function Folder({
  name,
  defaultOpen = false,
  children,
}: FileTreeFolderProps): ReactElement
{
  return (
    <BaseFileTreeFolder name={name} open={defaultOpen}>
      {children}
    </BaseFileTreeFolder>
  )
}

;(Folder as NamedComponent<FileTreeFolderProps>).displayName =
  'NextraFileTreeFolder'

function File({ name }: FileTreeFileProps): ReactElement
{
  return <BaseFileTreeFile name={name} />
}

;(File as NamedComponent<FileTreeFileProps>).displayName = 'NextraFileTreeFile'

function hasCompoundChildren(children: ReactNode): boolean
{
  return Children.toArray(children).some(
    (child) =>
      isValidElement(child) && (child.type === Folder || child.type === File)
  )
}

function NextraFileTree({
  children,
  className,
  ...props
}: FileTreeProps): ReactElement
{
  const content = hasCompoundChildren(children)
    ? children
    : renderBaseFileTreeChildren(children)

  return (
    <div className={cn('mdx-preview-nextra-file-tree')}>
      <BaseFileTree {...props} className={className}>
        {content}
      </BaseFileTree>
    </div>
  )
}

;(NextraFileTree as NamedComponent<FileTreeProps>).displayName =
  'NextraFileTree'

export const FileTree: NamedComponent<FileTreeProps> & {
  Folder: NamedComponent<FileTreeFolderProps>
  File: NamedComponent<FileTreeFileProps>
} = Object.assign(NextraFileTree as NamedComponent<FileTreeProps>, {
  Folder: Folder as NamedComponent<FileTreeFolderProps>,
  File: File as NamedComponent<FileTreeFileProps>,
})

export default FileTree
