import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

/**
 * Vercel serverless-safe Prisma singleton (driver adapter — no Rust query-engine binary).
 * Reuses pool + client across warm invocations.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in Vercel project Environment Variables."
    );
  }

  const needsSsl =
    process.env.NODE_ENV === "production" ||
    /supabase\.com|sslmode=require|ssl=true/i.test(connectionString);

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      // Supabase / managed Postgres on Vercel require TLS
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      // Serverless: one connection per warm instance (use Supabase pooler URL :6543)
      max: 1,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy proxy — avoids crashing module load if env is not ready yet. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
