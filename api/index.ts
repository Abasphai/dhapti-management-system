import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Application } from "express";

type HttpHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void;

let cachedApp: HttpHandler | null = null;

/** Dynamic ESM import — avoids Vercel CJS bundle calling require() on our ESM backend. */
async function getApp(): Promise<HttpHandler> {
  if (!cachedApp) {
    const mod = await import("../backend/dist/app.js");
    cachedApp = mod.default as Application as unknown as HttpHandler;
  }
  return cachedApp;
}

/** Ensure Express sees full `/api/...` paths after Vercel rewrite → `/api`. */
function normalizeApiPath(req: IncomingMessage) {
  const url = req.url ?? "/";
  if (url.startsWith("/api")) return;

  const qIndex = url.indexOf("?");
  const path = qIndex === -1 ? url : url.slice(0, qIndex);
  const qs = qIndex === -1 ? "" : url.slice(qIndex);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  req.url = `/api${normalized}${qs}`;
}

/**
 * Vercel serverless entry (pure ESM).
 * All `/api/*` traffic is rewritten here via vercel.json.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  normalizeApiPath(req);
  const app = await getApp();
  app(req, res);
}
