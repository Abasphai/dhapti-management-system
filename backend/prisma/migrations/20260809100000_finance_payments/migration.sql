-- Phase 1L: Evolve stub Payment into fee ledger (invoice/payment rows).
-- Payment was an unused stub; rebuild preserves any rare existing rows.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "semester" TEXT,
    "receiptNumber" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Payment" (
  "id", "studentId", "amount", "description", "semester", "receiptNumber",
  "paymentMethod", "status", "dueDate", "paidAt", "recordedById", "createdAt", "updatedAt"
)
SELECT
  "id",
  "studentId",
  "amount",
  COALESCE("purpose", 'Legacy payment'),
  NULL,
  NULL,
  "method",
  CASE
    WHEN UPPER("status") = 'PAID' THEN 'PAID'
    WHEN UPPER("status") = 'OVERDUE' THEN 'OVERDUE'
    ELSE 'PENDING'
  END,
  NULL,
  CASE WHEN UPPER("status") = 'PAID' THEN "paidAt" ELSE NULL END,
  NULL,
  COALESCE("paidAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Payment";

DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";

CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_dueDate_idx" ON "Payment"("dueDate");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

PRAGMA foreign_keys=ON;
