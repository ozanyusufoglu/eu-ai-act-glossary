import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PanelFrame from '@/components/PanelFrame';
import TermArticle from '@/components/TermArticle';
import Wordmark from '@/components/Wordmark';
import { graph, termById, termPath } from '@/lib/graphData';
import { pageMetadata, siteName, siteUrl } from '@/lib/site';

// One static page per term in the data file; any other id is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return graph.terms.map(t => ({ id: t.id }));
}

/** Cut at a word boundary so search results show a whole phrase. */
function truncate(text: string, max = 155) {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.]$/, '')}…`;
}

export async function generateMetadata({ params }: PageProps<'/terms/[id]'>): Promise<Metadata> {
  const term = termById.get((await params).id);
  if (!term) return {};
  const title = term.abbreviations.length ? `${term.name} (${term.abbreviations[0]})` : term.name;
  return pageMetadata({
    title,
    shareTitle: `${title} | ${siteName}`,
    description: truncate(term.definition),
    path: termPath(term.id),
    type: 'article',
  });
}

export default async function TermPage({ params }: PageProps<'/terms/[id]'>) {
  const term = termById.get((await params).id);
  if (!term) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${siteUrl}${termPath(term.id)}`,
    url: `${siteUrl}${termPath(term.id)}`,
    name: term.name,
    ...(term.abbreviations.length || term.aliases.length
      ? { alternateName: [...term.abbreviations, ...term.aliases] }
      : {}),
    description: term.definition,
    inDefinedTermSet: { '@type': 'DefinedTermSet', '@id': `${siteUrl}/#terms`, name: siteName, url: siteUrl },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <Wordmark />
      {/* Keyed so the panel replays its entrance when moving between terms */}
      <PanelFrame key={term.id} label={term.name}>
        <TermArticle id={term.id} heading="h1" />
      </PanelFrame>
    </>
  );
}
