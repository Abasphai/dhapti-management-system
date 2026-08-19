import { prisma } from "../prisma.js";

export async function writeCmsAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditLog
    .create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metaJson: input.meta ? JSON.stringify(input.meta) : null,
      },
    })
    .catch(() => {});
}
