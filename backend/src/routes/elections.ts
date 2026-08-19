import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import {
  assertDatesValid,
  calculateElectionResults,
  canEditElectionMeta,
  ELECTION_TRANSITIONS,
  electionDetailInclude,
  electionListInclude,
  isBallotLocked,
  isUserEligibleToVote,
  maybeAutoCloseElection,
  notifyElectionLifecycle,
  resolveEligibleUserIds,
  validateElectionReadyToOpen,
  votingWindowOpen,
  writeElectionAudit,
  studentsCanSeeResults,
} from "../lib/elections.js";
import { sendError } from "../lib/errors.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { Permission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  serializeAuditLog,
  serializeCandidate,
  serializeElectionDetail,
  serializeElectionSummary,
  serializePosition,
  serializeResultsPayload,
} from "../lib/serializeElection.js";
import {
  requireAuth,
  requirePermission,
  requireRoles,
  type AuthedRequest,
} from "../middleware/auth.js";

export const electionsRouter = Router();

electionsRouter.use(requireAuth);

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveAdmin(userId: string) {
  return prisma.admin.findUnique({
    where: { userId },
    select: { id: true },
  });
}

async function resolveStudent(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
    include: { user: { select: { status: true, role: true } } },
  });
}

const resultVisibilitySchema = z.enum([
  "HIDDEN",
  "LIVE",
  "AFTER_CLOSED",
  "AFTER_FINALIZED",
]);
const eligibilityModeSchema = z.enum([
  "ALL_ACTIVE_STUDENTS",
  "SELECTED_STUDENTS",
]);

const createElectionSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  resultVisibility: resultVisibilitySchema.optional(),
  eligibilityMode: eligibilityModeSchema.optional(),
});

const updateElectionSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  resultVisibility: resultVisibilitySchema.optional(),
  eligibilityMode: eligibilityModeSchema.optional(),
});

/** GET /elections — role-aware list */
electionsRouter.get("/", async (req: AuthedRequest, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const q = String(req.query.q ?? "").trim();
  const status = String(req.query.status ?? "").trim().toUpperCase();
  const role = req.user!.role;

  const and: Prisma.ElectionWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
      ],
    });
  }
  if (
    status &&
    ["DRAFT", "PUBLISHED", "OPEN", "CLOSED", "FINALIZED", "ARCHIVED"].includes(
      status
    )
  ) {
    and.push({ status: status as Prisma.EnumElectionStatusFilter["equals"] });
  }

  if (role === "STUDENT") {
    and.push({
      status: { in: ["PUBLISHED", "OPEN", "CLOSED", "FINALIZED", "ARCHIVED"] },
    });
  } else if (role === "TEACHER") {
    return sendError(res, 403, "FORBIDDEN", "Teachers cannot access elections");
  } else if (role !== "ADMIN") {
    return sendError(res, 403, "FORBIDDEN", "Forbidden");
  }

  const where: Prisma.ElectionWhereInput = and.length ? { AND: and } : {};

  const [total, rows] = await Promise.all([
    prisma.election.count({ where }),
    prisma.election.findMany({
      where,
      include: electionListInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  // Auto-close expired OPEN elections when listed
  for (const row of rows) {
    if (row.status === "OPEN" && row.endsAt.getTime() <= Date.now()) {
      await maybeAutoCloseElection(row.id);
    }
  }

  const refreshed = await prisma.election.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: electionListInclude,
    orderBy: { createdAt: "desc" },
  });

  const data = [];
  for (const row of refreshed.length ? refreshed : rows) {
    const eligibleIds = await resolveEligibleUserIds(row);
    const voters = await prisma.electionVote.groupBy({
      by: ["voterUserId"],
      where: { electionId: row.id },
    });
    const extras: {
      eligibleVoters: number;
      totalVoters: number;
      participationPercentage: number;
      hasVoted?: boolean;
      eligible?: boolean;
    } = {
      eligibleVoters: eligibleIds.length,
      totalVoters: voters.length,
      participationPercentage:
        eligibleIds.length === 0
          ? 0
          : Math.round((voters.length / eligibleIds.length) * 1000) / 10,
    };
    if (role === "STUDENT") {
      extras.eligible = await isUserEligibleToVote(row, req.user!.id);
      extras.hasVoted =
        (await prisma.electionVote.count({
          where: { electionId: row.id, voterUserId: req.user!.id },
        })) > 0;
    }
    data.push(serializeElectionSummary(row, extras));
  }

  return res.json({
    data,
    pagination: paginationMeta(total, page, pageSize),
  });
});

