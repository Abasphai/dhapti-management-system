import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { hasPermission, Permission } from "../src/lib/permissions.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

async function login(email: string, expectedRole?: string) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({
      email,
      password: "DHAPTI@2026",
      ...(expectedRole ? { expectedRole } : {}),
    });
  assert.equal(res.status, 200, res.text);
  return res.body.token as string;
}

describe("Phase 1J University Election System", () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let adminToken = "";
  let teacherToken = "";
  let studentToken = "";
  let otherStudentToken = "";
  let inactiveStudentToken = "";
  let facultyId = "";
  let departmentId = "";
  let studentId = "";
  let otherStudentId = "";
  let inactiveStudentId = "";
  let studentUserId = "";
  let otherStudentUserId = "";
  let inactiveUserId = "";
  let electionId = "";
  let positionPresId = "";
  let positionVpId = "";
  let candidateAId = "";
  let candidateBId = "";
  let candidateVpId = "";

  after(async () => {
    if (electionId) {
      await prisma.electionVote.deleteMany({ where: { electionId } }).catch(() => {});
      await prisma.electionAuditLog.deleteMany({ where: { electionId } }).catch(() => {});
      await prisma.electionVoterEligibility.deleteMany({ where: { electionId } }).catch(() => {});
      await prisma.electionCandidate.deleteMany({
        where: { position: { electionId } },
      }).catch(() => {});
      await prisma.electionPosition.deleteMany({ where: { electionId } }).catch(() => {});
      await prisma.election.deleteMany({ where: { id: electionId } }).catch(() => {});
    }
    await prisma.notification
      .deleteMany({ where: { dedupeKey: { startsWith: "election." } } })
      .catch(() => {});
    for (const uid of [studentUserId, otherStudentUserId, inactiveUserId].filter(Boolean)) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    if (facultyId) {
      await prisma.faculty.deleteMany({ where: { id: facultyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("permission catalog for elections", () => {
    assert.equal(hasPermission("ADMIN", Permission.ELECTIONS_MANAGE), true);
    assert.equal(hasPermission("ADMIN", Permission.ELECTIONS_AUDIT_READ), true);
    assert.equal(hasPermission("STUDENT", Permission.ELECTIONS_VOTE), true);
    assert.equal(hasPermission("STUDENT", Permission.ELECTIONS_MANAGE), false);
    assert.equal(hasPermission("TEACHER", Permission.ELECTIONS_VOTE), false);
    assert.equal(hasPermission("TEACHER", Permission.ELECTIONS_MANAGE), false);
  });

  it("rejects unauthenticated election access", async () => {
    assert.equal((await request(app).get("/api/elections")).status, 401);
    assert.equal((await request(app).post("/api/elections")).status, 401);
  });

  it("full election lifecycle, voting security, results, audit", async () => {
    adminToken = await login("admin@dhapti.edu.so");
    teacherToken = await login("mohamed.ali@dhapti.edu.so", "TEACHER");

    const faculty = await request(app)
      .post("/api/faculties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Elec Fac ${suffix}`,
        code: `EF${suffix}`.slice(0, 12).toUpperCase(),
      });
    assert.equal(faculty.status, 201, faculty.text);
    facultyId = faculty.body.id;

    const dept = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `Elec Dept ${suffix}`,
        code: `ED${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
      });
    assert.equal(dept.status, 201, dept.text);
    departmentId = dept.body.id;

    const student = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Voter One ${suffix}`,
        email: `voter1_${suffix}@dhapti.edu.so`,
        studentCode: `V1${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(student.status, 201, student.text);
    studentId = student.body.id;
    studentUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: studentId } })
    ).userId;
    studentToken = await login(`voter1_${suffix}@dhapti.edu.so`, "STUDENT");

    const other = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Voter Two ${suffix}`,
        email: `voter2_${suffix}@dhapti.edu.so`,
        studentCode: `V2${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(other.status, 201, other.text);
    otherStudentId = other.body.id;
    otherStudentUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: otherStudentId } })
    ).userId;
    otherStudentToken = await login(`voter2_${suffix}@dhapti.edu.so`, "STUDENT");

    const inactive = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: `Inactive Voter ${suffix}`,
        email: `ivoter_${suffix}@dhapti.edu.so`,
        studentCode: `IV${suffix}`.slice(0, 12).toUpperCase(),
        facultyId,
        departmentId,
        password: "DHAPTI@2026",
      });
    assert.equal(inactive.status, 201, inactive.text);
    inactiveStudentId = inactive.body.id;
    inactiveUserId = (
      await prisma.student.findUniqueOrThrow({ where: { id: inactiveStudentId } })
    ).userId;
    inactiveStudentToken = await login(`ivoter_${suffix}@dhapti.edu.so`, "STUDENT");
    await request(app)
      .patch(`/api/students/${inactiveStudentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "INACTIVE" });

    // Teacher cannot manage
    const teacherCreate = await request(app)
      .post("/api/elections")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Nope",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.equal(teacherCreate.status, 403);

    const teacherList = await request(app)
      .get("/api/elections")
      .set("Authorization", `Bearer ${teacherToken}`);
    assert.equal(teacherList.status, 403);

    // Student cannot create
    const studentCreate = await request(app)
      .post("/api/elections")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        title: "Nope",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      });
    assert.equal(studentCreate.status, 403);

    // Invalid dates
    const badDates = await request(app)
      .post("/api/elections")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Election ${suffix}`,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date().toISOString(),
      });
    assert.equal(badDates.status, 400);

    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const endsAt = new Date(Date.now() + 2 * 3600_000).toISOString();

    const created = await request(app)
      .post("/api/elections")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: `Dhapti Leadership ${suffix}`,
        description: "Student leadership election",
        startsAt,
        endsAt,
        resultVisibility: "AFTER_CLOSED",
        eligibilityMode: "ALL_ACTIVE_STUDENTS",
      });
    assert.equal(created.status, 201, created.text);
    electionId = created.body.id;
    assert.equal(created.body.status, "DRAFT");

    // Student cannot see DRAFT
    const draftHide = await request(app)
      .get(`/api/elections/${electionId}`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(draftHide.status, 404);

    // Cannot open without positions
    const openEmpty = await request(app)
      .post(`/api/elections/${electionId}/open`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(openEmpty.status, 409);

    const pos1 = await request(app)
      .post(`/api/elections/${electionId}/positions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "President", sortOrder: 0 });
    assert.equal(pos1.status, 201, pos1.text);
    positionPresId = pos1.body.id;

    const pos2 = await request(app)
      .post(`/api/elections/${electionId}/positions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Vice President", sortOrder: 1 });
    assert.equal(pos2.status, 201, pos2.text);
    positionVpId = pos2.body.id;

    // Inactive student cannot be candidate
    const badCand = await request(app)
      .post(`/api/elections/positions/${positionPresId}/candidates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: inactiveStudentId });
    assert.equal(badCand.status, 400);

    const candA = await request(app)
      .post(`/api/elections/positions/${positionPresId}/candidates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId,
        manifesto: "Better campus services",
        biography: "Active student leader",
      });
    assert.equal(candA.status, 201, candA.text);
    candidateAId = candA.body.id;

    const candB = await request(app)
      .post(`/api/elections/positions/${positionPresId}/candidates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: otherStudentId, manifesto: "Transparency first" });
    assert.equal(candB.status, 201, candB.text);
    candidateBId = candB.body.id;

    // Duplicate candidate same position
    const dupCand = await request(app)
      .post(`/api/elections/positions/${positionPresId}/candidates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId });
    assert.equal(dupCand.status, 409);

    const candVp = await request(app)
      .post(`/api/elections/positions/${positionVpId}/candidates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: otherStudentId });
    assert.equal(candVp.status, 201, candVp.text);
    candidateVpId = candVp.body.id;

    // Cannot open from DRAFT (must publish first)
    const openDraft = await request(app)
      .post(`/api/elections/${electionId}/open`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(openDraft.status, 409);

    const publish = await request(app)
      .post(`/api/elections/${electionId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(publish.status, 200, publish.text);
    assert.equal(publish.body.status, "PUBLISHED");

    const open = await request(app)
      .post(`/api/elections/${electionId}/open`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(open.status, 200, open.text);
    assert.equal(open.body.status, "OPEN");

    // Locked: cannot add position/candidate while OPEN
    const lockedPos = await request(app)
      .post(`/api/elections/${electionId}/positions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Treasurer" });
    assert.equal(lockedPos.status, 409);

    const lockedCand = await request(app)
      .post(`/api/elections/positions/${positionPresId}/candidates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId: inactiveStudentId });
    assert.equal(lockedCand.status, 409);

    // Hidden results while OPEN + AFTER_CLOSED
    const hiddenResults = await request(app)
      .get(`/api/elections/${electionId}/results`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(hiddenResults.status, 200);
    assert.equal(hiddenResults.body.visible, false);

    // Inactive student cannot vote (auth middleware rejects inactive accounts)
    const inactiveVote = await request(app)
      .post(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${inactiveStudentToken}`)
      .send({
        selections: [
          { positionId: positionPresId, candidateId: candidateAId },
          { positionId: positionVpId, candidateId: candidateVpId },
        ],
      });
    assert.ok([401, 403].includes(inactiveVote.status));

    // Incomplete ballot
    const incomplete = await request(app)
      .post(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        selections: [
          { positionId: positionPresId, candidateId: candidateAId },
        ],
      });
    assert.equal(incomplete.status, 400);

    // Cross-position candidate rejected
    const cross = await request(app)
      .post(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        selections: [
          { positionId: positionPresId, candidateId: candidateVpId },
          { positionId: positionVpId, candidateId: candidateVpId },
        ],
      });
    assert.equal(cross.status, 400);

    // Client studentId ignored — JWT wins
    const vote1 = await request(app)
      .post(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        studentId: otherStudentId,
        voterUserId: otherStudentUserId,
        selections: [
          { positionId: positionPresId, candidateId: candidateAId },
          { positionId: positionVpId, candidateId: candidateVpId },
        ],
      });
    assert.equal(vote1.status, 201, vote1.text);
    assert.equal(vote1.body.status, "VOTED");

    // Votes belong to JWT user only
    const myVotes = await prisma.electionVote.findMany({
      where: { electionId, voterUserId: studentUserId },
    });
    assert.equal(myVotes.length, 2);
    const otherVotes = await prisma.electionVote.findMany({
      where: { electionId, voterUserId: otherStudentUserId },
    });
    assert.equal(otherVotes.length, 0);

    // Duplicate vote
    const dup = await request(app)
      .post(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        selections: [
          { positionId: positionPresId, candidateId: candidateBId },
          { positionId: positionVpId, candidateId: candidateVpId },
        ],
      });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.code, "ALREADY_VOTED");

    // Concurrent duplicate (DB uniqueness)
    const race = await Promise.all([
      request(app)
        .post(`/api/elections/${electionId}/vote`)
        .set("Authorization", `Bearer ${otherStudentToken}`)
        .send({
          selections: [
            { positionId: positionPresId, candidateId: candidateBId },
            { positionId: positionVpId, candidateId: candidateVpId },
          ],
        }),
      request(app)
        .post(`/api/elections/${electionId}/vote`)
        .set("Authorization", `Bearer ${otherStudentToken}`)
        .send({
          selections: [
            { positionId: positionPresId, candidateId: candidateBId },
            { positionId: positionVpId, candidateId: candidateVpId },
          ],
        }),
    ]);
    const statuses = race.map((r) => r.status).sort();
    assert.ok(statuses.includes(201));
    assert.ok(statuses.includes(409) || statuses.filter((s) => s === 201).length === 1);
    // At most one success for other student
    const otherVoteCount = await prisma.electionVote.count({
      where: { electionId, voterUserId: otherStudentUserId },
    });
    assert.equal(otherVoteCount, 2); // one per position

    // No vote PATCH/DELETE endpoints
    const patchVote = await request(app)
      .patch(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({});
    assert.ok([404, 405].includes(patchVote.status) || patchVote.status >= 400);

    // Close + results visibility
    const close = await request(app)
      .post(`/api/elections/${electionId}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(close.status, 200, close.text);
    assert.equal(close.body.status, "CLOSED");

    const afterCloseVote = await request(app)
      .post(`/api/elections/${electionId}/vote`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        selections: [
          { positionId: positionPresId, candidateId: candidateAId },
          { positionId: positionVpId, candidateId: candidateVpId },
        ],
      });
    assert.equal(afterCloseVote.status, 409);

    const results = await request(app)
      .get(`/api/elections/${electionId}/results`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(results.status, 200);
    assert.equal(results.body.visible, true);
    assert.ok(results.body.positions.length >= 1);
    // No voter identities in results
    assert.equal(
      JSON.stringify(results.body).includes(studentUserId),
      false
    );

    const stats = await request(app)
      .get(`/api/elections/${electionId}/statistics`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(stats.status, 200);
    assert.ok(stats.body.totalVoters >= 2);
    assert.equal(JSON.stringify(stats.body).includes('"voterUserId"'), false);

    const finalize = await request(app)
      .post(`/api/elections/${electionId}/finalize`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(finalize.status, 200);
    assert.equal(finalize.body.status, "FINALIZED");

    // Invalid transition
    const reopen = await request(app)
      .post(`/api/elections/${electionId}/open`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(reopen.status, 409);

    const archive = await request(app)
      .post(`/api/elections/${electionId}/archive`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(archive.status, 200);
    assert.equal(archive.body.status, "ARCHIVED");

    const audit = await request(app)
      .get(`/api/elections/${electionId}/audit`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(audit.status, 200);
    assert.ok(audit.body.data.some((a: { action: string }) => a.action === "VOTE_CAST"));
    // VOTE_CAST metadata must not include candidateId
    const voteCast = audit.body.data.find(
      (a: { action: string }) => a.action === "VOTE_CAST"
    );
    assert.ok(voteCast);
    assert.equal(
      JSON.stringify(voteCast.metadata ?? {}).includes("candidateId"),
      false
    );

    const studentAudit = await request(app)
      .get(`/api/elections/${electionId}/audit`)
      .set("Authorization", `Bearer ${studentToken}`);
    assert.equal(studentAudit.status, 403);

    // Notification dedupe / service used
    const notif = await prisma.notification.findUnique({
      where: { dedupeKey: `election.opened:${electionId}` },
    });
    assert.ok(notif);

    const again = await prisma.notification.findMany({
      where: { dedupeKey: `election.opened:${electionId}` },
    });
    assert.equal(again.length, 1);
  });
});
