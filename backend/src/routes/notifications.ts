import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { sendError } from "../lib/errors.js";
import {
  countUnreadNotifications,
  createNotification,
  markAllNotificationsRead,
  markNotificationRead,
  resolveUserIdsForAudience,
  type NotificationAudience,
} from "../lib/notifications.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  serializeInboxItem,
  serializeSentNotification,
} from "../lib/serializeNotification.js";
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const typeSchema = z.enum([
  "SYSTEM",
  "ANNOUNCEMENT",
  "ASSIGNMENT",
  "GRADE",
  "QUIZ",
  "ATTENDANCE",
  "ACADEMIC",
  "SECURITY",
  "DEADLINE",
  "RESULT",
  "MESSAGE",
  "ADMISSION",
  "ELECTION",
]);

const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const audienceSchema = z.enum([
  "STUDENTS",
  "TEACHERS",
  "ADMINS",
  "STUDENTS_TEACHERS",
  "EVERYONE",
  "USERS",
]);

/** GET /notifications — authenticated user's inbox */
notificationsRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const unread = String(req.query.unread ?? "").trim().toLowerCase();
  const type = String(req.query.type ?? "").trim().toUpperCase();

  const and: Prisma.NotificationRecipientWhereInput[] = [{ userId }];
  if (unread === "true" || unread === "1") {
    and.push({ readAt: null });
  } else if (unread === "false" || unread === "0") {
    and.push({ readAt: { not: null } });
  }
  if (type && typeSchema.safeParse(type).success) {
    and.push({ notification: { type: type as z.infer<typeof typeSchema> } });
  }

  const where: Prisma.NotificationRecipientWhereInput = { AND: and };

  const [total, rows] = await Promise.all([
    prisma.notificationRecipient.count({ where }),
    prisma.notificationRecipient.findMany({
      where,
      include: { notification: true },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
    }),
  ]);

  return res.json({
    data: rows.map(serializeInboxItem),
    pagination: paginationMeta(total, page, pageSize),
  });
});

/** GET /notifications/unread-count */
notificationsRouter.get("/unread-count", async (req: AuthedRequest, res) => {
  const count = await countUnreadNotifications(req.user!.id);
  return res.json({ count });
});

/** GET /notifications/sent — Admin created/sent list */
notificationsRouter.get(
  "/sent",
  requirePermission(Permission.NOTIFICATIONS_CREATE),
  async (req, res) => {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const q = String(req.query.q ?? "").trim();
    const type = String(req.query.type ?? "").trim().toUpperCase();
    const priority = String(req.query.priority ?? "").trim().toUpperCase();

    const and: Prisma.NotificationWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { message: { contains: q } },
        ],
      });
    }
    if (type && typeSchema.safeParse(type).success) {
      and.push({ type: type as z.infer<typeof typeSchema> });
    }
    if (priority && prioritySchema.safeParse(priority).success) {
      and.push({ priority: priority as z.infer<typeof prioritySchema> });
    }

    const where: Prisma.NotificationWhereInput = and.length ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        include: {
          _count: { select: { recipients: true } },
          recipients: { select: { readAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeSentNotification),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);

/** POST /notifications/read-all — before /:id routes */
notificationsRouter.post("/read-all", async (req: AuthedRequest, res) => {
  const updated = await markAllNotificationsRead(req.user!.id);
  return res.json({ updated });
});

/** POST /notifications — Admin create announcement */
notificationsRouter.post(
  "/",
  requirePermission(Permission.NOTIFICATIONS_CREATE),
  async (req: AuthedRequest, res) => {
    const schema = z.object({
      title: z.string().trim().min(2).max(200),
      message: z.string().trim().min(1).max(5000),
      type: typeSchema.optional(),
      priority: prioritySchema.optional(),
      audience: audienceSchema,
      userIds: z.array(z.string().min(1)).max(500).optional(),
      link: z.string().max(500).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid notification payload");
    }
    if (
      parsed.data.audience === "USERS" &&
      !(parsed.data.userIds && parsed.data.userIds.length)
    ) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "userIds required when audience is USERS"
      );
    }

    const userIds = await resolveUserIdsForAudience(
      parsed.data.audience as NotificationAudience,
      parsed.data.userIds
    );
    if (!userIds.length) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "No active recipients for this audience"
      );
    }

    const result = await createNotification({
      type: parsed.data.type ?? "ANNOUNCEMENT",
      title: parsed.data.title,
      message: parsed.data.message,
      priority: parsed.data.priority ?? "NORMAL",
      sourceType: "ANNOUNCEMENT",
      sourceId: null,
      link: parsed.data.link ?? null,
      createdById: req.user!.id,
      userIds,
    });

    if (!result.notification) {
      return sendError(res, 400, "BAD_REQUEST", "Failed to create notification");
    }

    return res.status(201).json({
      id: result.notification.id,
      recipientCount: result.recipientCount,
      skipped: result.skipped,
    });
  }
);

/** GET /notifications/:id — own inbox item */
notificationsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const notificationId = paramId(req.params.id);
  const row = await prisma.notificationRecipient.findUnique({
    where: {
      notificationId_userId: {
        notificationId,
        userId: req.user!.id,
      },
    },
    include: { notification: true },
  });
  if (!row) {
    return sendError(res, 404, "NOT_FOUND", "Notification not found");
  }
  return res.json(serializeInboxItem(row));
});

/** PATCH /notifications/:id/read */
notificationsRouter.patch("/:id/read", async (req: AuthedRequest, res) => {
  const notificationId = paramId(req.params.id);
  const updated = await markNotificationRead(req.user!.id, notificationId);
  if (!updated) {
    return sendError(res, 404, "NOT_FOUND", "Notification not found");
  }
  const row = await prisma.notificationRecipient.findUnique({
    where: { id: updated.id },
    include: { notification: true },
  });
  return res.json(serializeInboxItem(row!));
});
