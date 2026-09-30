import GraphClient from '@/components/GraphClient';
import { graph } from '@/lib/graphData';
import { siteDescription, siteName, siteUrl } from '@/lib/site';

// schema.org structured data: the site, and the glossary as a DefinedTermSet,
// so search engines can read each term as a named, defined concept.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name: siteName, description: siteDescription, inLanguage: 'en' },
    {
      '@type': 'DefinedTermSet',
      '@id': `${siteUrl}/#terms`,
      name: `${siteName}: AI Act, GDPR and Shadow AI terms`,
      url: siteUrl,
      hasDefinedTerm: graph.terms.map(t => ({
        '@type': 'DefinedTerm',
        '@id': `${siteUrl}/#${t.id}`,
        name: t.name,
        ...(t.abbreviations.length || t.aliases.length ? { alternateName: [...t.abbreviations, ...t.aliases] } : {}),
        description: t.definition,
        inDefinedTermSet: `${siteUrl}/#terms`,
      })),
    },
  ],
};

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden" style={{ background: '#eaeaec' }}>
      <script
        type="application/ld+json"
        // Escape "<" so no string in the data can close the script tag (per the Next.js JSON-LD guide)
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <GraphClient />

      {/* Top-left wordmark */}
      <div className="absolute top-6 left-4 sm:left-8 z-10 pointer-events-none">
        <h1 className="text-xs font-semibold tracking-widest text-black/40">{siteName}</h1>
      </div>

      {/* Server-rendered glossary for crawlers and screen readers; the graph itself is WebGL-only */}
      <section className="sr-only">
        <p>{siteDescription}</p>
        {graph.topics.map(topic => (
          <section key={topic.id}>
            <h2>{topic.name}</h2>
            <dl>
              {graph.terms
                .filter(t => t.topic === topic.id)
                .map(t => (
                  <div key={t.id}>
                    <dt>
                      {t.name}
                      {t.abbreviations.length > 0 && ` (${t.abbreviations.join(', ')})`}
                    </dt>
                    <dd>{t.definition}</dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </section>
    </main>
  );
}