/** POST /elections — Admin create */
electionsRouter.post(
  "/",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const parsed = createElectionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid election payload");
    }
    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    const dateErr = await assertDatesValid(startsAt, endsAt);
    if (dateErr) return sendError(res, 400, "BAD_REQUEST", dateErr);

    const admin = await resolveAdmin(req.user!.id);
    if (!admin) {
      return sendError(res, 404, "NOT_FOUND", "Admin profile not found");
    }

    const created = await prisma.election.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        startsAt,
        endsAt,
        resultVisibility: parsed.data.resultVisibility ?? "AFTER_CLOSED",
        eligibilityMode: parsed.data.eligibilityMode ?? "ALL_ACTIVE_STUDENTS",
        createdById: admin.id,
        status: "DRAFT",
      },
      include: electionDetailInclude,
    });

    await writeElectionAudit({
      electionId: created.id,
      actorUserId: req.user!.id,
      action: "ELECTION_CREATED",
      metadata: { title: created.title },
    });

    return res.status(201).json(serializeElectionDetail(created));
  }
);

/** GET /elections/:id */
electionsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  await maybeAutoCloseElection(id);

  const row = await prisma.election.findUnique({
    where: { id },
    include: electionDetailInclude,
  });
  if (!row) return sendError(res, 404, "NOT_FOUND", "Election not found");

  if (req.user!.role === "TEACHER") {
    return sendError(res, 403, "FORBIDDEN", "Teachers cannot access elections");
  }
  if (req.user!.role === "STUDENT") {
    if (row.status === "DRAFT") {
      return sendError(res, 404, "NOT_FOUND", "Election not found");
    }
  } else if (req.user!.role !== "ADMIN") {
    return sendError(res, 403, "FORBIDDEN", "Forbidden");
  }

  const eligibleIds = await resolveEligibleUserIds(row);
  const voters = await prisma.electionVote.groupBy({
    by: ["voterUserId"],
    where: { electionId: id },
  });
  const extras: {
    eligibleVoters: number;
    totalVoters: number;
    participationPercentage: number;
    hasVoted?: boolean;
    eligible?: boolean;
  } = {
    eligibleVoters: eligibleIds.length,
    totalVoters: voters.length,
    participationPercentage:
      eligibleIds.length === 0
        ? 0
        : Math.round((voters.length / eligibleIds.length) * 1000) / 10,
  };
  if (req.user!.role === "STUDENT") {
    extras.eligible = await isUserEligibleToVote(row, req.user!.id);
    extras.hasVoted =
      (await prisma.electionVote.count({
        where: { electionId: id, voterUserId: req.user!.id },
      })) > 0;
  }

  return res.json(serializeElectionDetail(row, extras));
});

/** PATCH /elections/:id */
electionsRouter.patch(
  "/:id",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const parsed = updateElectionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid election payload");
    }

    const existing = await prisma.election.findUnique({ where: { id } });
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Election not found");
    if (!canEditElectionMeta(existing.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Election cannot be edited in its current status"
      );
    }

    const startsAt = parsed.data.startsAt
      ? new Date(parsed.data.startsAt)
      : existing.startsAt;
    const endsAt = parsed.data.endsAt
      ? new Date(parsed.data.endsAt)
      : existing.endsAt;
    const dateErr = await assertDatesValid(startsAt, endsAt);
    if (dateErr) return sendError(res, 400, "BAD_REQUEST", dateErr);

    if (
      parsed.data.eligibilityMode &&
      parsed.data.eligibilityMode !== existing.eligibilityMode &&
      isBallotLocked(existing.status)
    ) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Eligibility mode cannot change after voting starts"
      );
    }

    const updated = await prisma.election.update({
      where: { id },
      data: {
        title: parsed.data.title ?? undefined,
        description:
          parsed.data.description === undefined
            ? undefined
            : parsed.data.description,
        startsAt,
        endsAt,
        resultVisibility: parsed.data.resultVisibility ?? undefined,
        eligibilityMode: parsed.data.eligibilityMode ?? undefined,
      },
      include: electionDetailInclude,
    });

    await writeElectionAudit({
      electionId: id,
      actorUserId: req.user!.id,
      action: "ELECTION_UPDATED",
    });

    return res.json(serializeElectionDetail(updated));
  }
);

