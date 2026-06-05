// tests/components/component-metadata.test.ts
// verify component authoring metadata contract

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
  NEXTRA_CALLOUT_ICONS,
  NEXTRA_CALLOUT_TYPES,
} from '../../src/components/base/icons';
import { ASIDE_TYPES } from '../../src/components/starlight/Aside';
import { BADGE_VARIANTS } from '../../src/components/starlight/Badge';

const REGISTRY_ENTRIES: readonly ComponentRegistryEntry[] = COMPONENT_REGISTRY;

function isComponentEntry(
  entry: ComponentRegistryEntry
): entry is ComponentDefinition {
  return entry.kind === 'component';
}

function componentKey(entry: ComponentDefinition): ComponentKey {
  return `${entry.framework}:${entry.name}`;
}

describe('component authoring metadata', () => {
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

  it('sources shim value sets from their canonical shim definitions', () => {
    // nextra callout types == NEXTRA_CALLOUT_ICONS keys
    const nextraType = getComponentMetadata('nextra', 'Callout')?.props.find(
      (prop) => prop.name === 'type'
    );
    expect(nextraType?.values).toEqual(NEXTRA_CALLOUT_TYPES);
    expect(NEXTRA_CALLOUT_TYPES).toEqual(Object.keys(NEXTRA_CALLOUT_ICONS));

    // starlight aside types == AsideType tuple
    const asideType = getComponentMetadata('starlight', 'Aside')?.props.find(
      (prop) => prop.name === 'type'
    );
    expect(asideType?.values).toEqual(ASIDE_TYPES);

    // starlight badge variants == BadgeVariant tuple
    const badgeVariant = getComponentMetadata('starlight', 'Badge')?.props.find(
      (prop) => prop.name === 'variant'
    );
    expect(badgeVariant?.values).toEqual(BADGE_VARIANTS);
  });
});
