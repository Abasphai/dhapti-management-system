/**
 * Default Prisma seed — production-clean (1 master admin + 6 faculties).
 * Guarantees admin@dhapti.edu.so / DHAPTI@2026 with role ADMIN.
 * For local/demo test data, run: npm run db:seed:demo
 */
import { PrismaClient } from "@prisma/client";

import { runCleanProductionSeed } from "./cleanSeed.js";

const prisma = new PrismaClient();

async function main() {
  await runCleanProductionSeed(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
