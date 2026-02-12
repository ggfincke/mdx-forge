// dev/pages/GenericPage.tsx
// Showcase for generic framework-agnostic components

import {
  Callout,
  Alert,
  Admonition,
  Collapsible,
  Accordion,
  Tabs,
  TabItem,
  CodeGroup,
} from '@forge/components/generic';
import '@forge/components/styles/generic.css';
import { Section } from '../components/Section';

export function GenericPage() {
  return (
    <div>
      <h1>Generic Components</h1>

      <Section title="Callout Types" description="All 7 callout types w/ default titles & icons">
        <Callout type="note">
          <strong>Note</strong> — General information and context. Blue color scheme.
        </Callout>
        <Callout type="tip">
          <strong>Tip</strong> — Helpful suggestions and best practices. Green color scheme.
        </Callout>
        <Callout type="info">
          <strong>Info</strong> — Informational content. Blue color scheme.
        </Callout>
        <Callout type="warning">
          <strong>Warning</strong> — Potential issues and gotchas. Amber color scheme.
        </Callout>
        <Callout type="danger">
          <strong>Danger</strong> — Critical warnings. Red color scheme.
        </Callout>
        <Callout type="caution">
          <strong>Caution</strong> — Proceed with care. Amber color scheme.
        </Callout>
        <Callout type="important">
          <strong>Important</strong> — Key information. Purple color scheme.
        </Callout>
      </Section>

      <Section title="Callout Aliases" description="Alert & Admonition are aliases for Callout">
        <Alert type="tip">
          This uses the <code>Alert</code> component — same as Callout.
        </Alert>
        <Admonition type="warning">
          This uses the <code>Admonition</code> component — also the same.
        </Admonition>
      </Section>

      <Section title="Custom Title & Icon" description="Override default title & icon">
        <Callout type="tip" title="Pro Tip">
          Custom title overrides the default "Tip" heading.
        </Callout>
        <Callout type="danger" title="Security Advisory">
          A critical vulnerability has been discovered. Update immediately.
        </Callout>
        <Callout type="note" icon="🎉">
          Custom emoji icon instead of the default info icon.
        </Callout>
        <Callout type="warning" icon="🚀">
          Rocket emoji for launch-related warnings.
        </Callout>
      </Section>

      <Section title="Collapsible" description="Expandable sections w/ default closed & open states">
        <Collapsible title="Default closed — click to expand">
          This content is hidden by default. It can contain any content:
          <ul>
            <li>Lists</li>
            <li><strong>Formatting</strong></li>
            <li><code>Code</code></li>
          </ul>
        </Collapsible>
        <Collapsible title="Default open" defaultOpen>
          This section starts expanded. Use <code>defaultOpen</code> for important
          content that should be visible by default.
        </Collapsible>
        <Accordion title="Accordion alias">
          Same component as Collapsible, just a different name.
        </Accordion>
      </Section>

      <Section title="Nested Collapsibles">
        <Collapsible title="Outer section">
          Outer content here.
          <Collapsible title="Nested section">
            This is nested inside the outer collapsible.
          </Collapsible>
          More content after the nested part.
        </Collapsible>
      </Section>

      <Section title="Tabs" description="Tabbed content w/ basic usage & defaultValue">
        <Tabs>
          <TabItem value="js" label="JavaScript">
            <pre><code>{`function greet(name) {\n  return \`Hello, \${name}!\`;\n}`}</code></pre>
          </TabItem>
          <TabItem value="ts" label="TypeScript">
            <pre><code>{`function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`}</code></pre>
          </TabItem>
          <TabItem value="py" label="Python">
            <pre><code>{`def greet(name):\n    return f"Hello, {name}!"`}</code></pre>
          </TabItem>
        </Tabs>
      </Section>

      <Section title="Tabs w/ defaultValue" description="Second tab selected by default">
        <Tabs defaultValue="option2">
          <TabItem value="option1" label="Option 1">
            Not selected by default.
          </TabItem>
          <TabItem value="option2" label="Option 2">
            <strong>This tab is selected by default</strong> via{' '}
            <code>defaultValue="option2"</code>.
          </TabItem>
          <TabItem value="option3" label="Option 3">
            Also not selected by default.
          </TabItem>
        </Tabs>
      </Section>

      <Section
        title="CodeGroup"
        description="Tabbed code blocks — labels auto-extracted from children"
      >
        <CodeGroup>
          <pre title="JavaScript">
            <code className="language-javascript">{`function add(a, b) {\n  return a + b;\n}`}</code>
          </pre>
          <pre title="TypeScript">
            <code className="language-typescript">{`function add(a: number, b: number): number {\n  return a + b;\n}`}</code>
          </pre>
          <pre title="Python">
            <code className="language-python">{`def add(a, b):\n    return a + b`}</code>
          </pre>
        </CodeGroup>
      </Section>

      <Section title="CodeGroup w/ explicit labels">
        <CodeGroup labels={['Client', 'Server', 'Types']}>
          <pre>
            <code>{`async function fetchData() {\n  const res = await fetch('/api/data');\n  return res.json();\n}`}</code>
          </pre>
          <pre>
            <code>{`app.get('/api/data', (req, res) => {\n  res.json({ message: 'Hello!' });\n});`}</code>
          </pre>
          <pre>
            <code>{`interface ApiResponse {\n  message: string;\n}`}</code>
          </pre>
        </CodeGroup>
      </Section>
    </div>
  );
}
