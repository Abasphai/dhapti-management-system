import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const [users, students, teachers, admins] = await Promise.all([
  p.user.count(),
  p.student.count(),
  p.teacher.count(),
  p.admin.count(),
]);
console.log(JSON.stringify({ users, students, teachers, admins }, null, 2));
await p.$disconnect();
