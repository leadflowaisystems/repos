import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/marketing/site';

/**
 * The one public address (M26). Everything else on this server belongs to
 * somebody and is kept out of `robots.ts`; there is nothing else to list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const home = siteUrl() ?? 'http://localhost:3000';
  return [{ url: `${home}/`, changeFrequency: 'monthly', priority: 1 }];
}
