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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  // Keep singleton on warm serverless instances
  globalForPrisma.prisma = prisma;
}
