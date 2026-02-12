// dev/pages/StarlightPage.tsx
// Showcase for Starlight component shims

import {
  Aside,
  Card,
  CardGrid,
  LinkCard,
  Badge,
  Steps,
  FileTree,
  Code,
  Tabs,
  TabItem,
} from '@forge/components/starlight';
import '@forge/components/styles/starlight.css';
import { Section } from '../components/Section';

export function StarlightPage() {
  return (
    <div>
      <h1>Starlight Components</h1>

      <Section title="Aside" description="All 4 aside types w/ header layout">
        <Aside type="note">
          <strong>Note</strong> — A helpful piece of additional information.
        </Aside>
        <Aside type="tip">
          <strong>Tip</strong> — An optional suggestion to improve your workflow.
        </Aside>
        <Aside type="caution">
          <strong>Caution</strong> — Something to be aware of before proceeding.
        </Aside>
        <Aside type="danger">
          <strong>Danger</strong> — Critical warning about a potential breaking change.
        </Aside>
      </Section>

      <Section title="Aside w/ custom title">
        <Aside type="tip" title="Did you know?">
          You can override the default title with any string.
        </Aside>
      </Section>

      <Section title="Card" description="Content cards w/ icon & title">
        <Card title="Getting Started" icon="rocket">
          Learn the basics and set up your first project.
        </Card>
        <Card title="API Reference" icon="document">
          Complete API documentation for all modules.
        </Card>
        <Card title="Examples" icon="star">
          Browse example projects and templates.
        </Card>
      </Section>

      <Section title="CardGrid" description="Responsive card grid layout">
        <CardGrid>
          <Card title="Fast" icon="rocket">Lightning-fast build times.</Card>
          <Card title="Flexible" icon="star">Works with any framework.</Card>
          <Card title="Secure" icon="document">Built-in security features.</Card>
        </CardGrid>
      </Section>

      <Section title="CardGrid w/ stagger" description="Staggered animation variant">
        <CardGrid stagger>
          <Card title="Step 1">Install the package.</Card>
          <Card title="Step 2">Configure your project.</Card>
          <Card title="Step 3">Start building.</Card>
          <Card title="Step 4">Deploy to production.</Card>
        </CardGrid>
      </Section>

      <Section title="LinkCard" description="Cards that link to external pages">
        <LinkCard
          title="Documentation"
          description="Read the full documentation for detailed guides."
          href="https://example.com/docs"
        />
        <LinkCard
          title="GitHub Repository"
          description="View source code and contribute."
          href="https://github.com/example/repo"
        />
      </Section>

      <Section title="Badge" description="Inline badge variants & sizes">
        <p>
          Variants:{' '}
          <Badge text="Default" variant="default" />{' '}
          <Badge text="Note" variant="note" />{' '}
          <Badge text="Tip" variant="tip" />{' '}
          <Badge text="Caution" variant="caution" />{' '}
          <Badge text="Danger" variant="danger" />{' '}
          <Badge text="Success" variant="success" />
        </p>
        <p>
          Sizes:{' '}
          <Badge text="Small" size="small" variant="note" />{' '}
          <Badge text="Medium" size="medium" variant="tip" />{' '}
          <Badge text="Large" size="large" variant="caution" />
        </p>
      </Section>

      <Section title="Steps" description="Numbered step-by-step instructions">
        <Steps>
          <ol>
            <li>
              <strong>Install dependencies</strong>
              <p>Run <code>npm install</code> in your project directory.</p>
            </li>
            <li>
              <strong>Configure the project</strong>
              <p>Create a config file and set your options.</p>
            </li>
            <li>
              <strong>Start development</strong>
              <p>Run <code>npm run dev</code> to start the dev server.</p>
            </li>
            <li>
              <strong>Deploy</strong>
              <p>Build and deploy to your hosting platform.</p>
            </li>
          </ol>
        </Steps>
      </Section>

      <Section title="FileTree" description="Directory structure visualization">
        <FileTree>
          <ul>
            <li>
              src/
              <ul>
                <li>
                  components/
                  <ul>
                    <li><strong>App.tsx</strong></li>
                    <li>Header.tsx</li>
                    <li>Footer.tsx</li>
                  </ul>
                </li>
                <li>
                  utils/
                  <ul>
                    <li>helpers.ts</li>
                    <li>...</li>
                  </ul>
                </li>
                <li>index.ts</li>
              </ul>
            </li>
            <li>package.json</li>
            <li>tsconfig.json</li>
            <li>README.md</li>
          </ul>
        </FileTree>
      </Section>

      <Section title="Code" description="Code block w/ title & frame support">
        <Code
          code={`const greeting = "Hello, World!";\nconsole.log(greeting);`}
          lang="javascript"
          title="src/index.js"
        />
      </Section>

      <Section title="Code w/ terminal frame">
        <Code
          code={`$ npm install mdx-forge\n$ npm run build\nBuild completed successfully.`}
          lang="bash"
          frame="terminal"
          title="Terminal"
        />
      </Section>

      <Section title="Tabs" description="Starlight tab component">
        <Tabs>
          <TabItem label="npm" value="npm">
            <pre><code>npm install mdx-forge</code></pre>
          </TabItem>
          <TabItem label="pnpm" value="pnpm">
            <pre><code>pnpm add mdx-forge</code></pre>
          </TabItem>
          <TabItem label="Yarn" value="yarn">
            <pre><code>yarn add mdx-forge</code></pre>
          </TabItem>
        </Tabs>
      </Section>
    </div>
  );
}
