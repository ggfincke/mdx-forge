// tests/components/component-metadata.test.ts
// verify component authoring metadata contract

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  COMPONENT_METADATA,
  COMPONENT_REGISTRY,
  getComponentMetadata,
  type ComponentDefinition,
  type ComponentRegistryEntry,
  type ComponentKey,
} from '../../src/components/registry/index';
import {
  CALLOUT_TYPE_ALIASES,
  VALID_CALLOUT_TYPES,
} from '../../src/internal/callout';
import {
  ASIDE_TYPES,
  BADGE_VARIANTS,
  NEXTRA_CALLOUT_TYPES,
} from '../../src/components/internal/metadata';
import { COMPONENT_IDENTITY_DEFINITIONS } from '../../src/components/internal/component-identity';
import {
  NEXTRA_CALLOUT_ICONS,
  NEXTRA_CALLOUT_TYPES as NEXTRA_CALLOUT_TYPES_FROM_ICONS,
} from '../../src/components/base/icons';
import { ASIDE_TYPES as ASIDE_TYPES_FROM_ASIDE } from '../../src/components/starlight/Aside';
import { BADGE_VARIANTS as BADGE_VARIANTS_FROM_BADGE } from '../../src/components/starlight/Badge';

const REGISTRY_ENTRIES: readonly ComponentRegistryEntry[] = COMPONENT_REGISTRY;

function isComponentEntry(
  entry: ComponentRegistryEntry
): entry is ComponentDefinition {
  return entry.kind === 'component';
}

function componentKey(
  entry: Pick<ComponentDefinition, 'framework' | 'name'>
): ComponentKey {
  return `${entry.framework}:${entry.name}`;
}

