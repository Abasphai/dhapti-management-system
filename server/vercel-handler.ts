import "dotenv/config";
import express from "express";
import backendApp from "../backend/src/app.ts";

const app = express();

// Vercel rewrite → /api may strip prefix; Express routes use /api/*
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
