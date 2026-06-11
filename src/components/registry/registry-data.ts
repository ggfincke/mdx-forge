// src/components/registry/registry-data.ts
// COMPONENT_REGISTRY data + derived types + builder functions
// note: derived types use `typeof COMPONENT_REGISTRY` & must stay in this file

import {
  SHIM_PREFIX,
  type ComponentRegistryEntry,
  type Framework,
  type FrameworkId,
} from './types';
import { COMPONENT_METADATA } from './component-metadata';
import { VALID_CALLOUT_TYPES } from '../../internal/callout';

// derive the Callout snippet type choice from the canonical type list
// single-sources the VS Code snippet choices off VALID_CALLOUT_TYPES
const CALLOUT_SNIPPET_TYPE_CHOICE = `\${1|${VALID_CALLOUT_TYPES.join(',')}|}`;

export const COMPONENT_REGISTRY = [
  // generic components (framework-agnostic)
  {
    kind: 'component',
    name: 'Callout',
    aliases: ['Alert', 'Admonition'],
    semanticAliases: [
      'note',
      'tip',
      'warning',
      'danger',
      'info',
      'caution',
      'important',
      'admonition',
      'hint',
      'notice',
    ],
    metadata: COMPONENT_METADATA['generic:Callout'],
    snippetTemplate: `<Callout type="${CALLOUT_SNIPPET_TYPE_CHOICE}">\n  $2\n</Callout>`,
    snippetDoc: 'Callout w/ type (note, tip, warning, danger, info)',
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/Callout`,
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'Collapsible',
    aliases: ['Accordion', 'Details'],
    semanticAliases: ['accordion', 'details', 'expandable', 'toggle'],
    metadata: COMPONENT_METADATA['generic:Collapsible'],
    snippetTemplate:
      '<Collapsible title="${1:Click to expand}">\n  $2\n</Collapsible>',
    snippetDoc: 'Collapsible section w/ toggle',
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/Collapsible`,
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    semanticAliases: ['tabgroup'],
    metadata: COMPONENT_METADATA['generic:Tabs'],
    snippetTemplate:
      '<Tabs>\n  <TabItem label="${1:Tab 1}">\n    $2\n  </TabItem>\n  <TabItem label="${3:Tab 2}">\n    $4\n  </TabItem>\n</Tabs>',
    snippetDoc: 'Tab group w/ multiple tabs',
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/Tabs`,
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: ['Tab'],
    semanticAliases: ['tabpanel', 'tabcontent'],
    metadata: COMPONENT_METADATA['generic:TabItem'],
    snippetTemplate: '<TabItem label="${1:Label}">\n  $2\n</TabItem>',
    snippetDoc: 'Individual tab panel (use inside Tabs)',
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/TabItem`,
    exposeAsBareImport: true,
  },
  {
    kind: 'component',
    name: 'CodeGroup',
    aliases: [],
    semanticAliases: ['codeblock', 'codetabs'],
    metadata: COMPONENT_METADATA['generic:CodeGroup'],
    snippetTemplate:
      '<CodeGroup>\n```${1:js} title="${2:file.js}"\n$3\n```\n</CodeGroup>',
    snippetDoc: 'Grouped code blocks w/ tabs',
    framework: 'generic',
    importSpecifiers: [],
    shimPath: `${SHIM_PREFIX}/generic/CodeGroup`,
    exposeAsBareImport: true,
  },

  // Docusaurus components
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    metadata: COMPONENT_METADATA['docusaurus:Tabs'],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/Tabs'],
    shimPath: `${SHIM_PREFIX}/docusaurus/Tabs`,
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: [],
    metadata: COMPONENT_METADATA['docusaurus:TabItem'],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/TabItem'],
    shimPath: `${SHIM_PREFIX}/docusaurus/TabItem`,
    importKind: 'named',
    importName: 'TabItem',
  },
  {
    kind: 'component',
    name: 'CodeBlock',
    aliases: [],
    metadata: COMPONENT_METADATA['docusaurus:CodeBlock'],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/CodeBlock'],
    shimPath: `${SHIM_PREFIX}/docusaurus/CodeBlock`,
  },
  {
    kind: 'component',
    name: 'Details',
    aliases: [],
    metadata: COMPONENT_METADATA['docusaurus:Details'],
    framework: 'docusaurus',
    importSpecifiers: ['@theme/Details'],
    shimPath: `${SHIM_PREFIX}/docusaurus/Details`,
  },

  // Starlight components
  {
    kind: 'barrel',
    name: 'components',
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components'],
    shimPath: `${SHIM_PREFIX}/starlight`,
    exportNames: [
      'Card',
      'CardGrid',
      'LinkCard',
      'Steps',
      'Badge',
      'Aside',
      'Tabs',
      'TabItem',
      'FileTree',
      'Code',
    ],
  },
  {
    kind: 'component',
    name: 'Card',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:Card'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Card'],
    shimPath: `${SHIM_PREFIX}/starlight/Card`,
  },
  {
    kind: 'component',
    name: 'CardGrid',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:CardGrid'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/CardGrid'],
    shimPath: `${SHIM_PREFIX}/starlight/CardGrid`,
  },
  {
    kind: 'component',
    name: 'LinkCard',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:LinkCard'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/LinkCard'],
    shimPath: `${SHIM_PREFIX}/starlight/LinkCard`,
  },
  {
    kind: 'component',
    name: 'Steps',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:Steps'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Steps'],
    shimPath: `${SHIM_PREFIX}/starlight/Steps`,
  },
  {
    kind: 'component',
    name: 'Badge',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:Badge'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Badge'],
    shimPath: `${SHIM_PREFIX}/starlight/Badge`,
  },
  {
    kind: 'component',
    name: 'Aside',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:Aside'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Aside'],
    shimPath: `${SHIM_PREFIX}/starlight/Aside`,
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:Tabs'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Tabs'],
    shimPath: `${SHIM_PREFIX}/starlight/Tabs`,
    importKind: 'named',
    importName: 'Tabs',
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:TabItem'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/TabItem'],
    shimPath: `${SHIM_PREFIX}/starlight/TabItem`,
    importKind: 'named',
    importName: 'TabItem',
  },
  {
    kind: 'component',
    name: 'FileTree',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:FileTree'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/FileTree'],
    shimPath: `${SHIM_PREFIX}/starlight/FileTree`,
  },
  {
    kind: 'component',
    name: 'Code',
    aliases: [],
    metadata: COMPONENT_METADATA['starlight:Code'],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Code'],
    shimPath: `${SHIM_PREFIX}/starlight/Code`,
  },

  // Next.js components
  {
    kind: 'component',
    name: 'Image',
    aliases: [],
    metadata: COMPONENT_METADATA['nextjs:Image'],
    framework: 'nextjs',
    importSpecifiers: ['next/image'],
    shimPath: `${SHIM_PREFIX}/nextjs/Image`,
  },
  {
    kind: 'component',
    name: 'Link',
    aliases: [],
    metadata: COMPONENT_METADATA['nextjs:Link'],
    framework: 'nextjs',
    importSpecifiers: ['next/link'],
    shimPath: `${SHIM_PREFIX}/nextjs/Link`,
  },

  // Nextra components
  {
    kind: 'barrel',
    name: 'components',
    framework: 'nextra',
    importSpecifiers: [
      'nextra/components',
      'nextra-theme-docs',
      'nextra-theme-docs/components',
    ],
    shimPath: `${SHIM_PREFIX}/nextra`,
    exportNames: ['Callout', 'Tabs', 'Cards', 'FileTree', 'Steps', 'Bleed'],
  },
  {
    kind: 'component',
    name: 'Callout',
    aliases: [],
    metadata: COMPONENT_METADATA['nextra:Callout'],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Callout'],
    shimPath: `${SHIM_PREFIX}/nextra/Callout`,
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    metadata: COMPONENT_METADATA['nextra:Tabs'],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Tabs'],
    shimPath: `${SHIM_PREFIX}/nextra/Tabs`,
  },
  {
    kind: 'component',
    name: 'Cards',
    aliases: [],
    metadata: COMPONENT_METADATA['nextra:Cards'],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Cards'],
    shimPath: `${SHIM_PREFIX}/nextra/Cards`,
  },
  {
    kind: 'component',
    name: 'FileTree',
    aliases: [],
    metadata: COMPONENT_METADATA['nextra:FileTree'],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/FileTree'],
    shimPath: `${SHIM_PREFIX}/nextra/FileTree`,
  },
  {
    kind: 'component',
    name: 'Steps',
    aliases: [],
    metadata: COMPONENT_METADATA['nextra:Steps'],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Steps'],
    shimPath: `${SHIM_PREFIX}/nextra/Steps`,
  },
  {
    kind: 'component',
    name: 'Bleed',
    aliases: [],
    metadata: COMPONENT_METADATA['nextra:Bleed'],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Bleed'],
    shimPath: `${SHIM_PREFIX}/nextra/Bleed`,
  },
] as const satisfies readonly ComponentRegistryEntry[];

