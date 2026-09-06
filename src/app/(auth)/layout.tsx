import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Sign in · Headway',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * The login page has its own root layout, the way the portal, the print sheets
 * and the customer feedback page do — so the operator's navigation is absent
 * from the tree rather than hidden by CSS. A signed-out visitor cannot see the
 * shape of the tool, let alone its client list.
 */
export default function AuthRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-50">
        <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
          {children}
        </div>
      </body>
    </html>
  );
}
