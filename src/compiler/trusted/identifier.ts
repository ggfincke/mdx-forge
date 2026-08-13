// src/compiler/trusted/identifier.ts
// shared unique-identifier policy for trusted compiler output

// pick an identifier absent from generated source w/ the shared suffix policy
export const createUniqueIdentifier = (
  source: string,
  base: string
): string =>
{
  let name = base
  let counter = 1
  while (new RegExp(`\\b${name}\\b`).test(source))
  {
    name = `${base}_${counter++}`
  }
  return name
}
