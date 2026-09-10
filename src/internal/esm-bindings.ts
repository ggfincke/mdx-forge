// src/internal/esm-bindings.ts
// collect authored module bindings for diagnostics & compiler identifiers

import type {
  ClassDeclaration,
  Declaration,
  ExportDefaultDeclaration,
  FunctionDeclaration,
  Identifier,
  Pattern,
  Program,
  VariableDeclaration,
} from 'estree'

export interface MdxBindings
{
  imports: ReadonlySet<string>
  locals: ReadonlySet<string>
}

export function collectMdxBindings(program: Program): MdxBindings
{
  const imports = new Set<string>()
  const locals = new Set<string>()
  for (const statement of program.body)
  {
    if (statement.type === 'ImportDeclaration')
    {
      for (const specifier of statement.specifiers)
      {
        imports.add(specifier.local.name)
      }
    }
    else if (statement.type === 'ExportNamedDeclaration')
    {
      collectDeclarationBindings(statement.declaration, locals)
    }
    else if (statement.type === 'ExportDefaultDeclaration')
    {
      collectDefaultExportBinding(statement, locals)
    }
    else if (
      statement.type === 'VariableDeclaration' ||
      statement.type === 'FunctionDeclaration' ||
      statement.type === 'ClassDeclaration'
    )
    {
      collectDeclarationBindings(statement, locals)
    }
  }
  return { imports, locals }
}

function collectDefaultExportBinding(
  stmt: ExportDefaultDeclaration,
  bindings: Set<string>
): void
{
  const declaration = stmt.declaration
  if (
    (declaration.type === 'FunctionDeclaration' ||
      declaration.type === 'ClassDeclaration') &&
    isIdentifier(declaration.id)
  )
  {
    bindings.add(declaration.id.name)
  }
}

function collectDeclarationBindings(
  declaration: Declaration | null | undefined,
  bindings: Set<string>
): void
{
  if (!declaration)
  {
    return
  }
  if (declaration.type === 'VariableDeclaration')
  {
    collectVariableBindings(declaration, bindings)
    return
  }
  if (isNamedDeclaration(declaration))
  {
    bindings.add(declaration.id.name)
  }
}

function collectVariableBindings(
  declaration: VariableDeclaration,
  bindings: Set<string>
): void
{
  for (const variable of declaration.declarations)
  {
    collectPatternBindings(variable.id, bindings)
  }
}

function collectPatternBindings(pattern: Pattern, bindings: Set<string>): void
{
  switch (pattern.type)
  {
    case 'Identifier':
      bindings.add(pattern.name)
      break
    case 'ObjectPattern':
      for (const property of pattern.properties)
      {
        collectPatternBindings(
          property.type === 'RestElement' ? property.argument : property.value,
          bindings
        )
      }
      break
    case 'ArrayPattern':
      for (const element of pattern.elements)
      {
        if (element)
        {
          collectPatternBindings(element, bindings)
        }
      }
      break
    case 'RestElement':
      collectPatternBindings(pattern.argument, bindings)
      break
    case 'AssignmentPattern':
      collectPatternBindings(pattern.left, bindings)
      break
  }
}

function isNamedDeclaration(
  declaration: Declaration | null | undefined
): declaration is FunctionDeclaration | ClassDeclaration
{
  return (
    (declaration?.type === 'FunctionDeclaration' ||
      declaration?.type === 'ClassDeclaration') &&
    isIdentifier(declaration.id)
  )
}

function isIdentifier(node: unknown): node is Identifier
{
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'Identifier' &&
    'name' in node &&
    typeof node.name === 'string'
  )
}
