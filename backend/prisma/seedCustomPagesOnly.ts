/**
 * Idempotent seed for custom CMS pages only (no full DB wipe).
 * Usage: npx tsx prisma/seedCustomPagesOnly.ts
 */
import { PrismaClient } from "@prisma/client";

import { seedCustomPages } from "./seedCms.js";

const prisma = new PrismaClient();

async function main() {
  await seedCustomPages(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Done.");
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
