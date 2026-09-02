import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // RepOS is local-first. No telemetry, no analytics, no external image loaders.
  images: { unoptimized: true },
  // playwright-core is only ever loaded inside server-side route handlers.
  serverExternalPackages: ['playwright-core', '@prisma/client'],
  poweredByHeader: false,
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't double-run during build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
