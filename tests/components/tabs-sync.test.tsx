// tests/components/tabs-sync.test.tsx
// T5: framework tab adapters implement groupId/syncKey/queryString/lazy (F12)

// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import {
  Tabs as DocuTabs,
  TabItem as DocuTabItem,
} from '../../src/components/docusaurus/Tabs';
import {
  Tabs as StarlightTabs,
  TabItem as StarlightTabItem,
} from '../../src/components/starlight/Tabs';
import { __resetTabGroupSync } from '../../src/components/base/tabGroupSync';

// select the tab button w/ the given label within a container
function tabButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(
    scope.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  ).find((el) => el.textContent === label);
  if (!button) {
    throw new Error(`tab button "${label}" not found`);
  }
  return button;
}

function selectedTabLabel(scope: ParentNode): string | undefined {
  return Array.from(
    scope.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  ).find((el) => el.getAttribute('aria-selected') === 'true')?.textContent as
    string | undefined;
}

beforeEach(() => {
  __resetTabGroupSync();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('label-only default items (F12)', () => {
  it('selects the default TabItem when it has no explicit value', () => {
    const { container } = render(
      <DocuTabs>
        <DocuTabItem label="One">1</DocuTabItem>
        <DocuTabItem label="Two" default>
          2
        </DocuTabItem>
      </DocuTabs>
    );

    expect(selectedTabLabel(container)).toBe('Two');
  });
});

describe('groupId synchronization (F12)', () => {
  it('keeps two same-groupId groups in sync & persists the choice', () => {
    const { container } = render(
      <div>
        <div data-testid="a">
          <DocuTabs groupId="pkg">
            <DocuTabItem value="npm" label="npm">
              a-npm
            </DocuTabItem>
            <DocuTabItem value="yarn" label="yarn">
              a-yarn
            </DocuTabItem>
          </DocuTabs>
        </div>
        <div data-testid="b">
          <DocuTabs groupId="pkg">
            <DocuTabItem value="npm" label="npm">
              b-npm
            </DocuTabItem>
            <DocuTabItem value="yarn" label="yarn">
              b-yarn
            </DocuTabItem>
          </DocuTabs>
        </div>
      </div>
    );

    const groupA = container.querySelector('[data-testid="a"]')!;
    const groupB = container.querySelector('[data-testid="b"]')!;

    fireEvent.click(tabButton(groupA, 'yarn'));

    expect(selectedTabLabel(groupA)).toBe('yarn');
    expect(selectedTabLabel(groupB)).toBe('yarn');
    expect(window.localStorage.getItem('docusaurus.tab.pkg')).toBe('yarn');
  });

  it('restores the persisted group choice after mount', () => {
    window.localStorage.setItem('docusaurus.tab.pkg', 'yarn');

    const { container } = render(
      <DocuTabs groupId="pkg">
        <DocuTabItem value="npm" label="npm">
          npm
        </DocuTabItem>
        <DocuTabItem value="yarn" label="yarn">
          yarn
        </DocuTabItem>
      </DocuTabs>
    );

    expect(selectedTabLabel(container)).toBe('yarn');
  });

  it('ignores a stored value that names no existing tab', () => {
    window.localStorage.setItem('docusaurus.tab.pkg', 'bogus');

    const { container } = render(
      <DocuTabs groupId="pkg">
        <DocuTabItem value="npm" label="npm">
          npm
        </DocuTabItem>
        <DocuTabItem value="yarn" label="yarn">
          yarn
        </DocuTabItem>
      </DocuTabs>
    );

    expect(selectedTabLabel(container)).toBe('npm');
  });
});

describe('queryString URL sync (F12)', () => {
  it('restores the selection from the URL (string param form)', () => {
    window.history.replaceState(null, '', '/?lang=ts');

    const { container } = render(
      <DocuTabs queryString="lang">
        <DocuTabItem value="js" label="js">
          js
        </DocuTabItem>
        <DocuTabItem value="ts" label="ts">
          ts
        </DocuTabItem>
      </DocuTabs>
    );

    expect(selectedTabLabel(container)).toBe('ts');
  });

  it('derives the param name from groupId for the boolean form', () => {
    window.history.replaceState(null, '', '/?pkg=yarn');

    const { container } = render(
      <DocuTabs groupId="pkg" queryString>
        <DocuTabItem value="npm" label="npm">
          npm
        </DocuTabItem>
        <DocuTabItem value="yarn" label="yarn">
          yarn
        </DocuTabItem>
      </DocuTabs>
    );

    expect(selectedTabLabel(container)).toBe('yarn');
  });

  it('URL value wins over the persisted storage value', () => {
    window.localStorage.setItem('docusaurus.tab.pkg', 'npm');
    window.history.replaceState(null, '', '/?pkg=yarn');

    const { container } = render(
      <DocuTabs groupId="pkg" queryString>
        <DocuTabItem value="npm" label="npm">
          npm
        </DocuTabItem>
        <DocuTabItem value="yarn" label="yarn">
          yarn
        </DocuTabItem>
      </DocuTabs>
    );

    expect(selectedTabLabel(container)).toBe('yarn');
  });

  it('updates the URL on selection w/o navigation', () => {
    const { container } = render(
      <DocuTabs queryString="lang">
        <DocuTabItem value="js" label="js">
          js
        </DocuTabItem>
        <DocuTabItem value="ts" label="ts">
          ts
        </DocuTabItem>
      </DocuTabs>
    );

    fireEvent.click(tabButton(container, 'ts'));

    expect(new URLSearchParams(window.location.search).get('lang')).toBe('ts');
  });
});

describe('lazy panels (F12)', () => {
  it('mounts only the selected panel & mounts others on selection', () => {
    let probeRenders = 0;
    function Probe() {
      probeRenders++;
      return <span>probe</span>;
    }

    const { container } = render(
      <DocuTabs lazy>
        <DocuTabItem value="a" label="A">
          first
        </DocuTabItem>
        <DocuTabItem value="b" label="B">
          <Probe />
        </DocuTabItem>
      </DocuTabs>
    );

    // hidden panel content is not mounted at all
    expect(probeRenders).toBe(0);
    expect(container.querySelectorAll('[role="tabpanel"]').length).toBe(1);

    fireEvent.click(tabButton(container, 'B'));

    expect(probeRenders).toBeGreaterThan(0);
    expect(container.textContent).toContain('probe');
    // previously-selected panel unmounted again
    expect(container.textContent).not.toContain('first');
  });
});

describe('starlight syncKey & icons (F12)', () => {
  it('syncs two groups w/ the same syncKey & persists w/ its namespace', () => {
    const { container } = render(
      <div>
        <div data-testid="a">
          <StarlightTabs syncKey="pkg">
            <StarlightTabItem label="npm">a-npm</StarlightTabItem>
            <StarlightTabItem label="pnpm">a-pnpm</StarlightTabItem>
          </StarlightTabs>
        </div>
        <div data-testid="b">
          <StarlightTabs syncKey="pkg">
            <StarlightTabItem label="npm">b-npm</StarlightTabItem>
            <StarlightTabItem label="pnpm">b-pnpm</StarlightTabItem>
          </StarlightTabs>
        </div>
      </div>
    );

    const groupA = container.querySelector('[data-testid="a"]')!;
    const groupB = container.querySelector('[data-testid="b"]')!;

    fireEvent.click(tabButton(groupA, 'pnpm'));

    expect(selectedTabLabel(groupB)).toBe('pnpm');
    expect(window.localStorage.getItem('starlight-synced-tabs__pkg')).toBe(
      'pnpm'
    );
  });

  it('renders a known icon name as its emoji inside the tab button', () => {
    const { container } = render(
      <StarlightTabs>
        <StarlightTabItem label="Fast" icon="rocket">
          body
        </StarlightTabItem>
      </StarlightTabs>
    );

    const button = container.querySelector('[role="tab"]');
    expect(button?.textContent).toContain('🚀');
    expect(button?.textContent).toContain('Fast');
  });
});
