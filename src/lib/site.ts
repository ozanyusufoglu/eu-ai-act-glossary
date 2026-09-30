import type { Metadata } from 'next';
import { graph } from '@/lib/graphData';

// Canonical site URL. NEXT_PUBLIC_SITE_URL wins (set it once you have a custom domain);
// otherwise Vercel's production domain is injected at build time.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (productionHost ? `https://${productionHost}` : 'http://localhost:3000');

export const siteName = 'EU AI Act & GDPR Glossary';
export const siteTitle = 'EU AI Act & GDPR Glossary: a 3D knowledge graph';
// Kept under ~160 characters so search results don't truncate it.
export const siteDescription =
  `Interactive 3D map of ${graph.terms.length} EU AI Act, GDPR and Shadow AI terms and how they connect. Search a term like DPIA or click a node to read its definition.`;

/** Per-page metadata: canonical URL plus matching Open Graph and Twitter text. */
export function pageMetadata({ title, shareTitle = title, description, path, type = 'website' }: {
  /** Omit on the home page to use the site-wide default title. */
  title?: string;
  shareTitle?: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}): Metadata {
  // The home page gets src/app/opengraph-image.tsx automatically. A nested page that sets its
  // own openGraph does not inherit it, so point at the same image explicitly.
  // (Spread in only when set: an explicit `images: undefined` would drop the home page's image too.)
  const images = path === '/' ? {} : { images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: siteTitle }] };
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { type, url: path, siteName, title: shareTitle ?? siteTitle, description, ...images },
    twitter: { card: 'summary_large_image', title: shareTitle ?? siteTitle, description, ...images },
  };
}
