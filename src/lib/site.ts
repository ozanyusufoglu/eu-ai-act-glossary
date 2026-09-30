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
