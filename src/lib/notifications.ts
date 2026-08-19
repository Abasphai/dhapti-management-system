export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type NotificationType =
  | "SYSTEM"
  | "ANNOUNCEMENT"
  | "ASSIGNMENT"
  | "GRADE"
  | "QUIZ"
  | "ATTENDANCE"
  | "ACADEMIC"
  | "SECURITY"
  | "DEADLINE"
  | "RESULT"
  | "MESSAGE"
  | "ADMISSION"
  | "ELECTION";

export interface InboxNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  sourceType: string | null;
  sourceId: string | null;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  receivedAt: string;
}

export interface SentNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  sourceType: string | null;
  sourceId: string | null;
  link: string | null;
  createdAt: string;
  recipientCount: number;
  readCount?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function priorityBadgeVariant(
  priority: NotificationPriority
): "secondary" | "info" | "warning" | "danger" {
  if (priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "LOW") return "secondary";
  return "info";
}

export function formatNotificationTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