async function transitionElection(
  req: AuthedRequest,
  res: import("express").Response,
  nextStatus: import("@prisma/client").ElectionStatus,
  action: string
) {
  const id = paramId(req.params.id);
  await maybeAutoCloseElection(id);
  const existing = await prisma.election.findUnique({ where: { id } });
  if (!existing) return sendError(res, 404, "NOT_FOUND", "Election not found");

  const allowed = ELECTION_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return sendError(
      res,
      409,
      "CONFLICT",
      `Cannot transition from ${existing.status} to ${nextStatus}`
    );
  }

  if (nextStatus === "OPEN") {
    const ready = await validateElectionReadyToOpen(id);
    if (!ready.ok) {
      return sendError(res, 400, "BAD_REQUEST", ready.message);
    }
  }

  if (nextStatus === "FINALIZED" && existing.status !== "CLOSED") {
    return sendError(
      res,
      409,
      "CONFLICT",
      "Only CLOSED elections can be finalized"
    );
  }

  const updated = await prisma.election.update({
    where: { id },
    data: { status: nextStatus },
    include: electionDetailInclude,
  });

  await writeElectionAudit({
    electionId: id,
    actorUserId: req.user!.id,
    action,
  });

  if (nextStatus === "PUBLISHED") {
    await notifyElectionLifecycle(updated, "published").catch(console.error);
  } else if (nextStatus === "OPEN") {
    await notifyElectionLifecycle(updated, "opened").catch(console.error);
  } else if (nextStatus === "CLOSED") {
    await notifyElectionLifecycle(updated, "closed").catch(console.error);
  } else if (nextStatus === "FINALIZED") {
    await notifyElectionLifecycle(updated, "finalized").catch(console.error);
    if (
      updated.resultVisibility === "AFTER_FINALIZED" ||
      updated.resultVisibility === "AFTER_CLOSED"
    ) {
      await notifyElectionLifecycle(updated, "results").catch(console.error);
    }
  }

  return res.json(serializeElectionDetail(updated));
}

electionsRouter.post(
  "/:id/publish",
  requirePermission(Permission.ELECTIONS_MANAGE),
  (req, res) => transitionElection(req, res, "PUBLISHED", "ELECTION_PUBLISHED")
);
electionsRouter.post(
  "/:id/open",
  requirePermission(Permission.ELECTIONS_MANAGE),
  (req, res) => transitionElection(req, res, "OPEN", "ELECTION_OPENED")
);
electionsRouter.post(
  "/:id/close",
  requirePermission(Permission.ELECTIONS_MANAGE),
  (req, res) => transitionElection(req, res, "CLOSED", "ELECTION_CLOSED")
);
electionsRouter.post(
  "/:id/finalize",
  requirePermission(Permission.ELECTIONS_MANAGE),
  (req, res) => transitionElection(req, res, "FINALIZED", "ELECTION_FINALIZED")
);
electionsRouter.post(
  "/:id/archive",
  requirePermission(Permission.ELECTIONS_MANAGE),
  (req, res) => transitionElection(req, res, "ARCHIVED", "ELECTION_ARCHIVED")
);

