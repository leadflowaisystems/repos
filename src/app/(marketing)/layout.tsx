import type { Metadata, Viewport } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from '@/lib/marketing/site';
import '../globals.css';
import './marketing.css';

/**
 * THE PUBLIC WEBSITE'S ROOT (M26).
 *
 * Its own root layout, like the workspace, the customer page and the print
 * sheets: nothing from the operator console or the workspace is in this tree,
 * so a stranger reading about Headway can reach nothing inside it.
 *
 * This is the one root in the application that asks to be indexed. Every
 * other layout says `index: false`, and keeps saying it.
 */

const home = siteUrl();

export const metadata: Metadata = {
  // The address the printed cards use, so the canonical link and the social
  // preview name the same home the QR codes do. Absent, Next falls back to
  // the local address, which is right for a development build.
  ...(home ? { metadataBase: new URL(home) } : {}),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Headway — turn customer feedback into better decisions' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#102A43',
};

export default function MarketingRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-50 text-ink-900">{children}</body>
    </html>
  );
}
