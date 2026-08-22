import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sendError } from "./lib/errors.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { attendanceRouter } from "./routes/attendance.js";
import { attendanceLocationsRouter } from "./routes/attendanceLocations.js";
import { facultyQrAttendanceRouter } from "./routes/facultyQrAttendance.js";
import { teacherAttendanceTimerRouter } from "./routes/teacherAttendanceTimer.js";
import { authRouter } from "./routes/auth.js";
import { classesRouter } from "./routes/classes.js";
import { courseResultsRouter } from "./routes/courseResults.js";
import { coursesRouter } from "./routes/courses.js";
import { departmentsRouter } from "./routes/departments.js";
import { electionsRouter } from "./routes/elections.js";
import { enrollmentsRouter } from "./routes/enrollments.js";
import { facultiesRouter } from "./routes/faculties.js";
import { gradesRouter } from "./routes/grades.js";
import { healthRouter } from "./routes/health.js";
import { materialsRouter } from "./routes/materials.js";
import { notificationsRouter } from "./routes/notifications.js";
import { admissionsRouter } from "./routes/admissions.js";
import { analyticsRouter } from "./routes/analytics.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { paymentsRouter } from "./routes/payments.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { ratingsRouter } from "./routes/ratings.js";
import { settingsRouter } from "./routes/settings.js";
import { cmsPublicRouter } from "./routes/cmsPublic.js";
import { cmsAdminRouter } from "./routes/cmsAdmin.js";
import { certificatesRouter } from "./routes/certificates.js";
import { examsRouter } from "./routes/exams.js";
import { questionsRouter } from "./routes/questions.js";
import { auditLogsRouter } from "./routes/auditLogs.js";
import { studentsRouter } from "./routes/students.js";
import { submissionsRouter } from "./routes/submissions.js";
import { teachersRouter } from "./routes/teachers.js";
import { usersRouter } from "./routes/users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  /**
   * Permissive CORS — reflects the request Origin so dhapti.com, www,
   * Vercel previews, and localhost all pass preflight with credentials.
   */
  const corsOptions: cors.CorsOptions = {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  // Express 5: cors() middleware already answers OPTIONS preflight —
  // do not register app.options('*') (path-to-regexp rejects bare '*').

  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/uploads",
    express.static(
      path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads")
    )
  );

  app.get("/", (_req, res) => {
    res.json({
      name: "Dhapti University Management API",
      version: "1.0.0",
      phase: "exam-control-step1",
      docs: "Use /api/health and /api/auth/login",
    });
  });

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/teachers", teachersRouter);
  app.use("/api/admin/users", usersRouter);
  app.use("/api/faculties", facultiesRouter);
  app.use("/api/departments", departmentsRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/enrollments", enrollmentsRouter);
  // Public settings + admissions — before /api routers with router-level requireAuth
  app.use("/api", settingsRouter);
  app.use("/api", admissionsRouter);
  // Public website CMS (Phase 1 foundation) — published reads only
  app.use("/api", cmsPublicRouter);
  // Certificate verification (public) + admin certificate management (Phase 6)
  app.use("/api", certificatesRouter);
  // Faculty QR display (public kiosk) — must stay before routers with global requireAuth
  app.use("/api", facultyQrAttendanceRouter);
  // Exam Control + student admit card clearance (Step 1)
  app.use("/api", examsRouter);
  // Course Q&A (Phase 7)
  app.use("/api/questions", questionsRouter);
  // Admin audit log viewer (Phase 7)
  app.use("/api", auditLogsRouter);
  // Admin website CMS — JWT + cms.* (scoped mount; must NOT wrap all of /api)
  app.use("/api/admin/cms", cmsAdminRouter);
  // Submission upload/list/download (private storage — not under public /uploads)
  app.use("/api", submissionsRouter);
  // Grading / assessment results (Phase 1F-C)
  app.use("/api", gradesRouter);
  // Course-final results / GPA / transcript (Phase 1K)
  app.use("/api", courseResultsRouter);
  // Quizzes / attempts (Phase 1G)
  app.use("/api", quizzesRouter);
  // Attendance (Phase 1H) + 2-hour teacher class timer
  app.use("/api", attendanceRouter);
  app.use("/api", attendanceLocationsRouter);
  app.use("/api", teacherAttendanceTimerRouter);
  // Notifications (Phase 1I)
  app.use("/api/notifications", notificationsRouter);
  // Elections (Phase 1J)
  app.use("/api/elections", electionsRouter);
  app.use("/api/assignments", assignmentsRouter);
  // Course materials / multi-media learning hub
  app.use("/api", materialsRouter);
  // Finance & fees (Phase 1L)
  app.use("/api", paymentsRouter);
  // Teacher evaluation / performance ratings
  app.use("/api", ratingsRouter);
  // Live dashboards (Phase 1N) — role-scoped stats
  app.use("/api", dashboardRouter);
  // Enterprise analytics & intelligence
  app.use("/api", analyticsRouter);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      // Express identifies error middleware by arity (4 args)
      next: express.NextFunction
    ) => {
      if (
        typeof err === "object" &&
        err &&
        "code" in err &&
        (err as { code?: string }).code === "LIMIT_FILE_SIZE"
      ) {
        return sendError(
          res,
          413,
          "PAYLOAD_TOO_LARGE",
          "File exceeds size limit"
        );
      }

      const message = err?.message ?? "Internal server error";
      const isPrismaEngine =
        /prisma|query engine|binarytarget|schema engine/i.test(message);

      console.error("[api]", err);
      sendError(
        res,
        500,
        "INTERNAL_ERROR",
        isPrismaEngine
          ? "Database engine unavailable. Prisma client may need regenerating for Vercel (rhel-openssl-3.0.x)."
          : process.env.NODE_ENV === "production"
            ? "Internal server error"
            : message
      );
      void next;
    }
  );

  return app;
}

/** Shared Express instance — used by local server and Vercel serverless (`api/index.ts`). */
const app = createApp();
export default app;

