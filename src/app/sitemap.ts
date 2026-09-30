import type { MetadataRoute } from 'next';
import { graph, termPath } from '@/lib/graphData';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: siteUrl, lastModified, changeFrequency: 'monthly', priority: 1 },
    ...graph.terms.map(t => ({
      url: `${siteUrl}${termPath(t.id)}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
