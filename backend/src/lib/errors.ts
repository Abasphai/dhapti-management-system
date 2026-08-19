import type { Response } from "express";

/** Stable auth/API error codes for clients and docs */
export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "FINANCIAL_HOLD"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ALREADY_VOTED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "LOCATION_REQUIRED"
  | "EARLY_EXIT_CONFIRMATION_REQUIRED";

/**
 * Backward-compatible error body:
 * `{ error: string, code: string, ...extra }`
 * Frontend continues to read `error`; `code` is additive.
 */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  extra?: Record<string, unknown>
) {
  return res.status(status).json({ error: message, code, ...extra });
}
