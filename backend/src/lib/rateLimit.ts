import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Lightweight in-memory rate limiter (single-process).
 * Suitable for SQLite/dev and single-node API; not a distributed limiter.
 */
export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  /** Stable key — IP, user id, etc. */
  keyFn: (req: Request) => string;
  message?: string;
}) {
  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const key = opts.keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        error: opts.message ?? "Too many requests. Please try again shortly.",
        code: "RATE_LIMITED",
      });
    }
    return next();
  };
}

export function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/** Test helper */
export function __resetRateLimitBucketsForTests() {
  buckets.clear();
}
