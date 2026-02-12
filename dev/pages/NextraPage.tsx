// dev/pages/NextraPage.tsx
// Showcase for Nextra component shims

import {
  Callout,
  Tabs,
  Cards,
  FileTree,
  Steps,
  Bleed,
} from '@forge/components/nextra';
import '@forge/components/styles/nextra.css';
import { Section } from '../components/Section';

export function NextraPage() {
  return (
    <div>
      <h1>Nextra Components</h1>

      <Section title="Callout" description="All Nextra callout types w/ inline icon layout">
        <Callout type="default">
          This is a <strong>default</strong> callout — general purpose.
        </Callout>
        <Callout type="info">
          This is an <strong>info</strong> callout — informational content.
        </Callout>
        <Callout type="warning">
          This is a <strong>warning</strong> callout — something to watch out for.
        </Callout>
        <Callout type="error">
          This is an <strong>error</strong> callout — critical issue.
        </Callout>
      </Section>

      <Section title="Callout w/ custom emoji">
        <Callout type="default" emoji="💡">
          Custom emoji overrides the default icon.
        </Callout>
        <Callout type="info" emoji="🔔">
          Notification-style callout with bell emoji.
        </Callout>
      </Section>

      <Section title="Tabs" description="Index-based tabs using items array & Tabs.Tab">
        <Tabs items={['JavaScript', 'TypeScript', 'Python']}>
          <Tabs.Tab>
            <pre><code>{`function greet(name) {\n  return \`Hello, \${name}!\`;\n}`}</code></pre>
          </Tabs.Tab>
          <Tabs.Tab>
            <pre><code>{`function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`}</code></pre>
          </Tabs.Tab>
          <Tabs.Tab>
            <pre><code>{`def greet(name):\n    return f"Hello, {name}!"`}</code></pre>
          </Tabs.Tab>
        </Tabs>
      </Section>

      <Section title="Tabs w/ disabled item">
        <Tabs
          items={[
            'Active',
            'Also Active',
            { label: 'Disabled', disabled: true },
          ]}
        >
          <Tabs.Tab>First tab content.</Tabs.Tab>
          <Tabs.Tab>Second tab content.</Tabs.Tab>
          <Tabs.Tab>This tab is disabled and cannot be selected.</Tabs.Tab>
        </Tabs>
      </Section>

      <Section title="Cards" description="Card grid w/ icons, links, & arrows">
        <Cards num={3}>
          <Cards.Card
            icon="📦"
            title="Installation"
            href="https://example.com/install"
            arrow
          >
            Get started with the package.
          </Cards.Card>
          <Cards.Card
            icon="⚙️"
            title="Configuration"
            href="https://example.com/config"
            arrow
          >
            Learn how to configure your setup.
          </Cards.Card>
          <Cards.Card
            icon="🚀"
            title="Deployment"
            href="https://example.com/deploy"
            arrow
          >
            Deploy your application.
          </Cards.Card>
        </Cards>
      </Section>

      <Section title="Cards (2 columns, no links)">
        <Cards num={2}>
          <Cards.Card icon="📖" title="Documentation">
            Comprehensive documentation.
          </Cards.Card>
          <Cards.Card icon="💬" title="Community">
            Join the community.
          </Cards.Card>
        </Cards>
      </Section>

      <Section title="FileTree" description="Directory structure (wraps Starlight FileTree)">
        <FileTree>
          <ul>
            <li>
              pages/
              <ul>
                <li>index.mdx</li>
                <li>
                  docs/
                  <ul>
                    <li>getting-started.mdx</li>
                    <li><strong>api-reference.mdx</strong></li>
                  </ul>
                </li>
                <li>_meta.json</li>
              </ul>
            </li>
            <li>next.config.mjs</li>
            <li>package.json</li>
          </ul>
        </FileTree>
      </Section>

      <Section title="Steps" description="Numbered steps (wraps Starlight Steps)">
        <Steps>
          <ol>
            <li>
              <strong>Create a Nextra project</strong>
              <p>
                Run <code>npx create-nextra-app</code> to scaffold a new project.
              </p>
            </li>
            <li>
              <strong>Add your content</strong>
              <p>Create <code>.mdx</code> files in the <code>pages/</code> directory.</p>
            </li>
            <li>
              <strong>Start the dev server</strong>
              <p>
                Run <code>npm run dev</code> and open{' '}
                <code>http://localhost:3000</code>.
              </p>
            </li>
          </ol>
        </Steps>
      </Section>

      <Section title="Bleed" description="Full-width content w/ typography options">
        <Bleed>
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            Full-width bleed content — breaks out of the content container.
          </div>
        </Bleed>
      </Section>

      <Section title="Bleed w/ size & weight">
        <Bleed size="lg" weight="semibold" align="center" height="sm">
          Large, semibold, centered bleed content.
        </Bleed>
      </Section>
    </div>
  );
}
