import "dotenv/config";
import express from "express";
import backendApp from "../backend/dist/app.js";

/**
 * Single Vercel serverless entry (`api/index.ts` → `/api`).
 * vercel.json rewrites ALL `/api/*` here so GET/POST/PUT/DELETE/OPTIONS
 * reach Express (catch-all files often return 405 on POST).
 */
const app = express();

app.use((req, _res, next) => {
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

app.use(backendApp);

export default app;
