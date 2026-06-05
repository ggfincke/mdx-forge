// tests/internal/render-plugin-registry.test.ts
// render-plugin registry parity tests against core component metadata

import { describe, expect, it } from 'vitest';
import {
  COMPONENT_REGISTRY,
  type ComponentDefinition,
  type ComponentRegistryEntry,
} from '../../src/components/registry/index';
import { VALID_CALLOUT_TYPES } from '../../src/internal/callout';
import {
  findComponent,
  listComponentsForFramework,
  listFrameworks,
  listRegistryIdentitiesForFramework,
  type FrameworkId,
  type RegistryIdentity,
} from '../../plugins/render/src/registry';

function isComponentEntry(
  entry: ComponentRegistryEntry
): entry is ComponentDefinition {
  return entry.kind === 'component';
}

function coreEntriesForFramework(
  framework: FrameworkId
): ComponentRegistryEntry[] {
  return COMPONENT_REGISTRY.filter((entry) => entry.framework === framework);
}

function coreComponentsForFramework(
  framework: FrameworkId
): ComponentDefinition[] {
  return coreEntriesForFramework(framework).filter(isComponentEntry);
}

function coreSignature(entry: ComponentRegistryEntry): string {
  return `${entry.kind}:${entry.name}`;
}

function identitySignature(identity: RegistryIdentity): string {
  return `${identity.kind}:${identity.name}`;
}

describe('render plugin registry parity', () => {
  it('derives component names, aliases, and imports from the core registry', () => {
    for (const framework of listFrameworks()) {
      const coreEntries = coreComponentsForFramework(framework);
      const pluginEntries = listComponentsForFramework(framework);

      expect(pluginEntries.map((entry) => entry.name)).toEqual(
        coreEntries.map((entry) => entry.name)
      );

      for (const coreEntry of coreEntries) {
        const spec = findComponent(framework, coreEntry.name);

        expect(spec).toBeDefined();
        if (!spec) {
          continue;
        }
        expect(spec.framework).toBe(coreEntry.framework);
        expect(spec.name).toBe(coreEntry.name);
        expect(spec.aliases).toEqual([...coreEntry.aliases]);
        expect(spec.importSpecifier).toBe(coreEntry.importSpecifiers[0]);
        expect(spec.importSpecifiers).toEqual([...coreEntry.importSpecifiers]);
      }
    }
  });

  it('registers aliases from core component identity', () => {
    const collapsible = findComponent('generic', 'Collapsible');

    expect(findComponent('generic', 'Accordion')).toBe(collapsible);
    expect(findComponent('generic', 'Details')).toBe(collapsible);
    expect(collapsible?.aliases).toEqual(['Accordion', 'Details']);
    expect(findComponent('generic', 'Tab')?.name).toBe('TabItem');
  });

  it('keeps barrel identities in parity without linting them as components', () => {
    for (const framework of listFrameworks()) {
      const coreEntries = coreEntriesForFramework(framework);
      const identities = listRegistryIdentitiesForFramework(framework);

      expect(identities.map(identitySignature)).toEqual(
        coreEntries.map(coreSignature)
      );

      for (const coreEntry of coreEntries) {
        const identity = identities.find(
          (entry) =>
            entry.kind === coreEntry.kind && entry.name === coreEntry.name
        );

        expect(identity).toBeDefined();
        if (!identity) {
          continue;
        }
        expect(identity.importSpecifiers).toEqual([
          ...coreEntry.importSpecifiers,
        ]);
        expect(identity.shimPath).toBe(coreEntry.shimPath);
        if (coreEntry.kind === 'barrel') {
          expect(identity.exportNames).toEqual([...coreEntry.exportNames]);
        }
      }
    }

    expect(
      listRegistryIdentitiesForFramework('starlight').find(
        (entry) => entry.kind === 'barrel' && entry.name === 'components'
      )?.importSpecifiers
    ).toEqual(['@astrojs/starlight/components']);
    expect(
      listComponentsForFramework('starlight').map((entry) => entry.name)
    ).not.toContain('components');
  });

  it('lists frameworks in canonical order', () => {
    expect(listFrameworks()).toEqual([
      'generic',
      'docusaurus',
      'starlight',
      'nextra',
      'nextjs',
    ]);
  });

  it('has core metadata for every core component', () => {
    for (const entry of COMPONENT_REGISTRY) {
      if (!isComponentEntry(entry)) {
        continue;
      }
      expect(entry.metadata).toBeDefined();
      expect(entry.metadata.summary).not.toBe('');
      expect(entry.metadata.examples[0]?.code).not.toBe('');
    }
  });

  it('has plugin metadata for every core component and no stale keys', () => {
    expect(findComponent('starlight', 'Card')?.importSpecifier).toBe(
      '@astrojs/starlight/components/Card'
    );
    expect(findComponent('nextra', 'Tabs')?.importSpecifier).toBe(
      'nextra/components/Tabs'
    );
    expect(
      findComponent('generic', 'Callout')?.props.find(
        (prop) => prop.name === 'type'
      )?.values
    ).toEqual(VALID_CALLOUT_TYPES);

    for (const framework of listFrameworks()) {
      for (const spec of listComponentsForFramework(framework)) {
        expect(spec.summary).not.toBe('');
        expect(spec.example).not.toBe('');
        expect(Array.isArray(spec.props)).toBe(true);
      }
    }
  });
});