/** Positions */
electionsRouter.post(
  "/:id/positions",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const electionId = paramId(req.params.id);
    const schema = z.object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000).optional().nullable(),
      maxSelections: z.number().int().min(1).max(1).optional(),
      sortOrder: z.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid position payload");
    }

    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) return sendError(res, 404, "NOT_FOUND", "Election not found");
    if (isBallotLocked(election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Positions cannot be modified after voting starts"
      );
    }

    try {
      const created = await prisma.electionPosition.create({
        data: {
          electionId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          maxSelections: parsed.data.maxSelections ?? 1,
          sortOrder: parsed.data.sortOrder ?? 0,
        },
        include: { candidates: true },
      });
      await writeElectionAudit({
        electionId,
        actorUserId: req.user!.id,
        action: "POSITION_ADDED",
        metadata: { positionId: created.id, name: created.name },
      });
      return res.status(201).json(serializePosition(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(res, 409, "CONFLICT", "Position name already exists");
      }
      throw err;
    }
  }
);

electionsRouter.patch(
  "/positions/:positionId",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const positionId = paramId(req.params.positionId);
    const schema = z.object({
      name: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(2000).optional().nullable(),
      sortOrder: z.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid position payload");
    }

    const position = await prisma.electionPosition.findUnique({
      where: { id: positionId },
      include: { election: true },
    });
    if (!position) return sendError(res, 404, "NOT_FOUND", "Position not found");
    if (isBallotLocked(position.election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Positions cannot be modified after voting starts"
      );
    }

    const updated = await prisma.electionPosition.update({
      where: { id: positionId },
      data: {
        name: parsed.data.name,
        description:
          parsed.data.description === undefined
            ? undefined
            : parsed.data.description,
        sortOrder: parsed.data.sortOrder,
      },
      include: {
        candidates: {
          include: {
            student: {
              select: {
                id: true,
                studentCode: true,
                fullName: true,
                profilePhoto: true,
                faculty: { select: { id: true, name: true, code: true } },
                department: { select: { id: true, name: true, code: true } },
                user: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    await writeElectionAudit({
      electionId: position.electionId,
      actorUserId: req.user!.id,
      action: "POSITION_UPDATED",
      metadata: { positionId },
    });
    return res.json(serializePosition(updated));
  }
);

electionsRouter.delete(
  "/positions/:positionId",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const positionId = paramId(req.params.positionId);
    const position = await prisma.electionPosition.findUnique({
      where: { id: positionId },
      include: { election: true },
    });
    if (!position) return sendError(res, 404, "NOT_FOUND", "Position not found");
    if (isBallotLocked(position.election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Positions cannot be modified after voting starts"
      );
    }
    await prisma.electionPosition.delete({ where: { id: positionId } });
    await writeElectionAudit({
      electionId: position.electionId,
      actorUserId: req.user!.id,
      action: "POSITION_REMOVED",
      metadata: { positionId, name: position.name },
    });
    return res.json({ success: true });
  }
);

/** Candidates */
electionsRouter.post(
  "/positions/:positionId/candidates",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const positionId = paramId(req.params.positionId);
    const schema = z.object({
      studentId: z.string().min(1),
      displayName: z.string().trim().min(1).max(200).optional(),
      photoUrl: z.string().max(500).optional().nullable(),
      manifesto: z.string().trim().max(5000).optional().nullable(),
      biography: z.string().trim().max(5000).optional().nullable(),
      sortOrder: z.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid candidate payload");
    }

    const position = await prisma.electionPosition.findUnique({
      where: { id: positionId },
      include: { election: true },
    });
    if (!position) return sendError(res, 404, "NOT_FOUND", "Position not found");
    if (isBallotLocked(position.election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Candidates cannot be modified after voting starts"
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
      include: {
        user: { select: { status: true, role: true } },
        faculty: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!student || student.user.role !== "STUDENT") {
      return sendError(res, 400, "BAD_REQUEST", "Student not found");
    }
    if (student.user.status !== "ACTIVE") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Only ACTIVE students can be candidates"
      );
    }

    try {
      const created = await prisma.electionCandidate.create({
        data: {
          positionId,
          studentId: student.id,
          displayName: parsed.data.displayName ?? student.fullName,
          photoUrl: parsed.data.photoUrl ?? student.profilePhoto ?? null,
          manifesto: parsed.data.manifesto ?? null,
          biography: parsed.data.biography ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
          status: "ACTIVE",
        },
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              fullName: true,
              profilePhoto: true,
              faculty: { select: { id: true, name: true, code: true } },
              department: { select: { id: true, name: true, code: true } },
              user: { select: { status: true } },
            },
          },
        },
      });
      await writeElectionAudit({
        electionId: position.electionId,
        actorUserId: req.user!.id,
        action: "CANDIDATE_ADDED",
        metadata: { candidateId: created.id, positionId },
      });
      return res.status(201).json(serializeCandidate(created));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "CONFLICT",
          "Student is already a candidate for this position"
        );
      }
      throw err;
    }
  }
);

electionsRouter.patch(
  "/candidates/:candidateId",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const candidateId = paramId(req.params.candidateId);
    const schema = z.object({
      displayName: z.string().trim().min(1).max(200).optional(),
      photoUrl: z.string().max(500).optional().nullable(),
      manifesto: z.string().trim().max(5000).optional().nullable(),
      biography: z.string().trim().max(5000).optional().nullable(),
      status: z.enum(["ACTIVE", "WITHDRAWN"]).optional(),
      sortOrder: z.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid candidate payload");
    }

    const candidate = await prisma.electionCandidate.findUnique({
      where: { id: candidateId },
      include: { position: { include: { election: true } } },
    });
    if (!candidate) {
      return sendError(res, 404, "NOT_FOUND", "Candidate not found");
    }
    if (isBallotLocked(candidate.position.election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Candidates cannot be modified after voting starts"
      );
    }

    const updated = await prisma.electionCandidate.update({
      where: { id: candidateId },
      data: {
        displayName: parsed.data.displayName,
        photoUrl:
          parsed.data.photoUrl === undefined ? undefined : parsed.data.photoUrl,
        manifesto:
          parsed.data.manifesto === undefined
            ? undefined
            : parsed.data.manifesto,
        biography:
          parsed.data.biography === undefined
            ? undefined
            : parsed.data.biography,
        status: parsed.data.status,
        sortOrder: parsed.data.sortOrder,
      },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            fullName: true,
            profilePhoto: true,
            faculty: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            user: { select: { status: true } },
          },
        },
      },
    });
    await writeElectionAudit({
      electionId: candidate.position.electionId,
      actorUserId: req.user!.id,
      action: "CANDIDATE_UPDATED",
      metadata: { candidateId },
    });
    return res.json(serializeCandidate(updated));
  }
);