// derive types from the registry for stronger typing across the repo
// note: derived types use `typeof COMPONENT_REGISTRY` & must stay in this file
export type ComponentRegistryEntryType = (typeof COMPONENT_REGISTRY)[number];

// registry component entries narrowed by framework
type EntryFor<F extends FrameworkId> = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: F }
>;

type GenericComponentEntry = EntryFor<'generic'>;

export type GenericComponentName = EntryFor<'generic'>['name'];

export type GenericComponentAlias = EntryFor<'generic'>['aliases'][number];

export type DocusaurusComponent = EntryFor<'docusaurus'>['name'];

export type StarlightComponent = EntryFor<'starlight'>['name'];

export type NextjsComponent = EntryFor<'nextjs'>['name'];

export type NextraComponent = EntryFor<'nextra'>['name'];

// generic component definitions w/ aliases (derived from registry)
export const GENERIC_COMPONENTS = buildGenericComponents();

// framework component lists (derived from registry)
export const FRAMEWORK_COMPONENTS = buildFrameworkComponents();

function buildGenericComponents(): Record<string, { aliases: string[] }> {
  const entries = COMPONENT_REGISTRY.filter(
    (entry): entry is GenericComponentEntry =>
      entry.kind === 'component' && entry.framework === 'generic'
  );

  const result: Record<string, { aliases: string[] }> = {};
  for (const entry of entries) {
    result[entry.name] = { aliases: [...entry.aliases] };
  }
  return result;
}

function buildFrameworkComponents(): Record<Framework, string[]> {
  const result: Record<Framework, string[]> = {
    docusaurus: [],
    starlight: [],
    nextjs: [],
    nextra: [],
  };

  for (const entry of COMPONENT_REGISTRY) {
    if (entry.kind !== 'component') {
      continue;
    }
    if (entry.framework === 'generic') {
      continue;
    }
    result[entry.framework].push(entry.name);
  }

  return result;
}
