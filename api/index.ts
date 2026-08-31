import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import backendApp from "../backend/dist/app.js";

type HttpHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void;

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
 * Single Vercel serverless entry.
 * vercel.json rewrites every `/api/*` request here (all HTTP methods).
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeApiPath(req);
  (backendApp as HttpHandler)(req, res);
}
