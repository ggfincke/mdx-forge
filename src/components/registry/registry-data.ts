// src/components/registry/registry-data.ts
// COMPONENT_REGISTRY data + derived types + builder functions
// note: derived types (line 328+) use `typeof COMPONENT_REGISTRY` & must stay in this file

import {
  SHIM_PREFIX,
  type ComponentRegistryEntry,
  type Framework,
} from './types';

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
    snippetTemplate:
      '<Callout type="${1|note,tip,warning,danger,info,caution,important|}">\n  $2\n</Callout>',
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
    framework: 'docusaurus',
    importSpecifiers: ['@theme/Tabs'],
    shimPath: `${SHIM_PREFIX}/docusaurus/Tabs`,
  },
  {
    kind: 'component',
    name: 'TabItem',
    aliases: [],
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
    framework: 'docusaurus',
    importSpecifiers: ['@theme/CodeBlock'],
    shimPath: `${SHIM_PREFIX}/docusaurus/CodeBlock`,
  },
  {
    kind: 'component',
    name: 'Details',
    aliases: [],
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
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Card'],
    shimPath: `${SHIM_PREFIX}/starlight/Card`,
  },
  {
    kind: 'component',
    name: 'CardGrid',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/CardGrid'],
    shimPath: `${SHIM_PREFIX}/starlight/CardGrid`,
  },
  {
    kind: 'component',
    name: 'LinkCard',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/LinkCard'],
    shimPath: `${SHIM_PREFIX}/starlight/LinkCard`,
  },
  {
    kind: 'component',
    name: 'Steps',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Steps'],
    shimPath: `${SHIM_PREFIX}/starlight/Steps`,
  },
  {
    kind: 'component',
    name: 'Badge',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Badge'],
    shimPath: `${SHIM_PREFIX}/starlight/Badge`,
  },
  {
    kind: 'component',
    name: 'Aside',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Aside'],
    shimPath: `${SHIM_PREFIX}/starlight/Aside`,
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
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
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/FileTree'],
    shimPath: `${SHIM_PREFIX}/starlight/FileTree`,
  },
  {
    kind: 'component',
    name: 'Code',
    aliases: [],
    framework: 'starlight',
    importSpecifiers: ['@astrojs/starlight/components/Code'],
    shimPath: `${SHIM_PREFIX}/starlight/Code`,
  },

  // Next.js components
  {
    kind: 'component',
    name: 'Image',
    aliases: [],
    framework: 'nextjs',
    importSpecifiers: ['next/image'],
    shimPath: `${SHIM_PREFIX}/nextjs/Image`,
  },
  {
    kind: 'component',
    name: 'Link',
    aliases: [],
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
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Callout'],
    shimPath: `${SHIM_PREFIX}/nextra/Callout`,
  },
  {
    kind: 'component',
    name: 'Tabs',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Tabs'],
    shimPath: `${SHIM_PREFIX}/nextra/Tabs`,
  },
  {
    kind: 'component',
    name: 'Cards',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Cards'],
    shimPath: `${SHIM_PREFIX}/nextra/Cards`,
  },
  {
    kind: 'component',
    name: 'FileTree',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/FileTree'],
    shimPath: `${SHIM_PREFIX}/nextra/FileTree`,
  },
  {
    kind: 'component',
    name: 'Steps',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Steps'],
    shimPath: `${SHIM_PREFIX}/nextra/Steps`,
  },
  {
    kind: 'component',
    name: 'Bleed',
    aliases: [],
    framework: 'nextra',
    importSpecifiers: ['nextra/components/Bleed'],
    shimPath: `${SHIM_PREFIX}/nextra/Bleed`,
  },
] as const satisfies readonly ComponentRegistryEntry[];

// derive types from the registry for stronger typing across the repo
// note: derived types (line 328+) use `typeof COMPONENT_REGISTRY` & must stay in this file
export type ComponentRegistryEntryType = (typeof COMPONENT_REGISTRY)[number];

type GenericComponentEntry = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'generic' }
>;

export type GenericComponentName = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'generic' }
>['name'];

export type GenericComponentAlias = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'generic' }
>['aliases'][number];

export type DocusaurusComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'docusaurus' }
>['name'];

export type StarlightComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'starlight' }
>['name'];

export type NextjsComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'nextjs' }
>['name'];

export type NextraComponent = Extract<
  ComponentRegistryEntryType,
  { kind: 'component'; framework: 'nextra' }
>['name'];

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
