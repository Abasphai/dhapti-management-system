import "dotenv/config";
import express from "express";
import backendApp from "../backend/src/app.ts";

const app = express();

/** Restore full /api path after Vercel rewrite → /api (strips subpath). */
app.use((req, _res, next) => {
  const headerPath =
    (req.headers["x-vercel-original-path"] as string | undefined) ??
    (req.headers["x-invoke-path"] as string | undefined);

  if (headerPath?.startsWith("/api")) {
    const qIndex = req.url?.indexOf("?") ?? -1;
    const qs = qIndex === -1 ? "" : (req.url ?? "").slice(qIndex);
    req.url = `${headerPath}${qs}`;
    next();
    return;
  }

  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    const qIndex = url.indexOf("?");
    const pathPart = qIndex === -1 ? url : url.slice(0, qIndex);
    const qs = qIndex === -1 ? "" : url.slice(qIndex);
    const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
    req.url = `/api${normalized}${qs}`;
  }
  next();
});

app.use(backendApp);

export default app;
