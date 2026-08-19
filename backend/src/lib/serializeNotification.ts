import type { NotificationPriority, NotificationType } from "@prisma/client";

export function serializeInboxItem(row: {
  id: string;
  readAt: Date | null;
  createdAt: Date;
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    sourceType: string | null;
    sourceId: string | null;
    link: string | null;
    createdAt: Date;
  };
}) {
  return {
    id: row.notification.id,
    recipientId: row.id,
    type: row.notification.type,
    title: row.notification.title,
    message: row.notification.message,
    priority: row.notification.priority,
    sourceType: row.notification.sourceType,
    sourceId: row.notification.sourceId,
    link: row.notification.link,
    read: row.readAt != null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.notification.createdAt.toISOString(),
    receivedAt: row.createdAt.toISOString(),
  };
}

export function serializeSentNotification(row: {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  sourceType: string | null;
  sourceId: string | null;
  link: string | null;
  createdAt: Date;
  _count?: { recipients: number };
  recipients?: { readAt: Date | null }[];
}) {
  const total = row._count?.recipients ?? row.recipients?.length ?? 0;
  const read =
    row.recipients?.filter((r) => r.readAt != null).length ?? undefined;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
    recipientCount: total,
    ...(read != null ? { readCount: read } : {}),
  };
}