electionsRouter.delete(
  "/candidates/:candidateId",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const candidateId = paramId(req.params.candidateId);
    const candidate = await prisma.electionCandidate.findUnique({
      where: { id: candidateId },
      include: { position: { include: { election: true } } },
    });
    if (!candidate) {
      return sendError(res, 404, "NOT_FOUND", "Candidate not found");
    }
    if (isBallotLocked(candidate.position.election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Candidates cannot be modified after voting starts"
      );
    }
    await prisma.electionCandidate.delete({ where: { id: candidateId } });
    await writeElectionAudit({
      electionId: candidate.position.electionId,
      actorUserId: req.user!.id,
      action: "CANDIDATE_REMOVED",
      metadata: { candidateId, positionId: candidate.positionId },
    });
    return res.json({ success: true });
  }
);

/** Eligibility — SELECTED_STUDENTS */
electionsRouter.put(
  "/:id/eligibility",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const electionId = paramId(req.params.id);
    const schema = z.object({
      userIds: z.array(z.string().min(1)).max(5000),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid eligibility payload");
    }

    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) return sendError(res, 404, "NOT_FOUND", "Election not found");
    if (isBallotLocked(election.status)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Eligibility cannot be modified after voting starts"
      );
    }
    if (election.eligibilityMode !== "SELECTED_STUDENTS") {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Election eligibilityMode must be SELECTED_STUDENTS"
      );
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: [...new Set(parsed.data.userIds)] },
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const validIds = users.map((u) => u.id);

    await prisma.$transaction([
      prisma.electionVoterEligibility.deleteMany({ where: { electionId } }),
      prisma.electionVoterEligibility.createMany({
        data: validIds.map((userId) => ({ electionId, userId })),
      }),
    ]);

    await writeElectionAudit({
      electionId,
      actorUserId: req.user!.id,
      action: "ELIGIBILITY_CHANGED",
      metadata: { count: validIds.length },
    });

    return res.json({ electionId, eligibleCount: validIds.length });
  }
);

