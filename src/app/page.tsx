import type { Metadata } from 'next';
import Link from 'next/link';
import PanelFrame from '@/components/PanelFrame';
import TermArticle from '@/components/TermArticle';
import Wordmark from '@/components/Wordmark';
import { DEFAULT_TERM, graph, termById, termPath } from '@/lib/graphData';
import { pageMetadata, siteDescription, siteName, siteUrl } from '@/lib/site';

export const metadata: Metadata = pageMetadata({ description: siteDescription, path: '/' });

// schema.org structured data: the site, and the glossary as a set of terms that each have their own page.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: siteName, description: siteDescription, inLanguage: 'en' },
    {
      '@type': 'DefinedTermSet',
      '@id': `${siteUrl}/#terms`,
      name: `${siteName}: AI Act, GDPR and Shadow AI terms`,
      url: siteUrl,
      hasDefinedTerm: graph.terms.map(t => ({ '@type': 'DefinedTerm', name: t.name, url: `${siteUrl}${termPath(t.id)}` })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so no string in the data can close the script tag (per the Next.js JSON-LD guide)
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <Wordmark heading />

      {/* The graph opens on the default term, so the home page shows its panel */}
      <PanelFrame label={termById.get(DEFAULT_TERM)!.name}>
        <TermArticle id={DEFAULT_TERM} heading="h2" />
      </PanelFrame>

      {/* The graph is WebGL-only; this index gives screen readers and crawlers a way to every term */}
      <nav aria-label="All terms" className="sr-only">
        <p>{siteDescription}</p>
        {graph.topics.map(topic => (
          <section key={topic.id}>
            <h2>{topic.name}</h2>
            <ul>
              {graph.terms
                .filter(t => t.topic === topic.id)
                .map(t => (
                  <li key={t.id}>
                    <Link href={termPath(t.id)} prefetch={false}>
                      {t.name}
                      {t.abbreviations.length > 0 && ` (${t.abbreviations.join(', ')})`}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </nav>
    </>
  );
}
