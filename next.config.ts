import type { NextConfig } from 'next';

/**
 * The public address, read once at startup.
 *
 * Server Actions are POSTs, and Next compares the request's Origin with its
 * Host before accepting one. Behind a reverse proxy those can differ, so the
 * proxy's public host is declared here — derived from the same setting the QR
 * codes use, so there is one address to configure and no way for the two to
 * disagree.
 */
const publicBaseUrl = process.env.REPOS_PUBLIC_BASE_URL?.trim();
const allowedOrigins = (() => {
  if (!publicBaseUrl) return [] as string[];
  try {
    return [new URL(publicBaseUrl).host];
  } catch {
    return [] as string[];
  }
})();

/**
 * Headers every response carries.
 *
 * `Referrer-Policy` is the load-bearing one: both the customer feedback page
 * and the owner's workspace are authorized by a secret in their URL, and the
 * thank-you page links out to a public review site. Without this, that secret
 * would travel to the destination in the Referer header.
 */
const securityHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // RepOS is local-first. No telemetry, no analytics, no external image loaders.
  images: { unoptimized: true },
  serverExternalPackages: ['@prisma/client'],
  poweredByHeader: false,
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't double-run during build.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          // Frames are refused outright above; this repeats it in the modern
          // directive for browsers that prefer CSP over X-Frame-Options.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
