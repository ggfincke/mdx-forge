// src/compiler/trusted/identifier.ts
// shared unique-identifier policy for trusted compiler output

// pick an unused identifier w/ the shared suffix policy & reserve binding sets
export const createUniqueIdentifier = (
  source: string | Set<string>,
  base: string
): string =>
{
  let name = base
  let counter = 1
  while (
    typeof source === 'string'
      ? new RegExp(`\\b${name}\\b`).test(source)
      : source.has(name)
  )
  {
    name = `${base}_${counter++}`
  }
  if (typeof source !== 'string')
  {
    source.add(name)
  }
  return name
}