/** Ballot */
electionsRouter.get(
  "/:id/ballot",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    await maybeAutoCloseElection(id);

    const election = await prisma.election.findUnique({
      where: { id },
      include: electionDetailInclude,
    });
    if (!election || election.status === "DRAFT") {
      return sendError(res, 404, "NOT_FOUND", "Election not found");
    }

    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }

    const eligible = await isUserEligibleToVote(election, req.user!.id);
    const voteCount = await prisma.electionVote.count({
      where: { electionId: id, voterUserId: req.user!.id },
    });
    const hasVoted = voteCount > 0;
    const canVote =
      eligible &&
      student.user.status === "ACTIVE" &&
      votingWindowOpen(election) &&
      !hasVoted;

    return res.json({
      election: serializeElectionDetail(election, {
        eligible,
        hasVoted,
      }),
      eligible,
      hasVoted,
      canVote,
      votingOpen: votingWindowOpen(election),
      instructions:
        "Select exactly one candidate for each position. Votes cannot be changed after submission.",
    });
  }
);

/** My status */
electionsRouter.get(
  "/:id/my-status",
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    await maybeAutoCloseElection(id);
    const election = await prisma.election.findUnique({ where: { id } });
    if (!election || election.status === "DRAFT") {
      return sendError(res, 404, "NOT_FOUND", "Election not found");
    }
    const eligible = await isUserEligibleToVote(election, req.user!.id);
    const hasVoted =
      (await prisma.electionVote.count({
        where: { electionId: id, voterUserId: req.user!.id },
      })) > 0;
    return res.json({
      electionId: id,
      eligible,
      hasVoted,
      canVote: eligible && votingWindowOpen(election) && !hasVoted,
      status: election.status,
    });
  }
);

