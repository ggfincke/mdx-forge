// skills/mdx-forge/examples/framework-shim.tsx
// using framework component shims in a host React tree
//
// every framework subpath has a matching CSS bundle (except nextjs)
// import the CSS once at app entry — bundlers respect mdx-forge's `sideEffects`
// declaration so this is the only side-effecting import you need

// generic CSS is required if you use ANY shim — it provides shared tokens
import 'mdx-forge/components/styles/tokens.css';
import 'mdx-forge/components/styles/generic.css';

// pick the framework whose visual style you want
import 'mdx-forge/components/styles/docusaurus.css';

// import shims from the matching subpath
import { Tabs, TabItem, CodeBlock } from 'mdx-forge/components/docusaurus';

// generic primitives are also available — useful for Callout / CodeGroup / etc.
import { Callout } from 'mdx-forge/components/generic';

export function Demo() {
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
  );
}

// per-framework component inventory:
// - mdx-forge/components/docusaurus  -> Tabs, TabItem, CodeBlock, Details
// - mdx-forge/components/starlight   -> Card, CardGrid, LinkCard, Steps,
//                                       Badge, Aside, Tabs, TabItem,
//                                       FileTree, Code
// - mdx-forge/components/nextra      -> Callout, Tabs, Cards, FileTree,
//                                       Steps, Bleed
// - mdx-forge/components/nextjs      -> Image, Link
// - mdx-forge/components/generic     -> Callout, Alert, Admonition,
//                                       Collapsible, Accordion, Tabs,
//                                       TabItem, Tab, CodeGroup
