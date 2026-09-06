import type { Metadata } from 'next';
import { requireOperator } from '@/lib/auth/guard';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Headway — print',
  robots: { index: false, follow: false },
};

/**
 * Print routes are a SEPARATE root layout on purpose.
 *
 * They deliberately sit outside the application chrome — no sidebar, no tabs,
 * no client header — so what the operator sees on screen is exactly what comes
 * out of the printer. Route groups keep the URLs unchanged.
 */
export default async function PrintRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // A print sheet embeds the client's secret feedback token in a QR, so these
  // routes are operator-only even though they carry no navigation.
  await requireOperator();

  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-100 py-6 print:bg-white print:py-0">
        {children}
      </body>
    </html>
  );
}
