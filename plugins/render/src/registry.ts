// component + frontmatter metadata for list_components, prop lint, &
// frontmatter validation. authored plugin-side because mdx-forge core
// doesn't encode prop shapes — it only encodes names + import specifiers.

import type { Framework } from './css.js';

export type FrameworkId = Framework;

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'node'
  | 'enum';

export interface PropSpec {
  name: string;
  type: PropType;
  required?: boolean;
  // enum values when type === 'enum'
  values?: readonly string[];
  description?: string;
  // value accepts these string aliases in addition to the declared values
  valueAliases?: Readonly<Record<string, string>>;
  deprecated?: boolean;
  deprecatedIn?: string;
}

export type ChildrenKind = 'none' | 'text' | 'block' | 'tabitems' | 'steps';

export interface ComponentSpec {
  framework: FrameworkId;
  name: string;
  aliases?: readonly string[];
  importSpecifier?: string;
  summary: string;
  example: string;
  props: readonly PropSpec[];
  childrenKind?: ChildrenKind;
}

export type FrontmatterFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object';

export interface FrontmatterField {
  name: string;
  type: FrontmatterFieldType;
  required?: boolean;
  description?: string;
  values?: readonly string[];
}

export interface FrontmatterSchema {
  framework: FrameworkId;
  fields: readonly FrontmatterField[];
  // unknown fields are accepted by default (frontmatter is open-ended) —
  // we only warn on known-field type mismatches
  allowUnknown?: boolean;
}

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

