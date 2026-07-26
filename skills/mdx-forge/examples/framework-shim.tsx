// skills/mdx-forge/examples/framework-shim.tsx
// using framework component shims in a host React tree

// every framework subpath has a matching CSS bundle except nextjs
// import CSS once at app entry; bundlers respect mdx-forge's `sideEffects`
// declaration, so no other side-effecting import is needed

// generic CSS is required if you use ANY shim — it provides shared tokens
import 'mdx-forge/components/styles/tokens.css'
import 'mdx-forge/components/styles/generic.css'

// pick the framework whose visual style you want
import 'mdx-forge/components/styles/docusaurus.css'

// import shims from the matching subpath
import { Tabs, TabItem, CodeBlock } from 'mdx-forge/components/docusaurus'

// generic primitives also provide Callout, CodeGroup & others
import { Callout } from 'mdx-forge/components/generic'

export function Demo()
{
  return (
    <div>
      <Callout type="info">
        Generic Callout works alongside framework-specific shims.
      </Callout>

      <Tabs>
        <TabItem value="js" label="JavaScript">
          <CodeBlock language="js">{`console.log('hi');`}</CodeBlock>
        </TabItem>
        <TabItem value="ts" label="TypeScript">
          <CodeBlock language="ts">{`const x: number = 1;`}</CodeBlock>
        </TabItem>
      </Tabs>
    </div>
  )
}

// per-framework component inventory
// subpaths use `mdx-forge/components/<framework>`
// docusaurus -> Tabs, TabItem, CodeBlock, Details

// starlight -> Card, CardGrid, LinkCard, Steps, Badge, Aside, Tabs, TabItem,
// FileTree, Code

// nextra -> Callout, Tabs, Cards, FileTree, Steps, Bleed
// nextjs -> Image, Link

// generic -> Callout, Alert, Admonition, Collapsible, Accordion, Tabs,
// TabItem, Tab, CodeGroup
