import { PrismaClient } from "@prisma/client";

/**
 * Vercel serverless-safe Prisma singleton.
 * Reuses the client across warm invocations; avoids exhausting DB connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

globalForPrisma.prisma = prisma;