describe('component authoring metadata', () => {
  it('derives ordered registry identity & metadata keys from one table', () => {
    const registryIdentities = COMPONENT_REGISTRY.map((entry) => {
      if (!isComponentEntry(entry)) {
        return entry;
      }
      const { metadata: _metadata, ...identity } = entry;
      return identity;
    });
    const componentIdentities = COMPONENT_IDENTITY_DEFINITIONS.filter(
      (identity) => identity.kind === 'component'
    );

    expect(registryIdentities).toEqual(COMPONENT_IDENTITY_DEFINITIONS);
    expect(Object.keys(COMPONENT_METADATA)).toEqual(
      componentIdentities.map(componentKey)
    );
    expect(Object.isFrozen(COMPONENT_IDENTITY_DEFINITIONS)).toBe(true);

    for (const entry of COMPONENT_REGISTRY) {
      if (isComponentEntry(entry)) {
        expect(entry.metadata).toBe(COMPONENT_METADATA[componentKey(entry)]);
      }
    }

    for (const identity of componentIdentities) {
      const aliasDocs = COMPONENT_METADATA[componentKey(identity)].aliasDocs;
      expect(aliasDocs?.map((alias) => alias.name)).toEqual(
        identity.aliases.length > 0 ? identity.aliases : undefined
      );
    }
  });

  it('keeps every positional identity paired w/ its summary & props', () => {
    const identityMetadata = COMPONENT_IDENTITY_DEFINITIONS.filter(
      (identity) => identity.kind === 'component'
    ).map((identity) => {
      const metadata = COMPONENT_METADATA[componentKey(identity)];
      return [
        componentKey(identity),
        metadata.summary,
        metadata.props.map((prop) => prop.name).join(','),
      ];
    });

    expect(identityMetadata).toEqual([
      [
        'generic:Callout',
        'Callout box w/ themed icon + title.',
        'type,title,icon',
      ],
      [
        'generic:Collapsible',
        'Expandable section w/ click-to-toggle header.',
        'title,summary,defaultOpen,open,className',
      ],
      [
        'generic:Tabs',
        'Tab group. Wrap each panel in <TabItem>.',
        'defaultValue,values,className,groupId,lazy',
      ],
      [
        'generic:TabItem',
        'Single tab panel; nest inside <Tabs>.',
        'label,value,default',
      ],
      [
        'generic:CodeGroup',
        'Wrap multiple code blocks into a tab group.',
        'labels',
      ],
      [
        'docusaurus:Tabs',
        'Docusaurus-flavored tab group; supports groupId sync.',
        'defaultValue,values,groupId,queryString,lazy',
      ],
      ['docusaurus:TabItem', 'Docusaurus tab panel.', 'label,value,default'],
      [
        'docusaurus:CodeBlock',
        'Docusaurus highlighted code block w/ optional title.',
        'language,title,showLineNumbers',
      ],
      [
        'docusaurus:Details',
        'Docusaurus disclosure wrapper (renders <details>).',
        'summary,open',
      ],
      ['starlight:Card', 'Starlight card w/ icon + title.', 'title,icon'],
      ['starlight:CardGrid', 'Responsive grid for Card / LinkCard.', 'stagger'],
      [
        'starlight:LinkCard',
        'Clickable card linking to a destination.',
        'title,href,description',
      ],
      ['starlight:Steps', 'Numbered step list; wrap an <ol>.', ''],
      ['starlight:Badge', 'Inline status badge.', 'text,variant,size'],
      [
        'starlight:Aside',
        'Starlight aside/admonition; JSX alternative to ::: directives.',
        'type,title',
      ],
      ['starlight:Tabs', 'Starlight tab group.', 'defaultValue,values,syncKey'],
      ['starlight:TabItem', 'Starlight tab panel.', 'label,value,icon'],
      ['starlight:FileTree', 'Render a list as a file/directory tree.', ''],
      [
        'starlight:Code',
        'Starlight syntax-highlighted code block.',
        'code,lang,language,title,frame,showLineNumbers',
      ],
      [
        'nextjs:Image',
        'Next.js image; preview falls back to <img> (no optimization).',
        'src,alt,width,height,fill,priority,placeholder,sizes,quality,blurDataURL,unoptimized,loader',
      ],
      [
        'nextjs:Link',
        'Next.js link; preview renders as <a>.',
        'href,as,replace,scroll,prefetch,shallow,passHref,locale,legacyBehavior',
      ],
      [
        'nextra:Callout',
        'Nextra callout; no title, icon comes from `emoji` or type.',
        'type,emoji',
      ],
      [
        'nextra:Tabs',
        'Nextra tabs; uses `items` prop + <Tabs.Tab> children.',
        'items,defaultIndex,selectedIndex,storageKey,onChange,className,tabClassName',
      ],
      ['nextra:Cards', 'Nextra card grid.', 'num'],
      ['nextra:FileTree', 'Nextra file/folder tree.', ''],
      ['nextra:Steps', 'Nextra numbered steps (wraps heading hierarchy).', ''],
      ['nextra:Bleed', 'Break out of content width.', 'full'],
    ]);
  });

  it('keeps byte-stable public metadata & registry snapshots', () => {
    const metadataHash = createHash('sha256')
      .update(JSON.stringify(COMPONENT_METADATA))
      .digest('hex');
    const registryHash = createHash('sha256')
      .update(JSON.stringify(COMPONENT_REGISTRY))
      .digest('hex');

    expect(metadataHash).toBe(
      'd416af81080be3e299f0f095c647eee6cba262dc54b6368edd4a1230c63b7ba2'
    );
    expect(registryHash).toBe(
      '1218c3ebfc8a96d64b44f3ebc8715316dd24c4585bdcfbc6cff1def50ac9dd1d'
    );
  });

  it('covers every component entry and no barrel entries', () => {
    const componentKeys = REGISTRY_ENTRIES.filter(isComponentEntry)
      .map(componentKey)
      .sort();
    const metadataKeys = Object.keys(COMPONENT_METADATA).sort();

    expect(metadataKeys).toEqual(componentKeys);
    expect(metadataKeys).not.toContain('starlight:components');
    expect(metadataKeys).not.toContain('nextra:components');
  });

  it('keeps required metadata fields populated', () => {
    for (const entry of REGISTRY_ENTRIES) {
      if (!isComponentEntry(entry)) {
        continue;
      }

      const metadata = entry.metadata;
      expect(metadata.summary.trim()).not.toBe('');
      expect(metadata.examples.length).toBeGreaterThan(0);
      expect(metadata.examples[0].code.trim()).not.toBe('');
      expect(Array.isArray(metadata.props)).toBe(true);
      expect(['full', 'fallback', 'unsupported']).toContain(
        metadata.safeMode.support
      );

      if (metadata.safeMode.support !== 'full') {
        expect(metadata.safeMode.fallback?.trim()).not.toBe('');
      }
    }
  });

  it('uses the shared callout contract for generic Callout props', () => {
    const metadata = getComponentMetadata('generic', 'Callout');
    const typeProp = metadata?.props.find((prop) => prop.name === 'type');

    expect(typeProp?.type).toBe('enum');
    expect(typeProp?.values).toEqual(VALID_CALLOUT_TYPES);
    expect(typeProp?.valueAliases).toEqual(CALLOUT_TYPE_ALIASES);
    expect(typeProp?.values).toContain('summary');
    expect(typeProp?.values).toContain('attention');
  });

  it('documents aliases without replacing identity aliases', () => {
    const metadata = getComponentMetadata('generic', 'Collapsible');

    expect(metadata?.aliasDocs?.map((alias) => alias.name).sort()).toEqual([
      'Accordion',
      'Details',
    ]);
  });

  it('derives the generic Callout snippet type choices from VALID_CALLOUT_TYPES', () => {
    const callout = REGISTRY_ENTRIES.find(
      (entry) =>
        isComponentEntry(entry) &&
        entry.framework === 'generic' &&
        entry.name === 'Callout'
    ) as ComponentDefinition;
    const choiceMatch = callout.snippetTemplate?.match(/\$\{1\|([^|]*)\|\}/);
    const choices = choiceMatch?.[1].split(',') ?? [];

    expect(choices).toEqual([...VALID_CALLOUT_TYPES]);
  });

  it('sources shim value sets from their react-free metadata tuples', () => {
    const nextraType = getComponentMetadata('nextra', 'Callout')?.props.find(
      (prop) => prop.name === 'type'
    );
    expect(nextraType?.values).toEqual(NEXTRA_CALLOUT_TYPES);
    expect(NEXTRA_CALLOUT_TYPES_FROM_ICONS).toEqual(NEXTRA_CALLOUT_TYPES);
    expect(NEXTRA_CALLOUT_TYPES).toEqual(Object.keys(NEXTRA_CALLOUT_ICONS));

    const asideType = getComponentMetadata('starlight', 'Aside')?.props.find(
      (prop) => prop.name === 'type'
    );
    expect(asideType?.values).toEqual(ASIDE_TYPES);
    expect(ASIDE_TYPES_FROM_ASIDE).toEqual(ASIDE_TYPES);

    const badgeVariant = getComponentMetadata('starlight', 'Badge')?.props.find(
      (prop) => prop.name === 'variant'
    );
    expect(badgeVariant?.values).toEqual(BADGE_VARIANTS);
    expect(BADGE_VARIANTS_FROM_BADGE).toEqual(BADGE_VARIANTS);
  });

  it('documents framework-specific props beyond the open DOM surface', () => {
    const starlightTabs = getComponentMetadata('starlight', 'Tabs')?.props.map(
      (prop) => prop.name
    );
    expect(starlightTabs).toEqual(['defaultValue', 'values', 'syncKey']);

    const starlightCode = getComponentMetadata('starlight', 'Code')?.props.map(
      (prop) => prop.name
    );
    expect(starlightCode).toEqual([
      'code',
      'lang',
      'language',
      'title',
      'frame',
      'showLineNumbers',
    ]);

    const nextLink = getComponentMetadata('nextjs', 'Link');
    expect(nextLink?.props.find((prop) => prop.name === 'href')?.type).toBe(
      'union'
    );
    expect(nextLink?.props.map((prop) => prop.name)).toContain(
      'legacyBehavior'
    );

    const nextImage = getComponentMetadata('nextjs', 'Image');
    expect(nextImage?.props.find((prop) => prop.name === 'loader')?.type).toBe(
      'function'
    );
  });
});
