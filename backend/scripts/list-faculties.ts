import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.faculty.findMany({
  select: {
    code: true,
    name: true,
    status: true,
    _count: { select: { departments: true } },
  },
  orderBy: { code: "asc" },
});
console.log(`Faculty count: ${rows.length}`);
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