/** Cast ballot — JWT identity only */
electionsRouter.post(
  "/:id/vote",
  requirePermission(Permission.ELECTIONS_VOTE),
  requireRoles("STUDENT"),
  async (req: AuthedRequest, res) => {
    const electionId = paramId(req.params.id);
    // Ignore any client-supplied studentId / voterUserId
    const schema = z.object({
      selections: z
        .array(
          z.object({
            positionId: z.string().min(1),
            candidateId: z.string().min(1),
          })
        )
        .min(1)
        .max(50),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(res, 400, "BAD_REQUEST", "Invalid vote payload");
    }

    await maybeAutoCloseElection(electionId);
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      include: {
        positions: {
          include: {
            candidates: { where: { status: "ACTIVE" } },
          },
        },
      },
    });
    if (!election) {
      return sendError(res, 404, "NOT_FOUND", "Election not found");
    }

    const student = await resolveStudent(req.user!.id);
    if (!student) {
      return sendError(res, 404, "NOT_FOUND", "Student profile not found");
    }
    if (student.user.status !== "ACTIVE") {
      return sendError(res, 403, "FORBIDDEN", "Inactive students cannot vote");
    }

    if (!votingWindowOpen(election)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Voting is not open for this election"
      );
    }

    const eligible = await isUserEligibleToVote(election, req.user!.id);
    if (!eligible) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "You are not eligible to vote in this election"
      );
    }

    const existingVotes = await prisma.electionVote.count({
      where: { electionId, voterUserId: req.user!.id },
    });
    if (existingVotes > 0) {
      return sendError(
        res,
        409,
        "ALREADY_VOTED",
        "You have already submitted your vote for this election"
      );
    }

    const activePositions = election.positions;
    if (activePositions.length < 1) {
      return sendError(res, 400, "BAD_REQUEST", "Election has no positions");
    }

    const selectionMap = new Map(
      parsed.data.selections.map((s) => [s.positionId, s.candidateId])
    );
    if (selectionMap.size !== parsed.data.selections.length) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "Duplicate position selections are not allowed"
      );
    }
    if (selectionMap.size !== activePositions.length) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        "You must select exactly one candidate for every position"
      );
    }

    const voteRows: Array<{
      electionId: string;
      positionId: string;
      candidateId: string;
      voterUserId: string;
    }> = [];

    for (const position of activePositions) {
      const candidateId = selectionMap.get(position.id);
      if (!candidateId) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          `Missing selection for position ${position.name}`
        );
      }
      const candidate = position.candidates.find((c) => c.id === candidateId);
      if (!candidate) {
        return sendError(
          res,
          400,
          "BAD_REQUEST",
          "Invalid candidate for position"
        );
      }
      voteRows.push({
        electionId,
        positionId: position.id,
        candidateId,
        voterUserId: req.user!.id,
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.electionVote.createMany({ data: voteRows });
        await tx.electionAuditLog.create({
          data: {
            electionId,
            actorUserId: req.user!.id,
            action: "VOTE_CAST",
            // No candidateId in audit metadata (secret ballot)
            metadataJson: JSON.stringify({
              positionCount: voteRows.length,
            }),
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return sendError(
          res,
          409,
          "ALREADY_VOTED",
          "You have already submitted your vote for this election"
        );
      }
      throw err;
    }

    return res.status(201).json({ success: true, status: "VOTED" });
  }
);

/** Results */
electionsRouter.get("/:id/results", async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  await maybeAutoCloseElection(id);
  const election = await prisma.election.findUnique({ where: { id } });
  if (!election) return sendError(res, 404, "NOT_FOUND", "Election not found");

  if (req.user!.role === "TEACHER") {
    return sendError(res, 403, "FORBIDDEN", "Teachers cannot access elections");
  }

  const isAdmin = req.user!.role === "ADMIN";
  if (!isAdmin && election.status === "DRAFT") {
    return sendError(res, 404, "NOT_FOUND", "Election not found");
  }

  const includeCounts =
    isAdmin || studentsCanSeeResults(election);

  if (!isAdmin && !includeCounts) {
    return res.json(
      serializeResultsPayload(
        {
          positions: [],
          eligibleVoters: 0,
          totalVoters: 0,
          participationPercentage: 0,
          totalVotes: 0,
        },
        { includeCounts: false }
      )
    );
  }

  const stats = await calculateElectionResults(id);
  if (isAdmin) {
    await writeElectionAudit({
      electionId: id,
      actorUserId: req.user!.id,
      action: "RESULTS_VIEWED_BY_ADMIN",
    }).catch(() => {});
  }
  return res.json(serializeResultsPayload(stats, { includeCounts: true }));
});

/** Admin statistics (aggregates only) */
electionsRouter.get(
  "/:id/statistics",
  requirePermission(Permission.ELECTIONS_MANAGE),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    await maybeAutoCloseElection(id);
    const election = await prisma.election.findUnique({
      where: { id },
      include: electionDetailInclude,
    });
    if (!election) return sendError(res, 404, "NOT_FOUND", "Election not found");

    const stats = await calculateElectionResults(id);
    return res.json({
      election: serializeElectionSummary(election, {
        eligibleVoters: stats.eligibleVoters,
        totalVoters: stats.totalVoters,
        participationPercentage: stats.participationPercentage,
      }),
      ...serializeResultsPayload(stats, { includeCounts: true }),
      positionCount: election.positions.length,
      candidateCount: election.positions.reduce(
        (s, p) => s + p.candidates.length,
        0
      ),
    });
  }
);

/** Audit logs */
electionsRouter.get(
  "/:id/audit",
  requirePermission(Permission.ELECTIONS_AUDIT_READ),
  async (req: AuthedRequest, res) => {
    const id = paramId(req.params.id);
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const election = await prisma.election.findUnique({ where: { id } });
    if (!election) return sendError(res, 404, "NOT_FOUND", "Election not found");

    const where = { electionId: id };
    const [total, rows] = await Promise.all([
      prisma.electionAuditLog.count({ where }),
      prisma.electionAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);

    return res.json({
      data: rows.map(serializeAuditLog),
      pagination: paginationMeta(total, page, pageSize),
    });
  }
);
