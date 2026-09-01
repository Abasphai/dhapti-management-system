import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import backendApp from "../backend/src/app.ts";

type HttpHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void;

const app = backendApp as unknown as HttpHandler;

/** Ensure Express sees full `/api/...` paths on Vercel (catch-all or rewrite). */
function normalizeApiPath(req: IncomingMessage) {
  const url = req.url ?? "/";
  if (url.startsWith("/api")) return;

  const qIndex = url.indexOf("?");
  const pathPart = qIndex === -1 ? url : url.slice(0, qIndex);
  const qs = qIndex === -1 ? "" : url.slice(qIndex);
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  req.url = `/api${normalized}${qs}`;
}

/**
 * Vercel serverless entry — explicit (req, res) handler for all HTTP methods.
 * Bundled to api/[...path].js (catch-all) so POST /api/auth/login is not 405'd.
 */
export default function handler(
  req: IncomingMessage,
  res: ServerResponse
): void {
  normalizeApiPath(req);
  app(req, res);
}
