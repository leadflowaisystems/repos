import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/marketing/site';

/**
 * What a crawler may read (M26).
 *
 * One page is public: the front door. Everything else on this server is
 * somebody's workspace, a customer's feedback page, a print sheet or a
 * sign-in step, and every one of those layouts already says `noindex`; this
 * file keeps crawlers from fetching them in the first place. The middleware
 * exempts this path from the session check, so it is readable signed out.
 */
export default function robots(): MetadataRoute.Robots {
  const home = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/workspace/',
          '/clients',
          '/clients/',
          '/minutes',
          '/settings',
          '/feedback/',
          '/portal/',
          '/print/',
          '/auth/',
          '/invite/',
          '/onboarding',
          '/forgot-password',
          '/reset-password',
          '/welcome',
        ],
      },
    ],
    ...(home ? { sitemap: `${home}/sitemap.xml` } : {}),
  };
}
