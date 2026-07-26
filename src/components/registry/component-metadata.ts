// src/components/registry/component-metadata.ts
// authoring metadata for registry-backed component shims

import {
  CALLOUT_TYPE_ALIASES,
  VALID_CALLOUT_TYPES,
} from '../../internal/callout';
import {
  ASIDE_TYPES,
  BADGE_SIZES,
  BADGE_VARIANTS,
  NEXTRA_CALLOUT_TYPES,
} from '../internal/metadata';
import {
  COMPONENT_IDENTITY_DEFINITIONS,
  type ComponentIdentityDefinition,
  type ComponentIdentityEntry,
  type ComponentIdentityTuple,
} from '../internal/component-identity';
import { deepFreeze } from './freeze';
import type {
  ComponentAuthoringMetadata,
  ComponentOpenPropsPolicy,
} from './types';

const DOM_OPEN_PROPS: ComponentOpenPropsPolicy = {
  dom: true,
  dataAttributes: true,
  ariaAttributes: true,
  eventHandlers: true,
};

type AliasDocsFor<Identity extends ComponentIdentityEntry> = readonly {
  readonly name: Identity['aliases'][number];
  readonly canonical: Identity['name'];
}[];

type MetadataForIdentity<
  Identity extends ComponentIdentityEntry,
  Metadata extends ComponentAuthoringMetadata,
> = Metadata &
  (Identity['aliases'] extends readonly []
    ? unknown
    : { readonly aliasDocs: AliasDocsFor<Identity> });

type MetadataRecordFor<
  Identities extends readonly ComponentIdentityDefinition[],
  Metadata extends readonly ComponentAuthoringMetadata[],
> = Identities extends readonly [
  infer Identity extends ComponentIdentityEntry,
  ...infer RemainingIdentities extends readonly ComponentIdentityDefinition[],
]
  ? Metadata extends readonly [
      infer AuthoringMetadata extends ComponentAuthoringMetadata,
      ...infer RemainingMetadata extends readonly ComponentAuthoringMetadata[],
    ]
    ? {
        readonly [
          Key in `${Identity['framework']}:${Identity['name']}`
        ]: MetadataForIdentity<Identity, AuthoringMetadata>;
      } & MetadataRecordFor<RemainingIdentities, RemainingMetadata>
    : never
  : object;

const COMPONENT_AUTHORING_METADATA = deepFreeze([
  {
    summary: 'Callout box w/ themed icon + title.',
    childrenKind: 'block',
    safeMode: { support: 'full' },
    cssDeps: ['generic'],
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
  {
    summary: 'Expandable section w/ click-to-toggle header.',
    childrenKind: 'block',
    safeMode: { support: 'full' },
    cssDeps: ['generic'],
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
        description: 'Initial open state; takes precedence over defaultOpen.',
      },
      {
        name: 'className',
        type: 'string',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
        description:
          'Sync selection across groups w/ same ID; persists to localStorage.',
      },
      {
        name: 'lazy',
        type: 'boolean',
        description: 'Mount only the selected panel.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
    summary: 'Single tab panel; nest inside <Tabs>.',
    childrenKind: 'block',
    safeMode: {
      support: 'fallback',
      fallback: 'Renders as a labeled static panel.',
    },
    cssDeps: ['generic'],
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
  {
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
  {
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
        description:
          'Sync selection across groups w/ same ID; persists to localStorage.',
      },
      {
        name: 'queryString',
        type: 'union',
        description:
          'Sync selection w/ the URL; true derives the param name from ' +
          'groupId, a string names the param explicitly.',
      },
      {
        name: 'lazy',
        type: 'boolean',
        description: 'Mount only the selected panel.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
        values: BADGE_VARIANTS,
        description: 'Color variant.',
      },
      {
        name: 'size',
        type: 'enum',
        values: BADGE_SIZES,
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
        values: ASIDE_TYPES,
      },
      {
        name: 'title',
        type: 'string',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
        name: 'defaultValue',
        type: 'string',
      },
      {
        name: 'values',
        type: 'array',
      },
      {
        name: 'syncKey',
        type: 'string',
        description:
          'Sync & persist selection across tab groups w/ the same key.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
        description:
          'Starlight icon name (star, rocket, document, ...); rendered ' +
          'as an emoji equivalent in the preview.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
  {
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
        name: 'language',
        type: 'string',
        description: 'Alias for lang.',
      },
      {
        name: 'title',
        type: 'string',
      },
      {
        name: 'frame',
        type: 'enum',
        values: ['auto', 'code', 'terminal', 'none'],
        description: 'Frame chrome; auto picks terminal for shell languages.',
      },
      {
        name: 'showLineNumbers',
        type: 'boolean',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
      {
        name: 'loader',
        type: 'function',
        description: 'Resolve the source URL from src, width, & quality.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
        type: 'union',
        required: true,
        description: 'URL string or pathname/query/hash object.',
      },
      {
        name: 'as',
        type: 'string',
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
      {
        name: 'shallow',
        type: 'boolean',
      },
      {
        name: 'passHref',
        type: 'boolean',
      },
      {
        name: 'locale',
        type: 'union',
      },
      {
        name: 'legacyBehavior',
        type: 'boolean',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
  {
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
      {
        name: 'onChange',
        type: 'function',
      },
      {
        name: 'className',
        type: 'union',
        description: 'Class string or selected-index render callback.',
      },
      {
        name: 'tabClassName',
        type: 'union',
        description: 'Class string or Headless UI-style render callback.',
      },
    ],
    openProps: DOM_OPEN_PROPS,
  },
  {
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
  {
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
  {
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
  {
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
] as const satisfies readonly ComponentAuthoringMetadata[] & {
  readonly length: ComponentIdentityTuple['length'];
});

function buildComponentMetadata(): Record<string, ComponentAuthoringMetadata> {
  const identities = COMPONENT_IDENTITY_DEFINITIONS.filter(
    (definition): definition is ComponentIdentityEntry =>
      definition.kind === 'component'
  );
  const metadata: Record<string, ComponentAuthoringMetadata> = {};

  for (const [index, identity] of identities.entries()) {
    const authoringMetadata = COMPONENT_AUTHORING_METADATA[index];
    const { examples, props, openProps, ...leadingMetadata } =
      authoringMetadata;
    metadata[`${identity.framework}:${identity.name}`] = {
      ...leadingMetadata,
      ...(identity.aliases.length > 0
        ? {
            aliasDocs: identity.aliases.map((name) => ({
              name,
              canonical: identity.name,
            })),
          }
        : {}),
      examples,
      props,
      ...(openProps === undefined ? {} : { openProps }),
    };
  }

  return metadata;
}

export const COMPONENT_METADATA = deepFreeze(
  buildComponentMetadata()
) as MetadataRecordFor<
  ComponentIdentityTuple,
  typeof COMPONENT_AUTHORING_METADATA
>;
