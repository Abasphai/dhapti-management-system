import "dotenv/config";
import express from "express";
import serverless from "serverless-http";
import backendApp from "../backend/dist/app.js";

/**
 * Bridge layer for Vercel serverless:
 * - Optional catch-all `api/[[...path]].ts` may deliver paths without `/api` prefix
 * - Express routes in backend are mounted at `/api/*`
 */
const bridge = express();

bridge.use((req, _res, next) => {
  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    const qIndex = url.indexOf("?");
    const path = qIndex === -1 ? url : url.slice(0, qIndex);
    const qs = qIndex === -1 ? "" : url.slice(qIndex);
    const normalized = path.startsWith("/") ? path : `/${path}`;
    req.url = `/api${normalized}${qs}`;
  }
  next();
});

bridge.use(backendApp);

const handler = serverless(bridge, {
  binary: [
    "application/pdf",
    "application/octet-stream",
    "image/*",
    "video/*",
    "audio/*",
  ],
});

export default handler;
