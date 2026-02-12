// dev/components/Section.tsx
// Reusable section wrapper for showcase demos

import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="dev-section">
      <h2 className="dev-section-title">{title}</h2>
      {description && <p className="dev-section-desc">{description}</p>}
      <div className="dev-section-content">{children}</div>
    </section>
  );
}
