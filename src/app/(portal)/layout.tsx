import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Your customer report',
  description: 'What your customers are saying about your business.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * THE CLIENT PORTAL (M12).
 *
 * A SEPARATE root layout on purpose, in the same way the print routes are.
 * The operator's sidebar, client switcher and internal navigation never render
 * here — not hidden with CSS, but absent from the tree — so there is no route
 * from this page to another client or to the tool's internals.
 *
 * Everything below is the business owner's own data, in their own language.
 */
export default function PortalRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-50">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </div>
      </body>
    </html>
  );
}
