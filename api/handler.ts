import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import backendApp from "../backend/dist/app.js";

type HttpHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => void;

const app = backendApp as unknown as HttpHandler;

function normalizeApiPath(req: IncomingMessage) {
  const url = req.url ?? "/";
  if (url.startsWith("/api")) return;

  const qIndex = url.indexOf("?");
  const path = qIndex === -1 ? url : url.slice(0, qIndex);
  const qs = qIndex === -1 ? "" : url.slice(qIndex);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  req.url = `/api${normalized}${qs}`;
}

/** Bundled to api/index.cjs (CommonJS) for Vercel — see scripts/build-vercel-api.mjs */
export default function handler(
  req: IncomingMessage,
  res: ServerResponse
): void {
  normalizeApiPath(req);
  app(req, res);
}
