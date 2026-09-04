import type { Metadata, Viewport } from 'next';
import { Nav } from '@/components/nav';
import { SignOutButton } from '@/components/sign-out';
import { aiStatus } from '@/lib/ai';
import { requireOperator } from '@/lib/auth/guard';
import '../globals.css';

export const metadata: Metadata = {
  title: 'RepOS',
  description:
    'Local-first customer intelligence operating system. Internal operator tool.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Third layer, after middleware and each action's own check: no operator
  // page renders without a session, even if a matcher is ever changed.
  await requireOperator();

  // Server-side only: this reports which providers are configured, never a key.
  const ai = aiStatus();

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="flex min-h-dvh flex-col md:flex-row">
          <Nav aiNote={ai.note} signOut={<SignOutButton />} />
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
