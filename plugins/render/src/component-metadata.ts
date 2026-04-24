// plugins/render/src/component-metadata.ts
// plugin-only prop, example, & list_components metadata by core component key

import type { ComponentKey, ComponentMetadata } from './registry-types.js';

const CALLOUT_TYPES_GENERIC = [
  'note',
  'tip',
  'warning',
  'danger',
  'info',
  'caution',
  'important',
] as const;

const CALLOUT_ALIASES_GENERIC: Record<string, string> = {
  error: 'danger',
  warn: 'warning',
  success: 'tip',
  hint: 'tip',
};

const NEXTRA_CALLOUT_TYPES = [
  'default',
  'info',
  'warning',
  'error',
  'important',
] as const;

const STARLIGHT_ASIDE_TYPES = ['note', 'tip', 'caution', 'danger'] as const;

const STARLIGHT_BADGE_VARIANTS = [
  'note',
  'tip',
  'caution',
  'danger',
  'success',
  'default',
] as const;

const STARLIGHT_BADGE_SIZES = ['small', 'medium', 'large'] as const;

const COMPONENT_METADATA_DATA = {
  'generic:Callout': {
    summary: 'Callout box w/ themed icon + title.',
    example: '<Callout type="tip" title="Heads up">Body text</Callout>',
    childrenKind: 'block',
    props: [
      {
        name: 'type',
        type: 'enum',
        values: CALLOUT_TYPES_GENERIC,
        valueAliases: CALLOUT_ALIASES_GENERIC,
        description: 'Visual variant.',
      },
      {
        name: 'title',
        type: 'string',
        description: 'Header text; defaults to type label.',
      },
      {
        name: 'icon',
        type: 'node',
        description: 'Custom icon override.',
      },
    ],
  },
  'generic:Collapsible': {
    summary: 'Expandable section w/ click-to-toggle header.',
    example: '<Collapsible title="Details">Hidden body</Collapsible>',
    childrenKind: 'block',
    props: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Header label.',
      },
      {
        name: 'defaultOpen',
        type: 'boolean',
        description: 'Open on mount.',
      },
      {
        name: 'summary',
        type: 'string',
        description: 'Alias for title.',
      },
    ],
  },
  'generic:Tabs': {
    summary: 'Tab group. Wrap each panel in <TabItem>.',
    example:
      '<Tabs>\n  <TabItem label="JS" value="js">js code</TabItem>\n  <TabItem label="TS" value="ts">ts code</TabItem>\n</Tabs>',
    childrenKind: 'tabitems',
    props: [
      {
        name: 'defaultValue',
        type: 'string',
        description: 'Initially-selected tab value.',
      },
      {
        name: 'values',
        type: 'array',
        description:
          'Explicit tab list; overrides derivation from TabItem children.',
      },
      {
        name: 'className',
        type: 'string',
      },
      {
        name: 'groupId',
        type: 'string',
        description: 'Sync selection across groups w/ same ID.',
      },
    ],
  },
  'generic:TabItem': {
    summary: 'Single tab panel; nest inside <Tabs>.',
    example: '<TabItem label="First" value="first">body</TabItem>',
    childrenKind: 'block',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Visible tab label.',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Stable ID; defaults to label.',
      },
    ],
  },
  'generic:CodeGroup': {
    summary: 'Wrap multiple code blocks into a tab group.',
    example:
      '<CodeGroup>\n```js title="file.js"\nconsole.log(1)\n```\n```ts title="file.ts"\nconsole.log(1)\n```\n</CodeGroup>',
    childrenKind: 'block',
    props: [
      {
        name: 'labels',
        type: 'array',
        description: 'Override labels; defaults to title attribute.',
      },
    ],
  },
  'docusaurus:Tabs': {
    summary: 'Docusaurus-flavored tab group; supports groupId sync.',
    example:
      '<Tabs groupId="lang">\n  <TabItem label="JS" value="js">js</TabItem>\n  <TabItem label="TS" value="ts">ts</TabItem>\n</Tabs>',
    childrenKind: 'tabitems',
    props: [
      {
        name: 'defaultValue',
        type: 'string',
      },
      {
        name: 'values',
        type: 'array',
      },
      {
        name: 'groupId',
        type: 'string',
      },
      {
        name: 'queryString',
        type: 'string',
      },
    ],
  },
  'docusaurus:TabItem': {
    summary: 'Docusaurus tab panel.',
    example: '<TabItem label="First" value="first">body</TabItem>',
    childrenKind: 'block',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
      },
      {
        name: 'value',
        type: 'string',
      },
    ],
  },
  'docusaurus:CodeBlock': {
    summary: 'Docusaurus highlighted code block w/ optional title.',
    example:
      '<CodeBlock language="js" title="file.js">console.log(1)</CodeBlock>',
    childrenKind: 'text',
    props: [
      {
        name: 'language',
        type: 'string',
      },
      {
        name: 'title',
        type: 'string',
      },
      {
        name: 'showLineNumbers',
        type: 'boolean',
      },
    ],
  },
  'docusaurus:Details': {
    summary: 'Docusaurus disclosure wrapper (renders <details>).',
    example: '<Details summary="Click me">body</Details>',
    childrenKind: 'block',
    props: [
      {
        name: 'summary',
        type: 'string',
      },
      {
        name: 'open',
        type: 'boolean',
      },
    ],
  },
  'starlight:Card': {
    summary: 'Starlight card w/ icon + title.',
    example: '<Card title="Fast" icon="rocket">Body</Card>',
    childrenKind: 'block',
    props: [
      {
        name: 'title',
        type: 'string',
        required: true,
      },
      {
        name: 'icon',
        type: 'string',
        description: 'Icon name (star, rocket, document, ...).',
      },
    ],
  },
  'starlight:CardGrid': {
    summary: 'Responsive grid for Card / LinkCard.',
    example:
      '<CardGrid>\n  <Card title="A">...</Card>\n  <Card title="B">...</Card>\n</CardGrid>',
    childrenKind: 'block',
    props: [
      {
        name: 'stagger',
        type: 'boolean',
      },
    ],
  },
  'starlight:LinkCard': {
    summary: 'Clickable card linking to a destination.',
    example: '<LinkCard title="Docs" href="/docs" description="Get started" />',
    childrenKind: 'none',
    props: [
      {
        name: 'title',
        type: 'string',
        required: true,
      },
      {
        name: 'href',
        type: 'string',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
      },
    ],
  },
  'starlight:Steps': {
    summary: 'Numbered step list; wrap an <ol>.',
    example: '<Steps>\n  1. First\n  2. Second\n</Steps>',
    childrenKind: 'steps',
    props: [],
  },
  'starlight:Badge': {
    summary: 'Inline status badge.',
    example: '<Badge text="New" variant="success" />',
    childrenKind: 'none',
    props: [
      {
        name: 'text',
        type: 'node',
        required: true,
      },
      {
        name: 'variant',
        type: 'enum',
        values: STARLIGHT_BADGE_VARIANTS,
        description: 'Color variant.',
      },
      {
        name: 'size',
        type: 'enum',
        values: STARLIGHT_BADGE_SIZES,
      },
    ],
  },
  'starlight:Aside': {
    summary: 'Starlight aside/admonition; JSX alternative to ::: directives.',
    example: '<Aside type="tip" title="Heads up">Body</Aside>',
    childrenKind: 'block',
    props: [
      {
        name: 'type',
        type: 'enum',
        values: STARLIGHT_ASIDE_TYPES,
      },
      {
        name: 'title',
        type: 'string',
      },
    ],
  },
  'starlight:Tabs': {
    summary: 'Starlight tab group.',
    example:
      '<Tabs>\n  <TabItem label="JS" value="js">js</TabItem>\n  <TabItem label="TS" value="ts">ts</TabItem>\n</Tabs>',
    childrenKind: 'tabitems',
    props: [
      {
        name: 'syncKey',
        type: 'string',
        description: 'Sync across pages.',
      },
    ],
  },
  'starlight:TabItem': {
    summary: 'Starlight tab panel.',
    example: '<TabItem label="First" value="first">body</TabItem>',
    childrenKind: 'block',
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
      },
      {
        name: 'value',
        type: 'string',
      },
      {
        name: 'icon',
        type: 'string',
      },
    ],
  },
  'starlight:FileTree': {
    summary: 'Render a list as a file/directory tree.',
    example: '<FileTree>\n  - src\n    - index.ts\n</FileTree>',
    childrenKind: 'block',
    props: [],
  },
  'starlight:Code': {
    summary: 'Starlight syntax-highlighted code block.',
    example: '<Code code="console.log(1)" lang="js" />',
    childrenKind: 'none',
    props: [
      {
        name: 'code',
        type: 'string',
        required: true,
      },
      {
        name: 'lang',
        type: 'string',
      },
      {
        name: 'title',
        type: 'string',
      },
    ],
  },
  'nextjs:Image': {
    summary: 'Next.js image; preview falls back to <img> (no optimization).',
    example: '<Image src="/hero.png" alt="Hero" width={800} height={400} />',
    childrenKind: 'none',
    props: [
      {
        name: 'src',
        type: 'string',
        required: true,
      },
      {
        name: 'alt',
        type: 'string',
        required: true,
      },
      {
        name: 'width',
        type: 'number',
      },
      {
        name: 'height',
        type: 'number',
      },
      {
        name: 'fill',
        type: 'boolean',
      },
      {
        name: 'priority',
        type: 'boolean',
      },
      {
        name: 'placeholder',
        type: 'enum',
        values: ['blur', 'empty'],
      },
      {
        name: 'sizes',
        type: 'string',
      },
      {
        name: 'quality',
        type: 'number',
      },
    ],
  },
  'nextjs:Link': {
    summary: 'Next.js link; preview renders as <a>.',
    example: '<Link href="/docs">Docs</Link>',
    childrenKind: 'block',
    props: [
      {
        name: 'href',
        type: 'string',
        required: true,
      },
      {
        name: 'replace',
        type: 'boolean',
      },
      {
        name: 'scroll',
        type: 'boolean',
      },
      {
        name: 'prefetch',
        type: 'boolean',
      },
    ],
  },
  'nextra:Callout': {
    summary: 'Nextra callout; no title, icon comes from `emoji` or type.',
    example: '<Callout type="warning">Watch out</Callout>',
    childrenKind: 'block',
    props: [
      {
        name: 'type',
        type: 'enum',
        values: NEXTRA_CALLOUT_TYPES,
      },
      {
        name: 'emoji',
        type: 'node',
        description: 'Custom icon.',
      },
    ],
  },
  'nextra:Tabs': {
    summary: 'Nextra tabs; uses `items` prop + <Tabs.Tab> children.',
    example:
      '<Tabs items={["JS", "TS"]}>\n  <Tabs.Tab>js</Tabs.Tab>\n  <Tabs.Tab>ts</Tabs.Tab>\n</Tabs>',
    childrenKind: 'block',
    props: [
      {
        name: 'items',
        type: 'array',
        required: true,
      },
      {
        name: 'defaultIndex',
        type: 'number',
      },
      {
        name: 'selectedIndex',
        type: 'number',
      },
      {
        name: 'storageKey',
        type: 'string',
      },
    ],
  },
  'nextra:Cards': {
    summary: 'Nextra card grid.',
    example:
      '<Cards>\n  <Cards.Card title="A" href="/a" />\n  <Cards.Card title="B" href="/b" />\n</Cards>',
    childrenKind: 'block',
    props: [
      {
        name: 'num',
        type: 'number',
        description: 'Cards per row.',
      },
    ],
  },
  'nextra:FileTree': {
    summary: 'Nextra file/folder tree.',
    example:
      '<FileTree>\n  <FileTree.Folder name="src" defaultOpen>\n    <FileTree.File name="index.ts" />\n  </FileTree.Folder>\n</FileTree>',
    childrenKind: 'block',
    props: [],
  },
  'nextra:Steps': {
    summary: 'Nextra numbered steps (wraps heading hierarchy).',
    example: '<Steps>\n### Step 1\nDo this\n### Step 2\nDo that\n</Steps>',
    childrenKind: 'block',
    props: [],
  },
  'nextra:Bleed': {
    summary: 'Break out of content width.',
    example: '<Bleed full>Full-bleed content</Bleed>',
    childrenKind: 'block',
    props: [
      {
        name: 'full',
        type: 'boolean',
        description: 'Edge-to-edge bleed.',
      },
    ],
  },
} as const satisfies Partial<Record<ComponentKey, ComponentMetadata>>;

export const COMPONENT_METADATA: Readonly<
  Partial<Record<ComponentKey, ComponentMetadata>>
> = COMPONENT_METADATA_DATA;