const COMPONENTS: readonly ComponentSpec[] = [
  // generic
  {
    framework: 'generic',
    name: 'Callout',
    aliases: ['Alert', 'Admonition'],
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
      { name: 'title', type: 'string', description: 'Header text; defaults to type label.' },
      { name: 'icon', type: 'node', description: 'Custom icon override.' },
    ],
  },
  {
    framework: 'generic',
    name: 'Collapsible',
    aliases: ['Accordion'],
    summary: 'Expandable section w/ click-to-toggle header.',
    example: '<Collapsible title="Details">Hidden body</Collapsible>',
    childrenKind: 'block',
    props: [
      { name: 'title', type: 'string', required: true, description: 'Header label.' },
      { name: 'defaultOpen', type: 'boolean', description: 'Open on mount.' },
      { name: 'summary', type: 'string', description: 'Alias for title.' },
    ],
  },
  {
    framework: 'generic',
    name: 'Tabs',
    summary: 'Tab group. Wrap each panel in <TabItem>.',
    example:
      '<Tabs>\n  <TabItem label="JS" value="js">js code</TabItem>\n  <TabItem label="TS" value="ts">ts code</TabItem>\n</Tabs>',
    childrenKind: 'tabitems',
    props: [
      { name: 'defaultValue', type: 'string', description: 'Initially-selected tab value.' },
      {
        name: 'values',
        type: 'array',
        description: 'Explicit tab list; overrides derivation from TabItem children.',
      },
      { name: 'className', type: 'string' },
      { name: 'groupId', type: 'string', description: 'Sync selection across groups w/ same ID.' },
    ],
  },
  {
    framework: 'generic',
    name: 'TabItem',
    aliases: ['Tab'],
    summary: 'Single tab panel; nest inside <Tabs>.',
    example: '<TabItem label="First" value="first">body</TabItem>',
    childrenKind: 'block',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Visible tab label.' },
      { name: 'value', type: 'string', description: 'Stable ID; defaults to label.' },
    ],
  },
  {
    framework: 'generic',
    name: 'CodeGroup',
    summary: 'Wrap multiple code blocks into a tab group.',
    example:
      '<CodeGroup>\n```js title="file.js"\nconsole.log(1)\n```\n```ts title="file.ts"\nconsole.log(1)\n```\n</CodeGroup>',
    childrenKind: 'block',
    props: [
      { name: 'labels', type: 'array', description: 'Override labels; defaults to title attribute.' },
    ],
  },

  // docusaurus
  {
    framework: 'docusaurus',
    name: 'Tabs',
    importSpecifier: '@theme/Tabs',
    summary: 'Docusaurus-flavored tab group; supports groupId sync.',
    example:
      '<Tabs groupId="lang">\n  <TabItem label="JS" value="js">js</TabItem>\n  <TabItem label="TS" value="ts">ts</TabItem>\n</Tabs>',
    childrenKind: 'tabitems',
    props: [
      { name: 'defaultValue', type: 'string' },
      { name: 'values', type: 'array' },
      { name: 'groupId', type: 'string' },
      { name: 'queryString', type: 'string' },
    ],
  },
  {
    framework: 'docusaurus',
    name: 'TabItem',
    importSpecifier: '@theme/TabItem',
    summary: 'Docusaurus tab panel.',
    example: '<TabItem label="First" value="first">body</TabItem>',
    childrenKind: 'block',
    props: [
      { name: 'label', type: 'string', required: true },
      { name: 'value', type: 'string' },
    ],
  },
  {
    framework: 'docusaurus',
    name: 'CodeBlock',
    importSpecifier: '@theme/CodeBlock',
    summary: 'Docusaurus highlighted code block w/ optional title.',
    example: '<CodeBlock language="js" title="file.js">console.log(1)</CodeBlock>',
    childrenKind: 'text',
    props: [
      { name: 'language', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'showLineNumbers', type: 'boolean' },
    ],
  },
  {
    framework: 'docusaurus',
    name: 'Details',
    importSpecifier: '@theme/Details',
    summary: 'Docusaurus disclosure wrapper (renders <details>).',
    example: '<Details summary="Click me">body</Details>',
    childrenKind: 'block',
    props: [
      { name: 'summary', type: 'string' },
      { name: 'open', type: 'boolean' },
    ],
  },

  // starlight
  {
    framework: 'starlight',
    name: 'Card',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Starlight card w/ icon + title.',
    example: '<Card title="Fast" icon="rocket">Body</Card>',
    childrenKind: 'block',
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'icon', type: 'string', description: 'Icon name (star, rocket, document, ...).' },
    ],
  },
  {
    framework: 'starlight',
    name: 'CardGrid',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Responsive grid for Card / LinkCard.',
    example: '<CardGrid>\n  <Card title="A">...</Card>\n  <Card title="B">...</Card>\n</CardGrid>',
    childrenKind: 'block',
    props: [
      { name: 'stagger', type: 'boolean' },
    ],
  },
  {
    framework: 'starlight',
    name: 'LinkCard',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Clickable card linking to a destination.',
    example: '<LinkCard title="Docs" href="/docs" description="Get started" />',
    childrenKind: 'none',
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'href', type: 'string', required: true },
      { name: 'description', type: 'string' },
    ],
  },
  {
    framework: 'starlight',
    name: 'Steps',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Numbered step list; wrap an <ol>.',
    example: '<Steps>\n  1. First\n  2. Second\n</Steps>',
    childrenKind: 'steps',
    props: [],
  },
  {
    framework: 'starlight',
    name: 'Badge',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Inline status badge.',
    example: '<Badge text="New" variant="success" />',
    childrenKind: 'none',
    props: [
      { name: 'text', type: 'node', required: true },
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
  {
    framework: 'starlight',
    name: 'Aside',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Starlight aside/admonition; JSX alternative to ::: directives.',
    example: '<Aside type="tip" title="Heads up">Body</Aside>',
    childrenKind: 'block',
    props: [
      {
        name: 'type',
        type: 'enum',
        values: STARLIGHT_ASIDE_TYPES,
      },
      { name: 'title', type: 'string' },
    ],
  },
  {
    framework: 'starlight',
    name: 'Tabs',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Starlight tab group.',
    example:
      '<Tabs>\n  <TabItem label="JS" value="js">js</TabItem>\n  <TabItem label="TS" value="ts">ts</TabItem>\n</Tabs>',
    childrenKind: 'tabitems',
    props: [
      { name: 'syncKey', type: 'string', description: 'Sync across pages.' },
    ],
  },
  {
    framework: 'starlight',
    name: 'TabItem',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Starlight tab panel.',
    example: '<TabItem label="First" value="first">body</TabItem>',
    childrenKind: 'block',
    props: [
      { name: 'label', type: 'string', required: true },
      { name: 'value', type: 'string' },
      { name: 'icon', type: 'string' },
    ],
  },
  {
    framework: 'starlight',
    name: 'FileTree',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Render a list as a file/directory tree.',
    example: '<FileTree>\n  - src\n    - index.ts\n</FileTree>',
    childrenKind: 'block',
    props: [],
  },
  {
    framework: 'starlight',
    name: 'Code',
    importSpecifier: '@astrojs/starlight/components',
    summary: 'Starlight syntax-highlighted code block.',
    example: '<Code code="console.log(1)" lang="js" />',
    childrenKind: 'none',
    props: [
      { name: 'code', type: 'string', required: true },
      { name: 'lang', type: 'string' },
      { name: 'title', type: 'string' },
    ],
  },

  // nextjs
  {
    framework: 'nextjs',
    name: 'Image',
    importSpecifier: 'next/image',
    summary: 'Next.js image; preview falls back to <img> (no optimization).',
    example: '<Image src="/hero.png" alt="Hero" width={800} height={400} />',
    childrenKind: 'none',
    props: [
      { name: 'src', type: 'string', required: true },
      { name: 'alt', type: 'string', required: true },
      { name: 'width', type: 'number' },
      { name: 'height', type: 'number' },
      { name: 'fill', type: 'boolean' },
      { name: 'priority', type: 'boolean' },
      { name: 'placeholder', type: 'enum', values: ['blur', 'empty'] },
      { name: 'sizes', type: 'string' },
      { name: 'quality', type: 'number' },
    ],
  },
  {
    framework: 'nextjs',
    name: 'Link',
    importSpecifier: 'next/link',
    summary: 'Next.js link; preview renders as <a>.',
    example: '<Link href="/docs">Docs</Link>',
    childrenKind: 'block',
    props: [
      { name: 'href', type: 'string', required: true },
      { name: 'replace', type: 'boolean' },
      { name: 'scroll', type: 'boolean' },
      { name: 'prefetch', type: 'boolean' },
    ],
  },

  // nextra
  {
    framework: 'nextra',
    name: 'Callout',
    importSpecifier: 'nextra/components',
    summary: 'Nextra callout; no title, icon comes from `emoji` or type.',
    example: '<Callout type="warning">Watch out</Callout>',
    childrenKind: 'block',
    props: [
      { name: 'type', type: 'enum', values: NEXTRA_CALLOUT_TYPES },
      { name: 'emoji', type: 'node', description: 'Custom icon.' },
    ],
  },
  {
    framework: 'nextra',
    name: 'Tabs',
    importSpecifier: 'nextra/components',
    summary: 'Nextra tabs; uses `items` prop + <Tabs.Tab> children.',
    example:
      '<Tabs items={["JS", "TS"]}>\n  <Tabs.Tab>js</Tabs.Tab>\n  <Tabs.Tab>ts</Tabs.Tab>\n</Tabs>',
    childrenKind: 'block',
    props: [
      { name: 'items', type: 'array', required: true },
      { name: 'defaultIndex', type: 'number' },
      { name: 'selectedIndex', type: 'number' },
      { name: 'storageKey', type: 'string' },
    ],
  },
  {
    framework: 'nextra',
    name: 'Cards',
    importSpecifier: 'nextra/components',
    summary: 'Nextra card grid.',
    example:
      '<Cards>\n  <Cards.Card title="A" href="/a" />\n  <Cards.Card title="B" href="/b" />\n</Cards>',
    childrenKind: 'block',
    props: [
      { name: 'num', type: 'number', description: 'Cards per row.' },
    ],
  },
  {
    framework: 'nextra',
    name: 'FileTree',
    importSpecifier: 'nextra/components',
    summary: 'Nextra file/folder tree.',
    example:
      '<FileTree>\n  <FileTree.Folder name="src" defaultOpen>\n    <FileTree.File name="index.ts" />\n  </FileTree.Folder>\n</FileTree>',
    childrenKind: 'block',
    props: [],
  },
  {
    framework: 'nextra',
    name: 'Steps',
    importSpecifier: 'nextra/components',
    summary: 'Nextra numbered steps (wraps heading hierarchy).',
    example: '<Steps>\n### Step 1\nDo this\n### Step 2\nDo that\n</Steps>',
    childrenKind: 'block',
    props: [],
  },
  {
    framework: 'nextra',
    name: 'Bleed',
    importSpecifier: 'nextra/components',
    summary: 'Break out of content width.',
    example: '<Bleed full>Full-bleed content</Bleed>',
    childrenKind: 'block',
    props: [
      { name: 'full', type: 'boolean', description: 'Edge-to-edge bleed.' },
    ],
  },
];

// indexed lookups — pre-computed for O(1) access
type ComponentKey = `${FrameworkId}:${string}`;

const BY_FRAMEWORK = new Map<FrameworkId, ComponentSpec[]>();
const BY_KEY = new Map<ComponentKey, ComponentSpec>();

for (const spec of COMPONENTS) {
  const list = BY_FRAMEWORK.get(spec.framework) ?? [];
  list.push(spec);
  BY_FRAMEWORK.set(spec.framework, list);

  const register = (name: string): void => {
    BY_KEY.set(`${spec.framework}:${name}`, spec);
  };
  register(spec.name);
  for (const alias of spec.aliases ?? []) {
    register(alias);
  }
}

export function listFrameworks(): readonly FrameworkId[] {
  return ['generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'];
}

export function listComponentsForFramework(
  framework: FrameworkId,
): readonly ComponentSpec[] {
  return BY_FRAMEWORK.get(framework) ?? [];
}

// resolution is framework-scoped: each framework's shim barrel is independent
// & does NOT re-export generic. lint accepting <Callout> in docusaurus would
// silently disagree w/ the runtime, which throws "Expected component ...".
export function findComponent(
  framework: FrameworkId,
  name: string,
): ComponentSpec | undefined {
  return BY_KEY.get(`${framework}:${name}`);
}

export function allComponentNamesForFramework(
  framework: FrameworkId,
): readonly string[] {
  const names = new Set<string>();
  for (const spec of listComponentsForFramework(framework)) {
    names.add(spec.name);
    for (const alias of spec.aliases ?? []) {
      names.add(alias);
    }
  }
  return Array.from(names);
}

// --- frontmatter schemas -----------------------------------------------------

const COMMON_TAGS_FIELD: FrontmatterField = {
  name: 'tags',
  type: 'array',
  description: 'List of topic tags.',
};

const FRONTMATTER: readonly FrontmatterSchema[] = [
  {
    framework: 'generic',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      COMMON_TAGS_FIELD,
      { name: 'draft', type: 'boolean' },
      { name: 'slug', type: 'string' },
    ],
    allowUnknown: true,
  },
  {
    framework: 'docusaurus',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'sidebar_position', type: 'number' },
      { name: 'sidebar_label', type: 'string' },
      { name: 'sidebar_class_name', type: 'string' },
      { name: 'slug', type: 'string' },
      { name: 'draft', type: 'boolean' },
      { name: 'hide_title', type: 'boolean' },
      { name: 'hide_table_of_contents', type: 'boolean' },
      { name: 'pagination_label', type: 'string' },
      { name: 'pagination_next', type: 'string' },
      { name: 'pagination_prev', type: 'string' },
      { name: 'keywords', type: 'array' },
      COMMON_TAGS_FIELD,
      { name: 'toc_min_heading_level', type: 'number' },
      { name: 'toc_max_heading_level', type: 'number' },
    ],
    allowUnknown: true,
  },
  {
    framework: 'starlight',
    fields: [
      { name: 'title', type: 'string', required: true, description: 'Page title (required).' },
      { name: 'description', type: 'string' },
      {
        name: 'template',
        type: 'string',
        values: ['doc', 'splash'],
        description: "Page template ('doc' or 'splash').",
      },
      { name: 'editUrl', type: 'string' },
      { name: 'lastUpdated', type: 'string' },
      { name: 'tableOfContents', type: 'object' },
      { name: 'head', type: 'array' },
      { name: 'next', type: 'string' },
      { name: 'prev', type: 'string' },
      { name: 'pagefind', type: 'boolean' },
      { name: 'draft', type: 'boolean' },
      { name: 'sidebar', type: 'object' },
      { name: 'hero', type: 'object' },
      { name: 'banner', type: 'object' },
      COMMON_TAGS_FIELD,
    ],
    allowUnknown: true,
  },
  {
    framework: 'nextra',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'searchable', type: 'boolean' },
      { name: 'asIndexPage', type: 'boolean' },
      { name: 'full', type: 'boolean' },
      { name: 'sidebarTitle', type: 'string' },
      COMMON_TAGS_FIELD,
    ],
    allowUnknown: true,
  },
  {
    framework: 'nextjs',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'metadata', type: 'object' },
      COMMON_TAGS_FIELD,
    ],
    allowUnknown: true,
  },
];

const FRONTMATTER_BY_FRAMEWORK = new Map<FrameworkId, FrontmatterSchema>();
for (const schema of FRONTMATTER) {
  FRONTMATTER_BY_FRAMEWORK.set(schema.framework, schema);
}

export function getFrontmatterSchema(
  framework: FrameworkId,
): FrontmatterSchema {
  return (
    FRONTMATTER_BY_FRAMEWORK.get(framework) ??
    FRONTMATTER_BY_FRAMEWORK.get('generic')!
  );
}

// primitive HTML/SVG tag check — these are intrinsic & never lint-targeted
const INTRINSIC_PATTERN = /^[a-z]/;

export function isIntrinsicTag(name: string): boolean {
  return INTRINSIC_PATTERN.test(name) && !name.includes('.');
}

// skip compound names like Tabs.Tab — their parent resolves the child via a
// dotted prop. framework metadata only covers top-level components.
export function isCompoundChild(name: string): boolean {
  return name.includes('.');
}
