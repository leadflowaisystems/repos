import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Feedback',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * THE CUSTOMER FEEDBACK PAGE (M14).
 *
 * A separate root layout, the way the owner portal and the print sheets are.
 * The operator's navigation is not hidden here — it is absent from the tree,
 * so nothing on this page can lead anywhere inside RepOS.
 *
 * It is one column on a phone and stays one column on a desktop. A customer
 * standing at a counter should see the question, the stars and the box.
 */
export default function FeedbackRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-ink-900">
        <div className="mx-auto w-full max-w-md px-5 pt-10 pb-12 sm:pt-16">{children}</div>
      </body>
    </html>
  );
}
