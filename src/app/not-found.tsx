import './globals.css';

/**
 * The address doesn't exist (M16).
 *
 * RepOS has several separate root layouts, and an address matching none of
 * them lands here — so this page brings its own document. It is written for a
 * stranger, because a stranger is who usually reaches it: no product name, no
 * internal words, no hint about what else might be on this server.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink-50">
        <main className="mx-auto w-full max-w-xl px-6 py-24">
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
            This page isn&rsquo;t here.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
            Check the link you followed, or ask whoever sent it to you for the current one.
          </p>
        </main>
      </body>
    </html>
  );
}
