// src/components/registry/component-metadata.ts
// authoring metadata for registry-backed component shims

import {
  CALLOUT_TYPE_ALIASES,
  VALID_CALLOUT_TYPES,
} from '../../internal/callout';
import type {
  ComponentAuthoringMetadata,
  ComponentKey,
  ComponentOpenPropsPolicy,
} from './types';

const DOM_OPEN_PROPS: ComponentOpenPropsPolicy = {
  dom: true,
  dataAttributes: true,
  ariaAttributes: true,
  eventHandlers: true,
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

export const COMPONENT_METADATA = {
  'generic:Callout': {
    summary: 'Callout box w/ themed icon + title.',
    childrenKind: 'block',
    safeMode: { support: 'full' },
    cssDeps: ['generic'],
    aliasDocs: [
      { name: 'Alert', canonical: 'Callout' },
      { name: 'Admonition', canonical: 'Callout' },
    ],
    examples: [
      {
        code: '<Callout type="tip" title="Heads up">Body text</Callout>',
      },
    ],
    props: [
      {
        name: 'type',
        type: 'enum',
        values: VALID_CALLOUT_TYPES,
        valueAliases: CALLOUT_TYPE_ALIASES,
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
    openProps: DOM_OPEN_PROPS,
  },
  'generic:Collapsible': {
    summary: 'Expandable section w/ click-to-toggle header.',
    childrenKind: 'block',
    safeMode: { support: 'full' },
    cssDeps: ['generic'],
    aliasDocs: [
      { name: 'Accordion', canonical: 'Collapsible' },
      { name: 'Details', canonical: 'Collapsible' },
    ],
    examples: [
      {
        code: '<Collapsible title="Details">Hidden body</Collapsible>',
      },
    ],
    props: [
      {
        name: 'title',
        type: 'string',
        description: 'Header label; defaults to "Details".',
      },
      {
        name: 'summary',
        type: 'string',
        description: 'Alias for title; takes precedence when both set.',
      },
      {
        name: 'defaultOpen',
        type: 'boolean',
        description: 'Open on mount.',
      },
      {
        name: 'open',
        type: 'boolean',
        description: 'Alias for defaultOpen.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'generic:Tabs': {
    summary: 'Tab group. Wrap each panel in <TabItem>.',
    childrenKind: 'tabitems',
    safeMode: {
      support: 'fallback',
      fallback: 'Stacks tab panels and shows a Trusted Mode notice.',
    },
    cssDeps: ['generic'],
    examples: [
      {
        code:
          '<Tabs>\n' +
          '  <TabItem label="JS" value="js">js code</TabItem>\n' +
          '  <TabItem label="TS" value="ts">ts code</TabItem>\n' +
          '</Tabs>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'generic:TabItem': {
    summary: 'Single tab panel; nest inside <Tabs>.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders as a labeled static panel.',
    },
    cssDeps: ['generic'],
    aliasDocs: [{ name: 'Tab', canonical: 'TabItem' }],
    examples: [
      {
        code: '<TabItem label="First" value="first">body</TabItem>',
      },
    ],
    props: [
      {
        name: 'label',
        type: 'string',
        description: 'Visible tab label; falls back to value.',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Stable ID; defaults to label.',
      },
      {
        name: 'default',
        type: 'boolean',
        description: 'Select this tab initially.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'generic:CodeGroup': {
    summary: 'Wrap multiple code blocks into a tab group.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Stacks code blocks and shows a Trusted Mode notice.',
    },
    cssDeps: ['generic'],
    examples: [
      {
        code:
          '<CodeGroup>\n' +
          '```js title="file.js"\n' +
          'console.log(1)\n' +
          '```\n' +
          '```ts title="file.ts"\n' +
          'console.log(1)\n' +
          '```\n' +
          '</CodeGroup>',
      },
    ],
    props: [
      {
        name: 'labels',
        type: 'array',
        description: 'Override labels; defaults to title attribute.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'docusaurus:Tabs': {
    summary: 'Docusaurus-flavored tab group; supports groupId sync.',
    childrenKind: 'tabitems',
    safeMode: {
      support: 'fallback',
      fallback: 'Stacks tab panels through the generic Tabs transform.',
    },
    cssDeps: ['docusaurus'],
    examples: [
      {
        code:
          '<Tabs groupId="lang">\n' +
          '  <TabItem label="JS" value="js">js</TabItem>\n' +
          '  <TabItem label="TS" value="ts">ts</TabItem>\n' +
          '</Tabs>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'docusaurus:TabItem': {
    summary: 'Docusaurus tab panel.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders as a labeled static panel.',
    },
    cssDeps: ['docusaurus'],
    examples: [
      {
        code: '<TabItem label="First" value="first">body</TabItem>',
      },
    ],
    props: [
      {
        name: 'label',
        type: 'string',
        description: 'Visible tab label; defaults to value.',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Stable tab identifier.',
      },
      {
        name: 'default',
        type: 'boolean',
        description: 'Select this tab initially.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'docusaurus:CodeBlock': {
    summary: 'Docusaurus highlighted code block w/ optional title.',
    childrenKind: 'text',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['docusaurus'],
    examples: [
      {
        code:
          '<CodeBlock language="js" title="file.js">' +
          'console.log(1)</CodeBlock>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'docusaurus:Details': {
    summary: 'Docusaurus disclosure wrapper (renders <details>).',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders through the generic Details transform.',
    },
    cssDeps: ['docusaurus'],
    examples: [
      {
        code: '<Details summary="Click me">body</Details>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:Card': {
    summary: 'Starlight card w/ icon + title.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<Card title="Fast" icon="rocket">Body</Card>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:CardGrid': {
    summary: 'Responsive grid for Card / LinkCard.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code:
          '<CardGrid>\n' +
          '  <Card title="A">...</Card>\n' +
          '  <Card title="B">...</Card>\n' +
          '</CardGrid>',
      },
    ],
    props: [
      {
        name: 'stagger',
        type: 'boolean',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:LinkCard': {
    summary: 'Clickable card linking to a destination.',
    childrenKind: 'none',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<LinkCard title="Docs" href="/docs" description="Get started" />',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:Steps': {
    summary: 'Numbered step list; wrap an <ol>.',
    childrenKind: 'steps',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<Steps>\n  1. First\n  2. Second\n</Steps>',
      },
    ],
    props: [],
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:Badge': {
    summary: 'Inline status badge.',
    childrenKind: 'none',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<Badge text="New" variant="success" />',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:Aside': {
    summary: 'Starlight aside/admonition; JSX alternative to ::: directives.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<Aside type="tip" title="Heads up">Body</Aside>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:Tabs': {
    summary: 'Starlight tab group.',
    childrenKind: 'tabitems',
    safeMode: {
      support: 'fallback',
      fallback: 'Stacks tab panels through the generic Tabs transform.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code:
          '<Tabs>\n' +
          '  <TabItem label="JS" value="js">js</TabItem>\n' +
          '  <TabItem label="TS" value="ts">ts</TabItem>\n' +
          '</Tabs>',
      },
    ],
    props: [
      {
        name: 'syncKey',
        type: 'string',
        description: 'Sync across pages.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:TabItem': {
    summary: 'Starlight tab panel.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders as a labeled static panel.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<TabItem label="First" value="first">body</TabItem>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:FileTree': {
    summary: 'Render a list as a file/directory tree.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<FileTree>\n  - src\n    - index.ts\n</FileTree>',
      },
    ],
    props: [],
    openProps: DOM_OPEN_PROPS,
  },
  'starlight:Code': {
    summary: 'Starlight syntax-highlighted code block.',
    childrenKind: 'none',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['starlight'],
    examples: [
      {
        code: '<Code code="console.log(1)" lang="js" />',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'nextjs:Image': {
    summary: 'Next.js image; preview falls back to <img> (no optimization).',
    childrenKind: 'none',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    examples: [
      {
        code: '<Image src="/hero.png" alt="Hero" width={800} height={400} />',
      },
    ],
    props: [
      {
        name: 'src',
        type: 'union',
        required: true,
        description: 'Image path string or static import object.',
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
      {
        name: 'blurDataURL',
        type: 'string',
      },
      {
        name: 'unoptimized',
        type: 'boolean',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'nextjs:Link': {
    summary: 'Next.js link; preview renders as <a>.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    examples: [
      {
        code: '<Link href="/docs">Docs</Link>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'nextra:Callout': {
    summary: 'Nextra callout; no title, icon comes from `emoji` or type.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders through the generic Callout transform.',
    },
    cssDeps: ['nextra'],
    examples: [
      {
        code: '<Callout type="warning">Watch out</Callout>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'nextra:Tabs': {
    summary: 'Nextra tabs; uses `items` prop + <Tabs.Tab> children.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders the top-level Tabs wrapper only.',
    },
    cssDeps: ['nextra'],
    examples: [
      {
        code:
          '<Tabs items={["JS", "TS"]}>\n' +
          '  <Tabs.Tab>js</Tabs.Tab>\n' +
          '  <Tabs.Tab>ts</Tabs.Tab>\n' +
          '</Tabs>',
      },
    ],
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
    openProps: DOM_OPEN_PROPS,
  },
  'nextra:Cards': {
    summary: 'Nextra card grid.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['nextra'],
    examples: [
      {
        code:
          '<Cards>\n' +
          '  <Cards.Card title="A" href="/a" />\n' +
          '  <Cards.Card title="B" href="/b" />\n' +
          '</Cards>',
      },
    ],
    props: [
      {
        name: 'num',
        type: 'number',
        description: 'Cards per row.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  'nextra:FileTree': {
    summary: 'Nextra file/folder tree.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['nextra'],
    examples: [
      {
        code:
          '<FileTree>\n' +
          '  <FileTree.Folder name="src" defaultOpen>\n' +
          '    <FileTree.File name="index.ts" />\n' +
          '  </FileTree.Folder>\n' +
          '</FileTree>',
      },
    ],
    props: [],
    openProps: DOM_OPEN_PROPS,
  },
  'nextra:Steps': {
    summary: 'Nextra numbered steps (wraps heading hierarchy).',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['nextra'],
    examples: [
      {
        code: '<Steps>\n### Step 1\nDo this\n### Step 2\nDo that\n</Steps>',
      },
    ],
    props: [],
    openProps: DOM_OPEN_PROPS,
  },
  'nextra:Bleed': {
    summary: 'Break out of content width.',
    childrenKind: 'block',
    safeMode: {
      support: 'unsupported',
      fallback: 'Renders as an unknown component placeholder.',
    },
    cssDeps: ['nextra'],
    examples: [
      {
        code: '<Bleed full>Full-bleed content</Bleed>',
      },
    ],
    props: [
      {
        name: 'full',
        type: 'boolean',
        description: 'Edge-to-edge bleed.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
} as const satisfies Record<ComponentKey, ComponentAuthoringMetadata>;
