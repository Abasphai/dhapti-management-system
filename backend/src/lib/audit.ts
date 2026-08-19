import { prisma } from "./prisma.js";

/** Shared audit writer for domain modules (Phase 7). */
export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditLog
    .create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metaJson: input.meta ? JSON.stringify(input.meta) : null,
      },
    })
    .catch(() => {});
}
