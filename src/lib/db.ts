import { PrismaClient } from '@prisma/client';

/**
 * Single Prisma client for the whole app.
 *
 * Next.js dev mode re-evaluates modules on every hot reload, so the client is
 * cached on globalThis to avoid opening a new SQLite handle each time.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
